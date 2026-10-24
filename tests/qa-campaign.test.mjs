import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import process from 'node:process';
import { createGate, manifest, QA, validateEnvironment, loadQaKey, guardedFetch } from '../scripts/qa/campaign.mjs';
const { structuredClone, DOMException, Response } = globalThis;

export const fixtureEnv = () => ({ CONTENTOS_QA_MODE: 'mock', CONTENTOS_ISOLATED_BRANCH: QA.branch,
  DATABASE_URL: 'postgres://mock:mock@ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech/contentos' });
export const input = () => ({ approval: `mock-${randomUUID()}`, account: 'synthetic-qa', email: 'premium-preview-qa@example.invalid',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  slots: ['text','text','text','image','image','image'].map((kind,i) => ({ id: `slot-${i}`, kind, reservation: QA.maxima[kind] })) });
export const payload = kind => kind === 'text' ? { model: QA.textModel, input: 'Synthetic notebook', max_output_tokens: 24000 }
  : { model: QA.imageModel, prompt: 'Synthetic notebook', n: 1, size: '1024x1024', quality: 'high' };
const ok = () => ({ status: 200, body: { usage: { input_tokens: 20, output_tokens: 30 }, synthetic: true } });
export function memoryStore() {
  const rows = new Map(); let queue = Promise.resolve();
  return { rows, failNextCommit: false,
    async create(c) { if ([...rows.values()].some(x => x.approval === c.approval)) throw new Error('duplicate approval'); rows.set(c.id, structuredClone(c)); },
    transaction(id, fn) {
      const task = queue.then(() => {
        const c = structuredClone(rows.get(id)); const result = fn(c);
        if (this.failNextCommit) { this.failNextCommit = false; throw new Error('mock commit failure'); }
        rows.set(id, c); return result;
      }); queue = task.catch(() => {}); return task;
    }
  };
}
async function setup() { const store = memoryStore(), gate = createGate(store), spec = input(), c = await gate.create(spec); return { store, gate, spec, c }; }
const args = (h,i=0) => ({ campaignId:h.c.id,slotId:`slot-${i}`,account:h.spec.account,payload:payload(i<3?'text':'image') });

