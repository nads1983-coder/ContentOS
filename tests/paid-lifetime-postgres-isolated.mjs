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
  await check("actual migration runner applies 0004–0008 exactly once over journal 0000–0002 plus externally managed 0003",async()=>{
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
    await runner();await runner();
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"8");
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
  console.log(`All ${count} isolated PostgreSQL checks passed. No Stripe/AI network calls.`);
} finally {
  await pool.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();rmSync(dir,{recursive:true,force:true});
}
