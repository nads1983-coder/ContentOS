import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { createGate, postgresStore, QA, validateEnvironment } from '../scripts/qa/campaign.mjs';
const { console } = globalThis;

// Only these existing private QA files are accepted. No real provider key is read.
const { env: config, user } = JSON.parse(readFileSync('/tmp/contentos-pr7-qa-private/actor-a.json', 'utf8'));
for (const key of ['OPENAI_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']) assert.ok(!config[key]);
const env = { DATABASE_URL: config.DATABASE_URL, CONTENTOS_ISOLATED_BRANCH: config.CONTENTOS_ISOLATED_BRANCH, CONTENTOS_QA_MODE: 'mock' };
validateEnvironment(env);
const otherConfig = JSON.parse(readFileSync('/tmp/contentos-pr7-qa-private/actor-b.json', 'utf8'));
const users = [user, otherConfig.user];
assert.ok(users.length >= 2 && users.every(u => /^premium-preview-[a-z0-9-]+@example\.invalid$/.test(u.email)));
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 4 });
const store = postgresStore(pool, env), gate = createGate(store);
const make = () => ({ approval: `mock-only-${randomUUID()}`, account: users[0].id, email: users[0].email,
  expiresAt: new Date(Date.now()+3600000).toISOString(),
  slots: ['text','text','text','image','image','image'].map((kind,i)=>({id:`slot-${i}`,kind,reservation:QA.maxima[kind]})) });
const payload = i => i<3 ? {model:QA.textModel,input:'Synthetic QA notebook',max_output_tokens:24000}
  : {model:QA.imageModel,prompt:'Synthetic QA notebook',n:1,size:'1024x1024',quality:'high'};