test('QA reserves six slots atomically upfront, six succeed, seventh rejected and savings never recycled', async () => {
  const h=await setup(); assert.equal(h.c.reserved,2679021); let calls=0;
  for(let i=0;i<6;i++) await h.gate.run(args(h,i),async()=>{calls++;return ok();});
  const state=await h.gate.inspect(h.c.id);
  assert.equal(state.dispatches,6); assert.equal(state.reserved,2679021); assert.equal(state.status,'complete');
  await assert.rejects(()=>h.gate.run({...args(h),slotId:'seventh'},async()=>{calls++;return ok();}),{code:'unapproved_slot'});
  await h.gate.run(args(h),async()=>{calls++;return ok();}); assert.equal(calls,6);
});
test('QA duplicate approval and excessive cumulative reservations cannot create a new campaign',async()=>{
  const h=await setup(); await assert.rejects(()=>h.gate.create(h.spec));
  const s=input();s.slots=s.slots.map(x=>({...x,kind:'text',reservation:QA.maxima.text}));
  assert.throws(()=>manifest(s),{code:'campaign_budget_exceeded'});
  s.slots.pop();assert.throws(()=>manifest(s),{code:'six_unique_slots_required'});
});
test('QA separate instances serialize concurrent requests before provider IO',async()=>{
  const h=await setup(), other=createGate(h.store);let calls=0, release, started;
  const begun=new Promise(r=>started=r), wait=new Promise(r=>release=r);
  const first=h.gate.run(args(h),async()=>{calls++;started();await wait;return ok();});await begun;
  await assert.rejects(()=>other.run(args(h,1),async()=>{calls++;return ok();}),{code:'campaign_stopped_or_inflight'});
  await assert.rejects(()=>other.run(args(h),async()=>{calls++;return ok();}),{code:'attempt_already_consumed'});
  release();await first;assert.equal(calls,1);
});
for(const [label,provider,state] of [
  ['failure',async()=>({status:429}),'failed'],
  ['timeout',async()=>{throw new DOMException('private error','TimeoutError');},'uncertain'],
  ['uncertain',async()=>({status:200,body:{}}),'uncertain'],
  ['bound violation',async()=>({status:200,body:{usage:{input_tokens:9999999,output_tokens:1}}}),'uncertain']
]) test(`QA ${label} consumes slot and budget, stops subsequent calls and cannot retry after restart`,async()=>{
  const h=await setup(); let calls=0;
  await assert.rejects(()=>h.gate.run(args(h),async()=>{calls++;return provider();}));
  const restarted=createGate(h.store),c=await restarted.inspect(h.c.id);
  assert.equal(c.slots[0].state,state);assert.equal(c.dispatches,1);assert.equal(c.reserved,2679021);assert.equal(c.status,'stopped');
  await assert.rejects(()=>restarted.run(args(h),async()=>{calls++;return ok();}));
  await assert.rejects(()=>restarted.run(args(h,1),async()=>{calls++;return ok();}));assert.equal(calls,1);
});
test('QA lost completion and lost admission acknowledgements fail closed across restarts',async()=>{
  const h=await setup();let calls=0;
  await assert.rejects(()=>h.gate.run(args(h),async()=>{calls++;h.store.failNextCommit=true;return ok();}));
  assert.equal((await createGate(h.store).inspect(h.c.id)).slots[0].state,'dispatching');
  await assert.rejects(()=>createGate(h.store).run(args(h,1),async()=>{calls++;return ok();}));assert.equal(calls,1);
  const base=memoryStore(),store={...base,transaction:async(id,fn)=>{await base.transaction(id,fn);throw new Error('lost acknowledgement');}};
  const spec=input(),c=await createGate(store).create(spec);
  await assert.rejects(()=>createGate(store).run({campaignId:c.id,slotId:'slot-0',account:spec.account,payload:payload('text')},async()=>{calls++;return ok();}));
  assert.equal(base.rows.get(c.id).dispatches,1);assert.equal(calls,1);
});
test('QA rejects account switches, changed replay payloads, unapproved models and oversized reservations before IO',async()=>{
  const h=await setup();let calls=0;const provider=async()=>{calls++;return ok();};
  await assert.rejects(()=>h.gate.run({...args(h),account:'other'},provider),{code:'account_mismatch'});
  await assert.rejects(()=>h.gate.run({...args(h),payload:{...payload('text'),model:'gpt-other'}},provider),{code:'unapproved_model'});
  for(const patch of [{service_tier:'priority'},{tools:[]},{input:[{type:'input_image',image_url:'https://invalid.test'}]}]) {
    await assert.rejects(()=>h.gate.run({...args(h),payload:{...payload('text'),...patch}},provider),{code:'unapproved_text_payload'});
  }
  const spec=input();spec.slots[0].reservation=1;const c=await h.gate.create(spec);
  await assert.rejects(()=>h.gate.run({...args(h),campaignId:c.id},provider),{code:'slot_reservation_exceeded'});
  await h.gate.run(args(h),provider);
  await assert.rejects(()=>h.gate.run({...args(h),payload:{...payload('text'),input:'changed'}},provider),{code:'payload_mismatch'});assert.equal(calls,1);
});
test('QA expired and corrupted campaigns reject without dispatch',async()=>{
  const h=await setup();const future=createGate(h.store,{now:()=>new Date(Date.now()+86400000)});
  await assert.rejects(()=>future.run(args(h),ok),{code:'campaign_expired'});
  h.store.rows.get(h.c.id).slots[0].reservation--;
  await assert.rejects(()=>h.gate.inspect(h.c.id),{code:'corrupt_campaign'});
});
test('QA rejects production/Preview, other database hosts, ambient credentials and missing execution approval',async()=>{
  validateEnvironment(fixtureEnv());
  for(const patch of [{VERCEL_ENV:'preview'},{VERCEL:'1'},{NODE_ENV:'production'},{CONTENTOS_QA_MODE:''},{CONTENTOS_ISOLATED_BRANCH:'production'},{OPENAI_API_KEY:'mock'},{STRIPE_SECRET_KEY:'mock'},{RESEND_API_KEY:'mock'},{DATABASE_URL:'postgres://mock@production.invalid/contentos'}]) {
    assert.throws(()=>validateEnvironment({...fixtureEnv(),...patch}));
  }
  const previous=process.env.OPENAI_API_KEY;
  try {process.env.OPENAI_API_KEY='unrelated-placeholder';assert.throws(()=>validateEnvironment(fixtureEnv()),{code:'ambient_credentials_forbidden'});}
  finally {if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
  const h=await setup();let sent=0;
  const fetch=guardedFetch({gate:h.gate,campaignId:h.c.id,slotId:'slot-0',account:h.spec.account,env:fixtureEnv(),send:async()=>{sent++;}});
  await assert.rejects(()=>fetch('https://api.openai.com/v1/responses',{method:'POST',body:JSON.stringify(payload('text'))}),{code:'live_execution_not_authorised'});
  assert.equal(sent,0);assert.equal((await h.gate.inspect(h.c.id)).dispatches,0);
});
test('QA designated key loader rejects unsafe files, expiry and ambient loading; guarded transport cannot retry',async()=>{
  const workspace=mkdtempSync(join(tmpdir(),'pr7-key-mock-')),path=join(workspace,'.env.pr7-qa.local');
  const env={...fixtureEnv(),CONTENTOS_QA_MODE:'live'};
  const permit={project:QA.project,paidExecutionApproved:true,keyExpiresAt:new Date(Date.now()+3600000).toISOString()};
  try {
    writeFileSync(path,'OPENAI_API_KEY=sk-test-placeholder-not-valid\n',{mode:0o600});
    assert.equal(loadQaKey({env,path,workspace,permit}),'sk-test-placeholder-not-valid');
    assert.throws(()=>loadQaKey({env,path,workspace,permit:{...permit,keyExpiresAt:'2000-01-01'}}));
    chmodSync(path,0o644);assert.throws(()=>loadQaKey({env,path,workspace,permit}),{code:'unsafe_key_file'});chmodSync(path,0o600);
    const h=await setup();let calls=0;
    const fetch=guardedFetch({gate:h.gate,campaignId:h.c.id,slotId:'slot-0',account:h.spec.account,env,permit:{...permit,campaignId:h.c.id},keyPath:path,workspace,send:async(_url,init)=>{
      calls++;assert.equal(init.redirect,'error');assert.equal(init.headers['OpenAI-Project'],QA.project);return Response.json(ok().body);
    }});
    await fetch('https://api.openai.com/v1/responses',{method:'POST',body:JSON.stringify(payload('text'))});
    await fetch('https://api.openai.com/v1/responses',{method:'POST',body:JSON.stringify(payload('text'))});assert.equal(calls,1);
    const sdk=new OpenAI({apiKey:'offline-placeholder',maxRetries:0,logLevel:'off',fetch});
    await sdk.responses.create(payload('text'));
    assert.equal(calls,1,'Actual installed SDK uses the guarded transport and persisted replay');
    rmSync(path);symlinkSync(join(workspace,'missing'),path);assert.throws(()=>loadQaKey({env,path,workspace,permit}));
  } finally {rmSync(workspace,{recursive:true,force:true});}
});
