import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { Pool } from 'pg';
import { validateEnvironment, QA } from '../scripts/qa/campaign.mjs';
import { loadTs } from './image-test-helpers.mjs';
const { console } = globalThis;
const configs = ['a','b','c'].map(s => {
  const path=`/tmp/contentos-pr7-qa-private/actor-${s}.json`;
  assert.equal(statSync(path).mode & 0o777,0o600);
  const c=JSON.parse(readFileSync(path,'utf8'));validateEnvironment(c.env);
  for(const name of ['OPENAI_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'])assert.ok(!c.env[name]);
  return c;
});
const pools=configs.map(c=>new Pool({connectionString:c.env.DATABASE_URL,max:2,connectionTimeoutMillis:15000}));
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log(`PASS: ${name}`);};
const denied=async(client,sql,params=[])=>assert.rejects(()=>client.query(sql,params),e=>['42501','42P01'].includes(e.code));
try {
  await check('three dedicated credentials are non-owner, non-inheriting, no bypass and no role memberships',async()=>{
    for(const [i,p] of pools.entries()){
      const r=(await p.query("SELECT current_database() AS db,session_user AS login,current_user AS role,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,(SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid) AS memberships FROM pg_roles r WHERE rolname=current_user")).rows[0];
      assert.equal(r.db,QA.database);assert.equal(r.login,QA.roles[i]);assert.equal(r.role,QA.roles[i]);
      for(const k of ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolinherit'])assert.equal(r[k],false);assert.equal(r.memberships,0);
    }
  });
  await check('all account tables enforce forced RLS; credentials see exactly their synthetic profile and auth user',async()=>{
    for(const [i,p] of pools.entries()){
      const rls=(await p.query("SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity) AS protected,count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ('contentos_auth','contentos_app','contentos_pr7_qa') AND c.relname<>'actors'")).rows[0];
      assert.deepEqual(rls,{protected:true,count:7});
      const profile=(await p.query('SELECT id,email,data FROM contentos_app.profiles')).rows;
      const auth=(await p.query('SELECT id,email FROM contentos_auth."user"')).rows;
      assert.equal(profile.length,1);assert.equal(auth.length,1);assert.equal(profile[0].id,configs[i].user.id);
      assert.equal(profile[0].data.premium_preview_fixture,true);assert.equal(auth[0].id,profile[0].id);
      assert.equal((await p.query("SELECT count(*)::int AS n FROM contentos_app.profiles WHERE data->>'premium_preview_fixture' IS DISTINCT FROM 'true'")).rows[0].n,0);
    }
  });
  await check('cross-account profile/auth reads and writes are rejected at the database',async()=>{
    for(const [i,p] of pools.entries()){
      const other=configs[(i+1)%configs.length].user;
      assert.equal((await p.query('SELECT id FROM contentos_app.profiles WHERE id=$1',[other.id])).rowCount,0);
      assert.equal((await p.query('SELECT id FROM contentos_auth."user" WHERE id=$1',[other.id])).rowCount,0);
      assert.equal((await p.query('SELECT id FROM contentos_auth.account WHERE user_id=$1',[other.id])).rowCount,0);
      assert.equal((await p.query('UPDATE contentos_app.profiles SET data=data WHERE id=$1',[other.id])).rowCount,0);
      await denied(p,'INSERT INTO contentos_auth.session(id,token,user_id,expires_at,updated_at) VALUES($1,$2,$3,now()+interval \'1 hour\',now())',[randomUUID(),randomUUID(),other.id]);
    }
  });
  await check('session identity cannot be spoofed through settings or SET ROLE; RLS cannot be disabled',async()=>{
    const c=await pools[0].connect();
    try {
      await c.query("SELECT set_config('app.user_id',$1,false)",[configs[1].user.id]);
      assert.equal((await c.query('SELECT contentos_pr7_qa.actor_id() AS id')).rows[0].id,configs[0].user.id);
      await denied(c,'SET ROLE pr7_qa_synthetic_b');await denied(c,'SET SESSION AUTHORIZATION contentos_owner');
      await c.query('SET row_security=off');await denied(c,'SELECT id FROM contentos_app.profiles');await c.query('SET row_security=on');
      await denied(c,'UPDATE contentos_pr7_qa.actors SET account_id=account_id');
      await denied(c,'ALTER TABLE contentos_app.profiles DISABLE ROW LEVEL SECURITY');
      await denied(c,'CREATE TABLE public.qa_escape(id text)');
    }finally{await c.query('SET row_security=on').catch(()=>{});c.release();}
  });
  await check('unrelated billing/mail/verification tables are absent or inaccessible',async()=>{
    for(const name of ['contentos_app.ai_spend_requests','contentos_app.founder_checkout_claims','contentos_app.mail_delivery','contentos_auth.verification'])await denied(pools[0],`SELECT * FROM ${name}`);
    await denied(pools[0],"INSERT INTO contentos_auth.\"user\"(id,name,email) VALUES ('not-allowed','Not allowed','not-allowed@example.invalid')");
  });
  await check('pointing QA credentials at the legacy copied database cannot read any application or auth data',async()=>{
    for(const config of configs){
      const url=new URL(config.env.DATABASE_URL);url.pathname='/contentos';
      assert.throws(()=>validateEnvironment({...config.env,DATABASE_URL:url.href}));
      const legacy=new Pool({connectionString:url.href,max:1});
      try{
        await denied(legacy,'SELECT id FROM contentos_app.profiles');await denied(legacy,'SELECT id FROM contentos_auth."user"');
        const privileges=(await legacy.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','v','m','p','f') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_table_privilege(current_user,c.oid,'SELECT')")).rows[0];
        assert.equal(privileges.n,0);
      }finally{await legacy.end();}
    }
  });
  await check('own workspace save and CAS recovery work; other accounts remain unchanged; writes rolled back',async()=>{
    const {workspaceFromProfile,updateWorkspaceProfile}=loadTs('lib/workspace-contract.ts');
    const otherBefore=(await pools[1].query('SELECT data FROM contentos_app.profiles')).rows[0].data;
    const c=await pools[0].connect();
    try{
      await c.query('BEGIN');const original=(await c.query('SELECT data FROM contentos_app.profiles FOR UPDATE')).rows[0].data;
      const snapshot=workspaceFromProfile(original,configs[0].user.id);
      const {normalizeGenerationRequest,parseGenerationOutput}=loadTs('lib/generation-contract.ts');
      const captured=JSON.parse(readFileSync(new URL('fixtures/pr7-final-acceptance-instagram.json',import.meta.url)));
      const fixture=JSON.parse(readFileSync(new URL('fixtures/pr7-captured-instagram.json',import.meta.url)));
      const reviewed=parseGenerationOutput(JSON.stringify(captured),normalizeGenerationRequest(fixture.request));
      snapshot.store.recent.unshift(reviewed);
      const patch={revision:snapshot.revision,store:snapshot.store,preferences:{...snapshot.preferences,brandName:'Synthetic QA isolation'}};
      const next=updateWorkspaceProfile(original,configs[0].user.id,patch);
      assert.equal((await c.query('UPDATE contentos_app.profiles SET data=$1::jsonb',[JSON.stringify(next.data)])).rowCount,1);
      const saved=(await c.query('SELECT data FROM contentos_app.profiles')).rows[0].data;
      assert.equal(workspaceFromProfile(saved,configs[0].user.id).preferences.brandName,'Synthetic QA isolation');
      const restored=workspaceFromProfile(saved,configs[0].user.id).store.recent.find(r=>r.id===reviewed.id);
      assert.deepEqual(restored.sections[0].review,reviewed.sections[0].review);
      assert.doesNotMatch(restored.sections[0].body,/first newsletter/);
      assert.throws(()=>updateWorkspaceProfile(saved,configs[0].user.id,patch));await c.query('ROLLBACK');
      assert.deepEqual((await c.query('SELECT data FROM contentos_app.profiles')).rows[0].data,original);
      assert.deepEqual((await pools[1].query('SELECT data FROM contentos_app.profiles')).rows[0].data,otherBefore);
    }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
  });
  console.log(JSON.stringify({passed:checks,paidCalls:0,productionWrites:0}));
}catch(e){console.error(JSON.stringify({failed:true,completed:checks,error:e instanceof assert.AssertionError?e.message.split('\n')[0]:'QA database operation failed',code:e.code}));globalThis.process.exitCode=1;}
finally{await Promise.all(pools.map(p=>p.end()));}