const arg = (id,i=0) => ({campaignId:id,slotId:`slot-${i}`,account:users[0].id,payload:payload(i)});
const ok = async () => ({status:200,body:{usage:{input_tokens:20,output_tokens:30},synthetic:true}});
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log(`PASS: ${name}`);};
const snapshot=async()=>({
  // QA owns no monthly ledger or billing tables; production is never connected.
  profiles:(await pool.query('SELECT id,data FROM contentos_app.profiles ORDER BY id')).rows
});
try {
  const before=digest(await snapshot());
  assert.ok((await pool.query("SELECT to_regclass('contentos_pr7_qa.campaigns') AS name")).rows[0].name,'Apply QA-only schema using isolated branch owner first');
  const spec=make(), c=await gate.create(spec);
  await check('duplicate campaign approval is rejected without altering existing audit',async()=>{
    await assert.rejects(()=>gate.create(spec));assert.equal((await gate.inspect(c.id)).reserved,2679021);
  });
  await check('real Neon row lock permits one concurrent instance; no transaction held across provider',async()=>{
    let entered,release;const started=new Promise(r=>entered=r),wait=new Promise(r=>release=r);let calls=0;
    const first=gate.run(arg(c.id),async()=>{calls++;entered();await wait;return ok();});await started;
    try {
      const other=createGate(postgresStore(pool,env));
      await assert.rejects(()=>other.run(arg(c.id,1),async()=>{calls++;return ok();}),{code:'campaign_stopped_or_inflight'});
      assert.equal((await other.inspect(c.id)).dispatches,1);
    } finally {release();}
    await first;assert.equal(calls,1);
  });
  await check('six slots persist, seventh fails, restart replays without extra dispatch',async()=>{
    for(let i=1;i<6;i++)await gate.run(arg(c.id,i),ok);
    const secondPool=new Pool({connectionString:env.DATABASE_URL,max:1});
    try {
      const restarted=createGate(postgresStore(secondPool,env));let extra=0;
      await restarted.run(arg(c.id),async()=>{extra++;return ok();});
      await assert.rejects(()=>restarted.run({...arg(c.id),slotId:'seventh'},ok),{code:'unapproved_slot'});
      const state=await restarted.inspect(c.id);assert.equal(state.dispatches,6);assert.equal(state.reserved,2679021);assert.equal(extra,0);
    } finally {await secondPool.end();}
  });
  await check('account mismatch, total and per-slot overspend rejected before mock dispatch',async()=>{
    await assert.rejects(()=>gate.run({...arg(c.id),account:users[1].id},ok),{code:'account_mismatch'});
    const high=make();high.slots=high.slots.map(s=>({...s,kind:'text',reservation:QA.maxima.text}));
    await assert.rejects(()=>gate.create(high),{code:'campaign_budget_exceeded'});
    const low=make();low.slots[0].reservation=1;const lowC=await gate.create(low);
    await assert.rejects(()=>gate.run(arg(lowC.id),ok),{code:'slot_reservation_exceeded'});
    assert.equal((await gate.inspect(lowC.id)).dispatches,0);
  });
  for(const kind of ['failed','timeout','uncertain'])await check(`${kind} retains reservation and stops all later dispatches`,async()=>{
    const f=await gate.create(make());let calls=0;
    await assert.rejects(()=>gate.run(arg(f.id),async()=>{calls++;if(kind==='timeout')throw new Error('mock timeout');return kind==='failed'?{status:500}:{status:200,body:{}};}));
    const next=createGate(postgresStore(pool,env));await assert.rejects(()=>next.run(arg(f.id),ok));await assert.rejects(()=>next.run(arg(f.id,1),ok));
    const state=await next.inspect(f.id);assert.equal(state.status,'stopped');assert.equal(state.dispatches,1);assert.equal(state.reserved,2679021);assert.equal(calls,1);
  });
  await check('lost completion persistence leaves durable inflight stop across processes',async()=>{
    const f=await gate.create(make());let completed=false;
    const faulty={...store,transaction:async(id,fn)=>{if(completed)throw new Error('mock completion persistence failure');return store.transaction(id,fn);}};
    await assert.rejects(()=>createGate(faulty).run(arg(f.id),async()=>{completed=true;return ok();}));
    assert.equal((await gate.inspect(f.id)).slots[0].state,'dispatching');await assert.rejects(()=>gate.run(arg(f.id,1),ok));
  });
  await check('database constraints prevent audit deletion or reservation reset',async()=>{
    await assert.rejects(()=>pool.query('DELETE FROM contentos_pr7_qa.campaigns WHERE id=$1',[c.id]));
    await assert.rejects(()=>pool.query("UPDATE contentos_pr7_qa.campaigns SET document=jsonb_set(document,'{reserved}','1') WHERE id=$1",[c.id]));
    assert.equal((await gate.inspect(c.id)).reserved,2679021);
  });
  await check('runtime cannot delete audits or change schema; synthetic profile unchanged',async()=>{
    const privileges=(await pool.query("SELECT has_table_privilege(current_user,'contentos_pr7_qa.campaigns','DELETE') AS delete, has_schema_privilege(current_user,'contentos_pr7_qa','CREATE') AS create")).rows[0];
    assert.deepEqual(privileges,{delete:false,create:false});
    assert.equal(digest(await snapshot()),before);
  });
  await check('another database credential cannot read, mutate or claim this account campaign',async()=>{
    const otherPool=new Pool({connectionString:otherConfig.env.DATABASE_URL,max:1});
    try {
      const other=createGate(postgresStore(otherPool,otherConfig.env));
      await assert.rejects(()=>other.inspect(c.id),{code:'campaign_missing'});
      await assert.rejects(()=>other.create(make()),{code:'campaign_creation_refused'});
      assert.equal((await otherPool.query('UPDATE contentos_pr7_qa.campaigns SET document=document WHERE id=$1',[c.id])).rowCount,0);
      assert.equal((await gate.inspect(c.id)).dispatches,6);
    }finally{await otherPool.end();}
  });
  console.log(JSON.stringify({passed:checks,providerNetworkCalls:0,productionWrites:0,audit:'Mock-only campaigns retained in isolated QA schema'}));
} finally {await pool.end();}
