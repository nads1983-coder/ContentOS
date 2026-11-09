// Creates and drops its OWN database on localhost. Never accepts a remote host.
// Usage: CONTENTOS_LOCAL_POSTGRES_URL=postgres://...@127.0.0.1:55439/postgres node tests/paid-lifetime-postgres-isolated.mjs
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,cpSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {Pool} from "pg";
import {createServer} from "node:https";
import {once} from "node:events";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {loadTs} from "./image-test-helpers.mjs";
const url=new URL(process.env.CONTENTOS_LOCAL_POSTGRES_URL);
assert.ok(["127.0.0.1","localhost","[::1]"].includes(url.hostname),"LOCAL disposable Postgres only");
for(const key of ["OPENAI_API_KEY","STRIPE_SECRET_KEY","RESEND_API_KEY"]) assert.ok(!process.env[key]);
const root=resolve(import.meta.dirname,".."),dir=mkdtempSync(join(tmpdir(),"lifetime-migration-"));
const name=`lifetime_test_${randomUUID().replaceAll("-","")}`;
const admin=new Pool({connectionString:url.href,max:1});
await admin.query(`CREATE DATABASE ${name}`);
url.pathname=`/${name}`;
const pool=new Pool({connectionString:url.href,max:30});
const runtimePool={async connect(){const c=await pool.connect();await c.query("SET ROLE contentos_runtime");return {query:(...args)=>c.query(...args),release:()=>{c.query("RESET ROLE").then(()=>c.release(),()=>c.release(true));}};},async query(...args){const c=await this.connect();try{return await c.query(...args);}finally{c.release();}}};
let count=0;
async function check(label,fn){await fn();console.log(`PASS ${++count}: ${label}`);}
async function account(extra={}){const id=randomUUID();const data={id,email:`${id}@example.invalid`,plan:"free",subscription_status:"none",...extra};await pool.query("INSERT INTO contentos_app.profiles(id,email,data) VALUES($1,$2,$3)",[id,data.email,data]);return data;}
const realOffer=loadTs("lib/paid-lifetime-offer.ts").PAID_LIFETIME_OFFER;
const mocks={"server-only":{},"@/lib/db/client":{getPool:()=>runtimePool},"@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{...realOffer,checkoutEnabled:true}}};
// Capacity override is isolated to allocator tests. Production capacity is tested separately and remains closed.
const allocationMocks={...mocks,"@/lib/paid-lifetime-capacity":{assertLifetimeCapacity(){}}};
const reservations=loadTs("lib/paid-lifetime-reservations.ts",allocationMocks);
const fulfillment=loadTs("lib/paid-lifetime-fulfillment.ts",mocks);
const billing=loadTs("lib/paid-lifetime-billing-guard.ts",mocks);
const readProfile=async id=>(await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1",[id])).rows[0].data;
async function payment(extra={}){
  const p=await account(extra),claim=await reservations.reservePaidLifetimePurchase(p.id,p.email),sid=`cs_${randomUUID().replaceAll("-","")}`,pid=`pi_${randomUUID().replaceAll("-","")}`;
  await reservations.recordPaidLifetimeCheckoutSession(claim.id,sid,"https://checkout.stripe.com/test",new Date(Date.now()+86400000).toISOString());
  const session={id:sid,mode:"payment",status:"complete",payment_status:"paid",amount_total:claim.pricePence,amount_subtotal:claim.pricePence,currency:"gbp",customer:"cus_test",payment_intent:pid,client_reference_id:p.id,
    metadata:{offer:realOffer.code,user_id:p.id,purchase_id:claim.id,attempt_key:claim.attemptKey},total_details:{amount_discount:0},line_items:{has_more:false,data:[{quantity:1,amount_total:claim.pricePence,price:{currency:"gbp",unit_amount:claim.pricePence,type:"one_time"}}]}};
  const intent={id:pid,status:"succeeded",amount:claim.pricePence,amount_received:claim.pricePence,currency:"gbp",latest_charge:{id:"ch_test",paid:true,refunded:false,disputed:false,amount_refunded:0}};
  return {p,claim,session,intent};
}
try {
  await pool.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='contentos_runtime') THEN CREATE ROLE contentos_runtime; END IF; END $$");
  const journal=JSON.parse(readFileSync(join(root,"drizzle/meta/_journal.json")));
  mkdirSync(join(dir,"meta"));
  writeFileSync(join(dir,"meta/_journal.json"),JSON.stringify({...journal,entries:journal.entries.slice(0,3)}));
  for(const e of journal.entries.slice(0,3)) cpSync(join(root,`drizzle/${e.tag}.sql`),join(dir,`${e.tag}.sql`));
  await migrate(drizzle(pool),{migrationsFolder:dir});
  await pool.query(readFileSync(join(root,"drizzle/0003_commercial_spending.sql"),"utf8"));
  await pool.query("GRANT USAGE ON SCHEMA contentos_app TO contentos_runtime; GRANT SELECT,UPDATE ON contentos_app.profiles TO contentos_runtime");
  const founder=await account({plan:"founder",subscription_status:"active",entitlement_source:"founder_offer",preserved:"history"});
  await pool.query("INSERT INTO contentos_app.ai_budget_configuration(singleton,starts_month,opening_microgbp,evidence_reference) VALUES(true,'2026-10',6778302,'synthetic-production-shape')");
  const budgetBefore=(await pool.query("SELECT * FROM contentos_app.ai_budget_configuration")).rows;
  const urlFile=join(dir,"url");writeFileSync(urlFile,url.href,{mode:0o600});
  const runner=()=>promisify(execFile)(process.execPath,["scripts/migrations/migrate-postgres.mjs",urlFile],{cwd:root});
  await check("actual migration runner applies 0004–0010 exactly once over journal 0000–0002 plus externally managed 0003",async()=>{
    await pool.query("CREATE TABLE contentos_app.paid_lifetime_payment_events(blocker text)");
    await assert.rejects(runner());
    assert.equal((await pool.query("SELECT to_regclass('contentos_app.paid_creator_lifetime_purchases') n")).rows[0].n,null);
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"3");
    await pool.query("DROP TABLE contentos_app.paid_lifetime_payment_events");
    cpSync(join(root,"drizzle/0004_paid_creator_lifetime.sql"),join(dir,"0004_paid_creator_lifetime.sql"));
    writeFileSync(join(dir,"meta/_journal.json"),JSON.stringify({...journal,entries:journal.entries.slice(0,4)}));
    await migrate(drizzle(pool),{migrationsFolder:dir});
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"4");
    await pool.query(`INSERT INTO contentos_app.ai_spend_requests
      (account_id,kind,request_id,fingerprint,month,quote,reserved_microgbp,accounted_microgbp,state)
      VALUES($1,'text','legacy-before-cohort','legacy','2026-10','{}',1,0,'released')`,[founder.id]);
    // Explicitly upgrade the existing prepaid schema and prove 0010 rollback.
    for(const e of journal.entries.slice(4,9))cpSync(join(root,`drizzle/${e.tag}.sql`),join(dir,`${e.tag}.sql`));
    writeFileSync(join(dir,"meta/_journal.json"),JSON.stringify({...journal,entries:journal.entries.slice(0,9)}));
    await migrate(drizzle(pool),{migrationsFolder:dir});
    const legacyTopup=randomUUID();
    await pool.query("INSERT INTO contentos_app.ai_topup_purchases(id,account_id,package,price_pence,credits,attempt_key,status) VALUES($1,$2,'starter',500,25,'legacy-frozen','reversed')",[legacyTopup,founder.id]);
    await pool.query("CREATE TABLE contentos_app.ai_topup_adjudications(blocker text)");
    await assert.rejects(runner());
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"9");
    assert.equal((await pool.query("SELECT count(*) FROM information_schema.columns WHERE table_schema='contentos_app' AND table_name='ai_topup_reversals' AND column_name='reason'")).rows[0].count,"0");
    await pool.query("DROP TABLE contentos_app.ai_topup_adjudications");
    await runner();await runner();
    assert.equal((await pool.query("SELECT status FROM contentos_app.ai_topup_purchases WHERE id=$1",[legacyTopup])).rows[0].status,"reversed");
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"10");
    assert.deepEqual((await pool.query("SELECT * FROM contentos_app.ai_budget_configuration")).rows,budgetBefore);
    assert.deepEqual(await readProfile(founder.id),founder);
    assert.equal((await pool.query("SELECT customer_cohort FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND request_id='legacy-before-cohort'",[founder.id])).rows[0].customer_cohort,"unknown");
    assert.equal((await pool.query("SELECT to_regclass('contentos_app.paid_lifetime_payment_events') n")).rows[0].n,"contentos_app.paid_lifetime_payment_events");
  });
  await check("runtime cannot delete purchases, change price, or remove reversal evidence",async()=>{
    for(const sql of ["DELETE FROM contentos_app.paid_creator_lifetime_purchases","UPDATE contentos_app.paid_creator_lifetime_purchases SET price_pence=14900","DELETE FROM contentos_app.paid_lifetime_payment_events"]) await assert.rejects(runtimePool.query(sql),e=>e.code==="42501");
  });
  await check("26 concurrent customers receive exactly 25 £99 holds; £149 starts only after 25 paid customers",async()=>{
    const people=await Promise.all(Array.from({length:26},()=>account()));
    const results=await Promise.allSettled(people.map(p=>reservations.reservePaidLifetimePurchase(p.id,p.email)));
    const claims=results.filter(r=>r.status==="fulfilled").map(r=>r.value);
    assert.equal(results.filter(r=>r.status==="rejected").length,1);
    assert.equal(claims.filter(c=>c.pricePence===9900).length,25);
    assert.equal(new Set(claims.filter(c=>c.earlyBirdSlot).map(c=>c.earlyBirdSlot)).size,25);
    const owner=people.find(p=>p.id===claims[0].userId);
    const same=await Promise.all(Array.from({length:8},()=>reservations.reservePaidLifetimePurchase(owner.id,owner.email)));
    assert.equal(new Set(same.map(c=>c.id)).size,1);
    await reservations.terminatePaidLifetimeReservation(claims[0].id,"expired");
    await reservations.terminatePaidLifetimeReservation(claims[0].id,"expired");
    const replacement=await reservations.reservePaidLifetimePurchase(owner.id,owner.email);
    assert.equal(replacement.earlyBirdSlot,claims[0].earlyBirdSlot);
    // Seed confirmed historical sales, retaining all real DB constraints.
    await pool.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET status='completed',stripe_checkout_session_id='cs_'||id,stripe_payment_intent_id='pi_'||id,completed_at=now() WHERE status='preparing'");
    const last=people.find(p=>!claims.some(c=>c.userId===p.id));
    assert.equal((await reservations.reservePaidLifetimePurchase(last.id,last.email)).pricePence,14900);
    // This suite owns the disposable database; isolate following lifecycle cases.
    await pool.query("TRUNCATE contentos_app.paid_creator_lifetime_purchases,contentos_app.paid_lifetime_adjudications");
  });
  await check("concurrent activation/refund submissions in both orders retain no paid access; stale success and duplicate reversal are safe",async()=>{
    for(const reverseFirst of [true,false]){
      const x=await payment({stripe_subscription_id:"sub_history",history:"preserve"});
      const blocker=await pool.connect();await blocker.query("BEGIN");await blocker.query("SELECT pg_advisory_xact_lock(1949019031)");
      const activate=()=>fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent);
      const reverse=()=>fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"refunded",`evt_${x.claim.id}`);
      const operations=reverseFirst?[reverse(),activate()]:[activate(),reverse()];
      await blocker.query("COMMIT");blocker.release();await Promise.all(operations);
      await reverse();await activate();
      const profile=await readProfile(x.p.id);
      assert.equal(profile.paid_creator_lifetime_status,"refunded");assert.equal(profile.stripe_subscription_id,"sub_history");assert.equal(profile.history,"preserve");
      assert.equal((await pool.query("SELECT count(*) FROM contentos_app.paid_lifetime_payment_events WHERE event_id=$1",[`evt_${x.claim.id}`])).rows[0].count,"1");
    }
  });
  await check("partial refund preserves access pending review; dispute and full refund take precedence",async()=>{
    const x=await payment();await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent);
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"review","evt_partial");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"active");
    assert.equal((await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent)).status,"review");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"active");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_dispute");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"refunded","evt_full");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_late_dispute");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"refunded");
    const next=await payment();assert.notEqual(next.claim.earlyBirdSlot,x.claim.earlyBirdSlot);
    await assert.rejects(reservations.reservePaidLifetimePurchase(x.p.id,x.p.email));
  });
  await check("explicit administrator approval restores only verified won disputes; replay stays restored and new refund revokes",async()=>{
    const x=await payment({history:"preserve",stripe_subscription_id:"sub_history"});
    await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent);
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_won_test");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"disputed");
    const staleRevision=await fulfillment.getLifetimeDecisionRevision(x.claim.id);
    let disputeStatus="lost";
    const reviewer=loadTs("lib/paid-lifetime-fulfillment.ts",{...mocks,"@/lib/stripe-rest":{
      retrieveCheckoutSession:async()=>x.session,retrievePaidLifetimePaymentIntent:async()=>x.intent,
      retrieveLifetimeDisputes:async()=>[{id:"du_test",status:disputeStatus,charge:"ch_test",payment_intent:x.intent.id}]
    }});
    await assert.rejects(reviewer.approveLifetimeReinstatement(x.claim.id,{id:"admin",email:"admin@example.invalid"},"Reviewed outcome"));
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"disputed");
    disputeStatus="won";
    const decision=await reviewer.approveLifetimeReinstatement(x.claim.id,{id:"admin",email:"admin@example.invalid"},"Reviewed won dispute");
    assert.equal(decision.status,"reinstated");assert.equal((await readProfile(x.p.id)).history,"preserve");
    assert.equal((await readProfile(x.p.id)).stripe_subscription_id,"sub_history");
    const record=(await pool.query("SELECT * FROM contentos_app.paid_lifetime_adjudications WHERE id=$1",[decision.decisionId])).rows[0];
    assert.equal(record.administrator_id,"admin");assert.equal(record.reason,"Reviewed won dispute");assert.deepEqual(record.covered_event_ids,["evt_won_test"]);
    await assert.rejects(runtimePool.query("DELETE FROM contentos_app.paid_lifetime_adjudications"),e=>e.code==="42501");
    assert.equal((await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_won_test")).status,"already_reviewed");
    const disputedIntent={...x.intent,latest_charge:{...x.intent.latest_charge,disputed:true}};
    assert.equal((await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,disputedIntent,staleRevision)).status,"stale_snapshot");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"active");
    assert.equal((await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent)).status,"replay");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"active");
    const freshRevision=await fulfillment.getLifetimeDecisionRevision(x.claim.id);
    assert.equal((await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,disputedIntent,freshRevision)).status,"reversed");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"disputed");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"refunded","evt_new_refund");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"refunded");
    await assert.rejects(reviewer.approveLifetimeReinstatement(x.claim.id,{id:"admin",email:"admin@example.invalid"},"Reviewed won dispute"));
  });
  await check("partial-refund review can be explicitly approved without automatic activation",async()=>{
    const x=await payment();
    const partial={...x.intent,latest_charge:{...x.intent.latest_charge,amount_refunded:100}};
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"review","evt_early_partial","charge.refunded");
    await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,partial);
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"review");
    const reviewer=loadTs("lib/paid-lifetime-fulfillment.ts",{...mocks,"@/lib/stripe-rest":{
      retrieveCheckoutSession:async()=>x.session,retrievePaidLifetimePaymentIntent:async()=>partial,retrieveLifetimeDisputes:async()=>[]
    }});
    await reviewer.approveLifetimeReinstatement(x.claim.id,{id:"admin",email:"admin@example.invalid"},"Approved partial refund");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"active");
    assert.equal((await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,partial)).status,"replay");
  });
  await check("new reversal evidence during administrator review blocks the stale decision",async()=>{
    const x=await payment();await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent);
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_during_before");
    const reviewer=loadTs("lib/paid-lifetime-fulfillment.ts",{...mocks,"@/lib/stripe-rest":{
      retrieveCheckoutSession:async()=>x.session,retrievePaidLifetimePaymentIntent:async()=>x.intent,
      retrieveLifetimeDisputes:async()=>{await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"refunded","evt_during_refund");return [{id:"du_test",status:"won",charge:"ch_test",payment_intent:x.intent.id}];}
    }});
    await assert.rejects(reviewer.approveLifetimeReinstatement(x.claim.id,{id:"admin",email:"admin@example.invalid"},"Reviewed dispute outcome"));
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"refunded");
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.paid_lifetime_adjudications WHERE purchase_id=$1",[x.claim.id])).rows[0].count,"0");
  });
  await check("recurring guard checks rotate across batches without starving lifetime purchases",async()=>{
    const people=await Promise.all(Array.from({length:11},()=>account()));
    for(const [i,p] of people.entries()) await pool.query("INSERT INTO contentos_app.lifetime_recurring_checkout_guards(user_id,session_id) VALUES($1,$2)",[p.id,`cs_guard${i}`]);
    const seen=[];
    const reconcile=loadTs("lib/paid-lifetime-reconciliation.ts",{...allocationMocks,"@/lib/stripe-rest":{
      retrieveCheckoutSession:async id=>{if(id.startsWith("cs_guard")){seen.push(id);return {id,status:"open"};}throw Error("simulated outage");},
      findLifetimeCheckoutSessions:async()=>[],retrievePaidLifetimePaymentIntent:async()=>undefined
    }});
    const first=await reconcile.reconcileLifetimeCheckouts();
    assert.ok(first.checked>0,"lifetime rows were checked even when guards remain");
    await reconcile.reconcileLifetimeCheckouts();
    assert.equal(new Set(seen).size,11);
  });
  await check("recurring checkout guard serializes with lifetime allocation; canceled subscription may transition; Creator rebilling denied and Studio permitted",async()=>{
    const p=await account();await billing.reserveRecurringCheckout(p.id,"pro_creator");await assert.rejects(reservations.reservePaidLifetimePurchase(p.id,p.email));
    const x=await payment({stripe_subscription_id:"sub_old",subscription_status:"canceled"});
    await assert.rejects(billing.reserveRecurringCheckout(x.p.id,"pro_creator"));
    await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent);
    await assert.rejects(billing.reserveRecurringCheckout(x.p.id,"pro_creator"));
    await billing.reserveRecurringCheckout(x.p.id,"pro_studio");
    assert.equal((await readProfile(x.p.id)).stripe_subscription_id,"sub_old");
    const y=await payment();await pool.query("UPDATE contentos_app.profiles SET data=data || $2::jsonb WHERE id=$1",[y.p.id,JSON.stringify({subscription_status:"active",stripe_subscription_id:"sub_new"})]);
    assert.equal((await fulfillment.completePaidCreatorLifetimePurchase(y.claim.id,y.session,y.intent)).status,"review");
    assert.equal((await readProfile(y.p.id)).subscription_status,"active");
  });
  await check("reconciliation recovers abandoned and lost-response sessions, preserves uncertain payments and reuses expired slots",async()=>{
    const a=await payment(),b=await payment(),c=await payment(),d=await payment(),e=await payment();
    await fulfillment.completePaidCreatorLifetimePurchase(e.claim.id,e.session,e.intent);
    const notPosted=await account(),unknown=await account();
    const notPostedClaim=await reservations.reservePaidLifetimePurchase(notPosted.id,notPosted.email),unknownClaim=await reservations.reservePaidLifetimePurchase(unknown.id,unknown.email);
    await pool.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET created_at=now()-interval '2 days' WHERE id=ANY($1::uuid[])",[[notPostedClaim.id,unknownClaim.id]]);
    await pool.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET checkout_params='immutable' WHERE id=$1",[unknownClaim.id]);
    await pool.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET stripe_checkout_session_id=NULL,checkout_params='immutable',created_at=now()-interval '2 days' WHERE id=$1",[b.claim.id]);
    const sessions=new Map([[a.session.id,{...a.session,status:"expired",payment_status:"unpaid",payment_intent:null}],[b.session.id,{...b.session,status:"expired",payment_status:"unpaid",payment_intent:null}],[c.session.id,{...c.session,status:"expired",payment_status:"unpaid"}]]);
    sessions.set(e.session.id,e.session);
    const reconcile=loadTs("lib/paid-lifetime-reconciliation.ts",{...allocationMocks,"@/lib/stripe-rest":{
      retrieveCheckoutSession:async id=>{if(!sessions.has(id))throw Error("offline");return sessions.get(id);},
      findLifetimeCheckoutSessions:async claim=>claim.id===b.claim.id?[sessions.get(b.session.id)]:[],
      retrievePaidLifetimePaymentIntent:async id=>id===e.intent.id?{...e.intent,latest_charge:{...e.intent.latest_charge,refunded:true,amount_refunded:e.claim.pricePence}}:({...c.intent,status:"processing"})}});
    await reconcile.reconcileLifetimeCheckouts();await reconcile.reconcileLifetimeCheckouts();
    assert.equal((await reservations.getPaidLifetimeReservation(a.claim.id)).status,"expired");
    assert.equal((await reservations.getPaidLifetimeReservation(b.claim.id)).status,"expired");
    assert.equal((await reservations.getPaidLifetimeReservation(c.claim.id)).status,"open");
    assert.equal((await reservations.getPaidLifetimeReservation(d.claim.id)).status,"open");
    assert.equal((await reservations.getPaidLifetimeReservation(notPostedClaim.id)).status,"expired");
    assert.equal((await reservations.getPaidLifetimeReservation(unknownClaim.id)).status,"preparing");
    assert.equal((await readProfile(e.p.id)).paid_creator_lifetime_status,"refunded","worker recovers a missed refund webhook");
    const fresh=await payment();assert.ok([a.claim.earlyBirdSlot,b.claim.earlyBirdSlot].includes(fresh.claim.earlyBirdSlot));
  });
  await check("uncertain reconciliation uses durable backoff, stops after eight attempts and produces an actionable alert",async()=>{
    const p=await account(),x=await reservations.reservePaidLifetimePurchase(p.id,p.email);
    await pool.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET checkout_params='uncertain-post' WHERE id=$1",[x.id]);
    const worker=loadTs("lib/paid-lifetime-reconciliation.ts",{...allocationMocks,"@/lib/stripe-rest":{
      retrieveCheckoutSession:async()=>{throw Error("offline");},findLifetimeCheckoutSessions:async()=>[],retrievePaidLifetimePaymentIntent:async()=>undefined
    }});
    await worker.reconcileLifetimeCheckouts();
    let job=(await pool.query("SELECT * FROM contentos_app.lifetime_reconciliation_jobs WHERE kind='purchase' AND entity_id=$1",[x.id])).rows[0];
    assert.equal(job.attempts,1);assert.equal(job.state,"pending");assert.equal(job.last_error_code,"payment_uncertain");
    assert.ok(job.next_attempt_at>job.updated_at);
    await worker.reconcileLifetimeCheckouts();
    job=(await pool.query("SELECT * FROM contentos_app.lifetime_reconciliation_jobs WHERE kind='purchase' AND entity_id=$1",[x.id])).rows[0];assert.equal(job.attempts,1);
    for(let i=0;i<7;i++){
      await pool.query("UPDATE contentos_app.lifetime_reconciliation_jobs SET next_attempt_at=now()-interval '1 second' WHERE kind='purchase' AND entity_id=$1",[x.id]);
      await worker.reconcileLifetimeCheckouts();
    }
    job=(await pool.query("SELECT * FROM contentos_app.lifetime_reconciliation_jobs WHERE kind='purchase' AND entity_id=$1",[x.id])).rows[0];
    assert.equal(job.attempts,8);assert.equal(job.state,"attention");
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.lifetime_reconciliation_alerts WHERE kind='purchase' AND entity_id=$1",[x.id])).rows[0].count,"1");
    assert.equal((await reservations.getPaidLifetimeReservation(x.id)).status,"preparing");
    const ops=loadTs("lib/lifetime-reconciliation-admin.ts",mocks);
    const status=await ops.reconciliationStatus();
    assert.ok(status.jobs.some(row=>row.entity_id===x.id && row.state==="attention"));
    assert.ok(status.alerts.some(row=>row.entity_id===x.id && row.code==="retry_limit"));
    await ops.retryReconciliation("purchase",x.id,{id:"admin",email:"admin@example.invalid"},"Verified Stripe evidence");
    assert.equal((await pool.query("SELECT state FROM contentos_app.lifetime_reconciliation_jobs WHERE kind='purchase' AND entity_id=$1",[x.id])).rows[0].state,"pending");
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.lifetime_reconciliation_actions WHERE entity_id=$1",[x.id])).rows[0].count,"1");
    // A process that dies after claiming its eighth attempt leaves a lease.
    await pool.query(`UPDATE contentos_app.lifetime_reconciliation_jobs SET attempts=8,state='pending',
      lease_until=now()-interval '1 second',lease_token=$2 WHERE kind='purchase' AND entity_id=$1`,[x.id,randomUUID()]);
    await worker.reconcileLifetimeCheckouts();
    job=(await pool.query("SELECT * FROM contentos_app.lifetime_reconciliation_jobs WHERE kind='purchase' AND entity_id=$1",[x.id])).rows[0];
    assert.equal(job.state,"attention");assert.equal(job.lease_token,null);
  });
  await check("real monetary ledger serializes final shared text/image capacity and retains uncertain holds",async()=>{
    const cost=loadTs("lib/ai-cost.ts"),ledger=loadTs("lib/commercial-ledger.ts",mocks);
    const quote=cost.quoteAI("text",{model:"gpt-5.2",input:"synthetic",max_output_tokens:24000},new Date("2026-11-08"));
    const image=cost.quoteAI("image",{model:cost.DEFAULT_IMAGE_MODEL,prompt:"synthetic",n:1,quality:"high",size:"1024x1024"},new Date("2026-11-08"));
    await pool.query("UPDATE contentos_app.ai_budget_configuration SET starts_month=to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM'),opening_microgbp=$1",[30_000_000-Math.max(quote.maximum,image.maximum)]);
    const a=await account(),b=await account();
    const r=await Promise.allSettled([a,b].map((p,i)=>ledger.reserveCommercial(p.id,"last",[quote,image][i],data=>({data,result:"reserved"}))));
    assert.equal(r.filter(v=>v.status==="fulfilled").length,1);
    const p=r[0].status==="fulfilled"?a:b;
    const winningQuote=r[0].status==="fulfilled"?quote:image;
    await ledger.dispatchCommercial(p.id,"last",winningQuote);
    await ledger.finishCommercial(p.id,"last",winningQuote,false,data=>({data,result:null}));
    const row=(await pool.query("SELECT * FROM contentos_app.ai_spend_requests WHERE account_id=$1",[p.id])).rows[0];
    assert.equal(row.state,"uncertain");assert.equal(Number(row.accounted_microgbp),winningQuote.maximum);
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.ai_budget_alerts")).rows[0].count,"2");
  });
  await check("one account cannot consume more than one-quarter of shared monthly capacity across concurrent text and image calls",async()=>{
    const cost=loadTs("lib/ai-cost.ts"),ledger=loadTs("lib/commercial-ledger.ts",mocks,new Map(),{process:{env:{AI_ACCOUNT_MONTHLY_CAP_MICROGBP:"7500000"}}});
    await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=0,suspended=false");
    const a=await account(),b=await account();
    const text={...cost.quoteAI("text",{model:"gpt-5.2",input:"synthetic",max_output_tokens:24000},new Date("2026-11-08")),maximum:680602};
    const image={...cost.quoteAI("image",{model:cost.DEFAULT_IMAGE_MODEL,prompt:"synthetic",n:1,quality:"high",size:"1024x1024"},new Date("2026-11-08")),maximum:680602};
    const results=await Promise.allSettled(Array.from({length:12},(_,i)=>ledger.reserveCommercial(a.id,`fair-${i}`,i%2?image:text,data=>({data,result:{status:"reserved"}}))));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,11);
    assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code==="account_capacity_exhausted").length,1);
    assert.equal((await ledger.reserveCommercial(b.id,"other-account",text,data=>({data,result:{status:"reserved"}}))).status,"reserved");
    const ids=(await pool.query("SELECT request_id,kind FROM contentos_app.ai_spend_requests WHERE account_id=$1 ORDER BY request_id",[a.id])).rows;
    const moved=ids[0],q=moved.kind==="text"?text:image;
    await pool.query("UPDATE contentos_app.ai_spend_requests SET month='2000-01' WHERE account_id=$1 AND request_id=$2",[a.id,moved.request_id]);
    await ledger.reserveCommercial(a.id,"fill-current",q,data=>({data,result:{status:"reserved"}}));
    await assert.rejects(ledger.dispatchCommercial(a.id,moved.request_id,q),e=>e.code==="account_capacity_exhausted");
    assert.equal((await pool.query("SELECT state,month FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND request_id=$2",[a.id,moved.request_id])).rows[0].state,"reserved");
    const unconfigured=loadTs("lib/commercial-ledger.ts",mocks),c=await account();
    for(let i=0;i<12;i++)await unconfigured.reserveCommercial(c.id,`before-limit-${i}`,text,data=>({data,result:{status:"reserved"}}));
    await assert.rejects(ledger.dispatchCommercial(c.id,"before-limit-0",text),e=>e.code==="account_capacity_exhausted");
  });
  await check("financial report snapshots lifetime and subscription cohorts and retains estimates and actual token counts",async()=>{
    const cost=loadTs("lib/ai-cost.ts"),ledger=loadTs("lib/commercial-ledger.ts",mocks);
    const q=cost.quoteAI("text",{model:"gpt-5.2",input:"synthetic",max_output_tokens:24000},new Date("2026-11-08"));
    const a=await account({paid_creator_lifetime_status:"active",paid_creator_lifetime_purchase_id:"synthetic"});
    const b=await account({plan:"pro_creator",subscription_status:"active"});
    for(const p of [a,b]){
      await ledger.reserveCommercial(p.id,"report-test",q,data=>({data,result:{status:"reserved"}}));
      await ledger.dispatchCommercial(p.id,"report-test",q);
      await ledger.settleCommercialUsage(p.id,"report-test",q,{input_tokens:100,output_tokens:200});
      await ledger.finishCommercial(p.id,"report-test",q,true,data=>({data,result:null}));
    }
    await pool.query("UPDATE contentos_app.profiles SET data=data || $2::jsonb WHERE id=$1",[a.id,JSON.stringify({paid_creator_lifetime_status:"refunded"})]);
    const report=await loadTs("lib/ai-financial-report.ts",mocks).currentFinancialReport();
    for(const cohort of ["lifetime","subscription"]){
      const row=report.cohorts.find(v=>v.cohort===cohort);assert.ok(row);assert.ok(row.textGenerations>=1);
      assert.ok(row.reportedInputTokens>=100);assert.ok(row.estimatedSettledMicroGBP>0);
    }
    assert.equal(report.providerInvoiceActualAvailable,false);assert.equal(report.additionalFundedLifetimePlaces,0);
  });
  await check("test-mode top-up issuance is idempotent and reversal before payment cannot grant credits",async()=>{
    const topup=loadTs("lib/ai-topup-payments.ts",mocks),p=await account({plan:"pro_creator",subscription_status:"active"});
    async function item(pkg,request){
      const row=await topup.prepareTopup(p.id,pkg,request),sid=`cs_test_${randomUUID().replaceAll('-','')}`,pi=`pi_${randomUUID().replaceAll('-','')}`;
      const session={livemode:false,id:sid,mode:"payment",status:"complete",payment_status:"paid",currency:"gbp",amount_total:row.price_pence,amount_subtotal:row.price_pence,
        client_reference_id:p.id,metadata:{offer:"prepaid_text_2026",purchase_id:row.id,user_id:p.id,attempt_key:row.attempt_key},payment_intent:pi,total_details:{amount_discount:0},
        line_items:{has_more:false,data:[{quantity:1,amount_total:row.price_pence,price:{currency:"gbp",unit_amount:row.price_pence,type:"one_time"}}]}};
      const intent={livemode:false,id:pi,status:"succeeded",amount:row.price_pence,amount_received:row.price_pence,currency:"gbp",latest_charge:{id:"ch_test",paid:true,refunded:false,disputed:false,amount_refunded:0}};
      return {row,session,intent};
    }
    for(const [pkg,price,credits] of [["starter",500,25],["popular",900,50],["power",1500,100]]) {
      const x=await item(pkg,`test-${pkg}`);assert.equal(x.row.price_pence,price);assert.equal(x.row.credits,credits);
      assert.equal((await topup.prepareTopup(p.id,pkg,`test-${pkg}`)).id,x.row.id);
      assert.equal((await topup.prepareTopup(p.id,pkg,`new-tab-${pkg}`)).id,x.row.id);
      await assert.rejects(topup.fulfillTopup(x.row.id,{...x.session,livemode:true},x.intent));
      const statuses=await Promise.all(Array.from({length:4},()=>topup.fulfillTopup(x.row.id,x.session,x.intent)));
      assert.equal(statuses.filter(s=>s.status==="granted").length,1);
      assert.equal((await pool.query("SELECT count(*) FROM contentos_app.ai_topup_ledger WHERE purchase_id=$1 AND action='grant'",[x.row.id])).rows[0].count,"1");
      await assert.rejects(runtimePool.query("DELETE FROM contentos_app.ai_topup_ledger WHERE purchase_id=$1",[x.row.id]),e=>e.code==="42501");
      await assert.rejects(pool.query("INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,action,credits) VALUES($1,$2,$3,'grant',$4)",[randomUUID(),x.row.id,p.id,credits]),e=>e.code==="23505");
    }
    const stranger=await account();assert.equal((await topup.topupAccountSummary(stranger.id)).available,0);
    const last=await item("starter","failed-payment");
    await topup.terminateTopup(last.row.id,{...last.session,payment_status:"unpaid"},"failed",{...last.intent,status:"requires_payment_method",amount_received:0,latest_charge:null});
    assert.equal((await topup.fulfillTopup(last.row.id,last.session,last.intent)).status,"terminal");
    const y=await item("starter","out-of-order");
    await topup.reverseTopup(y.intent.id,"evt_test_before","charge.refunded");
    assert.equal((await topup.fulfillTopup(y.row.id,y.session,y.intent)).status,"reversed");
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.ai_topup_ledger WHERE purchase_id=$1 AND action='grant'",[y.row.id])).rows[0].count,"0");
    assert.equal((await topup.topupAccountSummary(p.id)).available,175);
  });
  await check("top-up credits are reserved atomically and a dispute blocks in-flight delivery",async()=>{
    const topup=loadTs("lib/ai-topup-payments.ts",mocks),cost=loadTs("lib/ai-cost.ts"),ledger=loadTs("lib/commercial-ledger.ts",mocks);
    const generation=loadTs("lib/generation-reservation.ts"),usage=loadTs("lib/usage.ts");
    await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=0,suspended=false");
    await pool.query("UPDATE contentos_app.ai_spend_requests SET month='2000-01'");
    const start=usage.currentUsageWindow().periodStart;
    const p=await account({plan:"pro_creator",subscription_status:"active",generation_usage_json:{[start]:50}});
    const row=await topup.prepareTopup(p.id,"starter","credits-test-1"),pi=`pi_${randomUUID().replaceAll('-','')}`;
    const session={livemode:false,id:`cs_test_${randomUUID().replaceAll('-','')}`,mode:"payment",status:"complete",payment_status:"paid",currency:"gbp",amount_total:500,amount_subtotal:500,client_reference_id:p.id,payment_intent:pi,metadata:{offer:"prepaid_text_2026",purchase_id:row.id,user_id:p.id,attempt_key:row.attempt_key},total_details:{amount_discount:0},line_items:{has_more:false,data:[{quantity:1,amount_total:500,price:{currency:"gbp",unit_amount:500,type:"one_time"}}]}};
    const intent={livemode:false,id:pi,status:"succeeded",amount:500,amount_received:500,currency:"gbp",latest_charge:{id:"ch_test",paid:true,refunded:false,disputed:false,amount_refunded:0}};
    await topup.fulfillTopup(row.id,session,intent);
    for(let i=0;i<24;i++)await pool.query("INSERT INTO contentos_app.ai_topup_reservations(account_id,request_id,purchase_id,state) VALUES($1,$2,$3,'consumed')",[p.id,`seed-${i}`,row.id]);
    const quote=cost.quoteAI("text",{model:"gpt-5.2",input:"test",max_output_tokens:24000},new Date("2026-11-08"));
    const req=n=>({source:`Original test source ${n}`,tone:"professional",sharpness:"balanced",ctaMode:"soft",presetTopic:"none",selectedTypes:["linkedin"]});
    const attempt=n=>ledger.reserveCommercial(p.id,`credit-${n}`,quote,data=>generation.reserveGenerationInProfile(data,p.id,`credit-${n}`,req(n),new Date(),true));
    const outcomes=await Promise.allSettled([attempt(1),attempt(2)]);
    assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
    const index=outcomes.findIndex(x=>x.status==="fulfilled")+1,id=`credit-${index}`;
    assert.equal((await topup.topupAccountSummary(p.id)).available,0);
    await ledger.dispatchCommercial(p.id,id,quote);
    await topup.reverseTopup(pi,"evt_dispute","charge.dispute.created");
    await ledger.settleCommercialUsage(p.id,id,quote,{input_tokens:20,output_tokens:20});
    await assert.rejects(ledger.finishCommercial(p.id,id,quote,true,data=>({data,result:null})),e=>e.code==="credit_reversed");
    assert.equal((await pool.query("SELECT state FROM contentos_app.ai_topup_reservations WHERE account_id=$1 AND request_id=$2",[p.id,id])).rows[0].state,"void");
    assert.equal((await topup.topupAccountSummary(p.id)).available,0);
    assert.equal((await topup.topupAccountSummary(p.id)).history[0].consumed,24);
  });
  await check("top-up reconciliation retains uncertainty, retries fairly and delivers durable operator alerts",async()=>{
    await pool.query("TRUNCATE contentos_app.ai_topup_adjudications,contentos_app.ai_topup_reconciliation_actions,contentos_app.ai_topup_reconciliation_alerts,contentos_app.ai_topup_reconciliation_jobs,contentos_app.ai_topup_ledger,contentos_app.ai_topup_reservations,contentos_app.ai_topup_reversals,contentos_app.ai_topup_purchases");
    const topup=loadTs("lib/ai-topup-payments.ts",mocks),p=await account({plan:"pro_creator",subscription_status:"active"}),pMissing=await account(),pPaid=await account();
    const expired=await topup.prepareTopup(p.id,"starter","expired-test"),missing=await topup.prepareTopup(pMissing.id,"starter","missing-test"),paid=await topup.prepareTopup(pPaid.id,"starter","paid-refunded");
    const sid=`cs_test_${randomUUID().replaceAll('-','')}`;
    await pool.query("UPDATE contentos_app.ai_topup_purchases SET stripe_session_id=$2,status='open' WHERE id=$1",[expired.id,sid]);
    const session={livemode:false,id:sid,status:"expired",mode:"payment",payment_status:"unpaid",currency:"gbp",amount_total:500,amount_subtotal:500,client_reference_id:p.id,payment_intent:null,
      metadata:{offer:"prepaid_text_2026",purchase_id:expired.id,user_id:p.id,attempt_key:expired.attempt_key},total_details:{amount_discount:0},line_items:{has_more:false,data:[{quantity:1,amount_total:500,price:{currency:"gbp",unit_amount:500,type:"one_time"}}]}};
    const pi=`pi_${randomUUID().replaceAll('-','')}`,paidSession={...session,id:`cs_test_${randomUUID().replaceAll('-','')}`,status:"complete",payment_status:"paid",payment_intent:pi,client_reference_id:pPaid.id,metadata:{...session.metadata,user_id:pPaid.id,purchase_id:paid.id,attempt_key:paid.attempt_key}};
    const paidIntent={livemode:false,id:pi,status:"succeeded",amount:500,amount_received:500,currency:"gbp",latest_charge:{id:"ch_test",paid:true,refunded:false,disputed:false,amount_refunded:0}};
    await topup.fulfillTopup(paid.id,paidSession,paidIntent);
    let delivered=0,respond=false;
    const worker=loadTs("lib/ai-topup-reconciliation.ts",{...mocks,"@/lib/stripe-rest":{retrieveCheckoutSession:async id=>id===sid?session:paidSession,retrievePaidLifetimePaymentIntent:async()=>({...paidIntent,latest_charge:{...paidIntent.latest_charge,refunded:true,amount_refunded:500}})}},new Map(),{
      process:{env:{CONTENTOS_RECONCILIATION_ALERT_URL:"https://alerts.example.invalid/hook"}},fetch:async()=>{delivered++;return new Response(null,{status:respond?200:503});}
    });
    await worker.reconcileTopups();
    assert.equal((await pool.query("SELECT status FROM contentos_app.ai_topup_purchases WHERE id=$1",[expired.id])).rows[0].status,"expired");
    assert.equal((await pool.query("SELECT status FROM contentos_app.ai_topup_purchases WHERE id=$1",[paid.id])).rows[0].status,"revoked");
    for(let i=1;i<8;i++){
      await pool.query("UPDATE contentos_app.ai_topup_reconciliation_jobs SET next_attempt_at=now()-interval '1 second' WHERE purchase_id=$1",[missing.id]);
      await worker.reconcileTopups();
    }
    const job=(await pool.query("SELECT * FROM contentos_app.ai_topup_reconciliation_jobs WHERE purchase_id=$1",[missing.id])).rows[0];
    assert.equal(job.attempts,8);assert.equal(job.state,"attention");assert.ok(delivered>=1);
    respond=true;await worker.deliverTopupAlerts();
    assert.ok((await pool.query("SELECT delivered_at FROM contentos_app.ai_topup_reconciliation_alerts WHERE purchase_id=$1",[missing.id])).rows[0].delivered_at);
    assert.equal((await pool.query("SELECT status FROM contentos_app.ai_topup_purchases WHERE id=$1",[missing.id])).rows[0].status,"preparing");
  });
  async function topupPayment() {
    const topup=loadTs("lib/ai-topup-payments.ts",mocks),p=await account({plan:"pro_creator",subscription_status:"active"});
    const row=await topup.prepareTopup(p.id,"starter",randomUUID());
    const pi=`pi_${randomUUID().replaceAll('-','')}`,sid=`cs_test_${randomUUID().replaceAll('-','')}`;
    const session={livemode:false,id:sid,mode:"payment",status:"complete",payment_status:"paid",amount_total:500,amount_subtotal:500,currency:"gbp",payment_intent:pi,client_reference_id:p.id,
      metadata:{offer:"prepaid_text_2026",purchase_id:row.id,user_id:p.id,attempt_key:row.attempt_key},total_details:{amount_discount:0},line_items:{has_more:false,data:[{quantity:1,amount_total:500,price:{currency:"gbp",unit_amount:500,type:"one_time"}}]}};
    const intent={livemode:false,id:pi,status:"succeeded",amount:500,amount_received:500,currency:"gbp",latest_charge:{id:"ch_test",paid:true,refunded:false,disputed:false,amount_refunded:0}};
    return {topup,p,row,session,intent};
  }
  function topupReviewer(x,intent,disputes=[],onRead=async()=>{}) {
    return loadTs("lib/ai-topup-review.ts",{...mocks,"@/lib/auth":{isAdminEmail:e=>e==="admin@example.invalid"},"@/lib/stripe-rest":{
      retrieveCheckoutSession:async()=>x.session,retrievePaidLifetimePaymentIntent:async()=>intent,
      retrieveLifetimeDisputes:async()=>{await onRead();return disputes;}
    }});
  }
  const adminIdentity={id:"admin-audit",email:"admin@example.invalid"};
  await check("partial top-up refunds freeze only the affected package; auditable review survives reconciliation and monthly aging",async()=>{
    const x=await topupPayment();await x.topup.fulfillTopup(x.row.id,x.session,x.intent);
    const credits=loadTs("lib/ai-topup-credit-ledger.ts",mocks),transaction=loadTs("lib/commercial-ledger.ts",mocks).commercialTransaction;
    await transaction(async c=>{await credits.reserveTopupCredit(c,x.p.id,"used-before-refund");await credits.finishTopupCredit(c,x.p.id,"used-before-refund",true,true);});
    const partial={...x.intent,latest_charge:{...x.intent.latest_charge,amount_refunded:100}};
    await x.topup.reverseTopup(x.intent.id,"evt_partial","charge.refunded",{reason:"review",key:"refund:100"});
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
    const reviewer=topupReviewer(x,partial);
    await assert.rejects(reviewer.reviewTopup(x.row.id,{id:"bad",email:"user@example.invalid"},"Reviewed partial refund","reinstate"));
    await reviewer.reviewTopup(x.row.id,adminIdentity,"Keep frozen pending evidence","retain_freeze");
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
    const stale=await reviewer.getTopupDecisionRevision(x.row.id);
    await reviewer.reviewTopup(x.row.id,adminIdentity,"Approved remaining unused credits","reinstate");
    await assert.rejects(x.topup.fulfillTopup(x.row.id,x.session,partial,stale));
    await x.topup.fulfillTopup(x.row.id,x.session,partial,await reviewer.getTopupDecisionRevision(x.row.id));
    await x.topup.reverseTopup(x.intent.id,"evt_delayed_partial","charge.refunded",{reason:"review",key:"refund:100"});
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,24);
    await pool.query("UPDATE contentos_app.ai_topup_purchases SET created_at=now()-interval '3 years' WHERE id=$1",[x.row.id]);
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,24);
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.ai_topup_ledger WHERE purchase_id=$1 AND action='grant'",[x.row.id])).rows[0].count,"1");
    const audit=(await pool.query("SELECT * FROM contentos_app.ai_topup_adjudications WHERE purchase_id=$1 ORDER BY created_at",[x.row.id])).rows;
    assert.equal(audit.length,2);assert.equal(audit[1].administrator_id,adminIdentity.id);assert.ok(audit[1].created_at);assert.equal(audit[1].decision,"reinstate");
    for(const verb of ["DELETE FROM","UPDATE"])await assert.rejects(runtimePool.query(verb==="UPDATE"?"UPDATE contentos_app.ai_topup_adjudications SET reason='tamper'":"DELETE FROM contentos_app.ai_topup_adjudications"),e=>e.code==="42501");
    await x.topup.reverseTopup(x.intent.id,"evt_larger_partial","charge.refunded",{reason:"review",key:"refund:200"});
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
  });
  await check("won disputes require explicit review; lost/open disputes and full refunds never auto-reinstate",async()=>{
    const x=await topupPayment();await x.topup.fulfillTopup(x.row.id,x.session,x.intent);
    const d={id:"du_policy",status:"needs_response",payment_intent:x.intent.id,charge:"ch_test"};
    await x.topup.reverseTopup(x.intent.id,"evt_dispute","charge.dispute.created",{reason:"dispute",key:"dispute:du_policy:needs_response"});
    for(const status of ["needs_response","lost"])await assert.rejects(topupReviewer(x,x.intent,[{...d,status}]).reviewTopup(x.row.id,adminIdentity,"Review provider dispute outcome","reinstate"));
    const won={...d,status:"won"},disputed={...x.intent,latest_charge:{...x.intent.latest_charge,disputed:true}};
    await x.topup.fulfillTopup(x.row.id,x.session,disputed,undefined,[won]);
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
    const reviewer=topupReviewer(x,disputed,[won]);
    await reviewer.reviewTopup(x.row.id,adminIdentity,"Verified won dispute in Stripe","reinstate");
    await x.topup.fulfillTopup(x.row.id,x.session,disputed,await reviewer.getTopupDecisionRevision(x.row.id),[won]);
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,25);
    await x.topup.reverseTopup(x.intent.id,"evt_dispute","charge.refunded",{reason:"full_refund",key:"full_refund"});
    await x.topup.fulfillTopup(x.row.id,x.session,x.intent);
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).history[0].status,"revoked");
    await assert.rejects(reviewer.reviewTopup(x.row.id,adminIdentity,"Try to undo full refund","reinstate"));
  });
  await check("refund racing review aborts approval; reversal before grant can only be restored by reviewed evidence",async()=>{
    const x=await topupPayment(),partial={...x.intent,latest_charge:{...x.intent.latest_charge,amount_refunded:100}};
    await x.topup.reverseTopup(x.intent.id,"evt_before","charge.refunded",{reason:"review",key:"refund:100"});
    await x.topup.fulfillTopup(x.row.id,x.session,partial);
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
    await topupReviewer(x,partial).reviewTopup(x.row.id,adminIdentity,"Reviewed partial refund before issuance","reinstate");
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,25);
    await x.topup.reverseTopup(x.intent.id,"evt_next","charge.refunded",{reason:"review",key:"refund:200"});
    const reviewer=topupReviewer(x,{...partial,latest_charge:{...partial.latest_charge,amount_refunded:200}},[],async()=>{
      await x.topup.reverseTopup(x.intent.id,"evt_race_full","charge.refunded",{reason:"full_refund",key:"full_refund"});
    });
    await assert.rejects(reviewer.reviewTopup(x.row.id,adminIdentity,"Concurrent refund during review","reinstate"));
    assert.equal((await x.topup.topupAccountSummary(x.p.id)).available,0);
    assert.equal((await pool.query("SELECT count(*) FROM contentos_app.ai_topup_adjudications WHERE purchase_id=$1",[x.row.id])).rows[0].count,"1");
  });
  if(process.env.CONTENTOS_LOCAL_ALERT_TLS_DIR)await check("real localhost HTTPS alert failure retries and records acknowledgement; authenticated cron dispatch is protected",async()=>{
    const tlsDir=process.env.CONTENTOS_LOCAL_ALERT_TLS_DIR;
    let accepted=false;const deliveries=[];
    const server=createServer({key:readFileSync(join(tlsDir,"key.pem")),cert:readFileSync(join(tlsDir,"cert.pem"))},(req,res)=>{
      let body="";req.on("data",chunk=>{body+=chunk;});req.on("end",()=>{deliveries.push(JSON.parse(body));res.writeHead(accepted?204:503);res.end();});
    });
    server.listen(0,"127.0.0.1");await once(server,"listening");
    try {
      await pool.query("UPDATE contentos_app.ai_topup_reconciliation_alerts SET delivered_at=now()");
      await pool.query("UPDATE contentos_app.lifetime_reconciliation_alerts SET delivered_at=now()");
      const x=await topupPayment();
      await pool.query("INSERT INTO contentos_app.ai_topup_reconciliation_alerts(purchase_id,code) VALUES($1,'local_delivery_probe')",[x.row.id]);
      const alertUrl=`https://127.0.0.1:${server.address().port}/alerts`;
      const worker=loadTs("lib/ai-topup-reconciliation.ts",mocks,new Map(),{process:{env:{CONTENTOS_RECONCILIATION_ALERT_URL:alertUrl}},fetch:globalThis.fetch});
      let ticks=0;
      const cron=loadTs("app/api/lifetime/reconcile/route.ts",{
        "@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{fulfillmentEnabled:false}},"@/lib/paid-lifetime-reconciliation":{},
        "@/lib/ai-topup-offer":{AI_TOPUP_OFFER:{fulfillmentEnabled:true}},
        "@/lib/ai-topup-reconciliation":{reconcileTopups:async()=>{ticks++;return worker.deliverTopupAlerts();}}
      },new Map(),{process:{env:{CRON_SECRET:"isolated-cron-test"}}});
      assert.equal((await cron.GET(new Request("https://example.invalid/api/lifetime/reconcile"))).status,401);assert.equal(ticks,0);
      const tick=()=>cron.GET(new Request("https://example.invalid/api/lifetime/reconcile",{headers:{authorization:"Bearer isolated-cron-test"}}));
      await tick();
      let alert=(await pool.query("SELECT * FROM contentos_app.ai_topup_reconciliation_alerts WHERE purchase_id=$1",[x.row.id])).rows[0];
      assert.equal(alert.delivered_at,null);assert.equal(alert.delivery_attempts,1);
      accepted=true;await new Promise(resolve=>setTimeout(resolve,25));await tick();
      alert=(await pool.query("SELECT * FROM contentos_app.ai_topup_reconciliation_alerts WHERE purchase_id=$1",[x.row.id])).rows[0];
      assert.ok(alert.delivered_at);assert.equal(alert.delivery_attempts,2);assert.equal(ticks,2);
      assert.deepEqual(deliveries,[{kind:"topup_reconciliation",purchaseId:x.row.id,code:"local_delivery_probe"},{kind:"topup_reconciliation",purchaseId:x.row.id,code:"local_delivery_probe"}]);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  });
  console.log(`All ${count} isolated PostgreSQL checks passed. No Stripe/AI network calls.`);
} finally {
  await pool.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();rmSync(dir,{recursive:true,force:true});
}
