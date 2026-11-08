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
  await check("actual migration runner applies 0004 exactly once over journal 0000–0002 plus externally managed 0003",async()=>{
    await pool.query("CREATE TABLE contentos_app.paid_lifetime_payment_events(blocker text)");
    await assert.rejects(runner());
    assert.equal((await pool.query("SELECT to_regclass('contentos_app.paid_creator_lifetime_purchases') n")).rows[0].n,null);
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"3");
    await pool.query("DROP TABLE contentos_app.paid_lifetime_payment_events");
    await runner();await runner();
    assert.equal((await pool.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,"4");
    assert.deepEqual((await pool.query("SELECT * FROM contentos_app.ai_budget_configuration")).rows,budgetBefore);
    assert.deepEqual(await readProfile(founder.id),founder);
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
    await pool.query("TRUNCATE contentos_app.paid_creator_lifetime_purchases");
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
  await check("partial refund quarantine, dispute and full refund are monotonic; refunded slots never recycle",async()=>{
    const x=await payment();await fulfillment.completePaidCreatorLifetimePurchase(x.claim.id,x.session,x.intent);
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"review","evt_partial");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"review");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_dispute");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"refunded","evt_full");
    await fulfillment.reversePaidCreatorLifetimePurchase(x.intent.id,"disputed","evt_late_dispute");
    assert.equal((await readProfile(x.p.id)).paid_creator_lifetime_status,"refunded");
    const next=await payment();assert.notEqual(next.claim.earlyBirdSlot,x.claim.earlyBirdSlot);
    await assert.rejects(reservations.reservePaidLifetimePurchase(x.p.id,x.p.email));
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
  console.log(`All ${count} isolated PostgreSQL checks passed. No Stripe/AI network calls.`);
} finally {
  await pool.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();rmSync(dir,{recursive:true,force:true});
}
