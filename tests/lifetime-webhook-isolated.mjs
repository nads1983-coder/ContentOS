import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { Pool } from "pg";
import { loadTs } from "./image-test-helpers.mjs";

assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH,"br-divine-term-b2rihbxv");
assert.match(new URL(process.env.DATABASE_URL).hostname,/^ep-proud-field-b291xbnc(?:-pooler)?\.c-6\.eu-central-1\.aws\.neon\.tech$/);
for(const key of ["OPENAI_API_KEY","STRIPE_SECRET_KEY","RESEND_API_KEY"])assert.ok(!process.env[key]);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});
const prefix=`lifetime-signed-${randomUUID()}`,account=prefix,other=prefix+"-other",secret="isolated-signing-fixture";
let failCommit=false;
const guardedPool={connect:async()=>{
  const client=await pool.connect();return {release:()=>client.release(),query:async(sql,args)=>{
    if(failCommit && sql.includes("SET state='paid',checkout_session_id")){failCommit=false;throw Error("Synthetic transaction interruption");}
    return client.query(sql,args);
  }};
},query:(...args)=>pool.query(...args)};
const sessions=new Map(),byId=new Map(),price={id:"price_isolated",active:true,currency:"gbp",unit_amount:4900,type:"one_time",livemode:false};
let disputes=[];
const mocks={"server-only":{},"next/server":{NextResponse:Response},"@/lib/db/client":{getPool:()=>guardedPool},
  "@/lib/env":{getEnv:()=>({appUrl:"https://synthetic.invalid",stripeSecretKey:"not-a-real-key",stripeWebhookSecret:secret}),isStripeConfigured:()=>true},
  "@/lib/repository":{updateSubscriptionStatus:async()=>{throw Error("Lifetime incorrectly entered subscription path");}},
  "@/lib/founder-claim-repository":{founderClaimRepository:{}}
};
const runtime={process:{env:{STRIPE_LIFETIME_PRICE_ID:price.id,STRIPE_LIFETIME_MODE:"test"}},console:{warn(){},error(){},log(){}},fetch:async(url,init)=>{
  const u=new URL(url);assert.equal(u.origin,"https://api.stripe.com");let result;
  if(u.pathname==="/v1/prices/price_isolated")result=price;
  else if(u.pathname==="/v1/customers/cus_isolated")result={id:"cus_isolated",metadata:{user_id:account}};
  else if(u.pathname==="/v1/subscriptions")result={data:[],has_more:false};
  else if(u.pathname==="/v1/checkout/sessions" && init.method==="POST"){
    const b=init.body,key=init.headers["Idempotency-Key"];
    if(!sessions.has(key)){
      const s={id:`cs_${randomUUID().replaceAll("-","")}`,mode:"payment",status:"open",payment_status:"unpaid",currency:"gbp",amount_total:4900,
        client_reference_id:b.get("client_reference_id"),metadata:{purchase:b.get("metadata[purchase]"),user_id:b.get("metadata[user_id]"),attempt_id:b.get("metadata[attempt_id]")},
        customer:"cus_isolated",subscription:null,url:"https://checkout.stripe.com/c/pay/isolated",expires_at:Math.floor(Date.now()/1000)+1800,livemode:false,
        line_items:{data:[{quantity:1,price:{id:price.id}}],has_more:false},payment_intent:null};sessions.set(key,s);byId.set(s.id,s);
    }
    result={id:sessions.get(key).id};
  } else if(u.pathname.startsWith("/v1/checkout/sessions/"))result=byId.get(u.pathname.split("/").at(-1));
  else if(u.pathname==="/v1/checkout/sessions")result={data:[...byId.values()].filter(s=>s.payment_intent?.id===u.searchParams.get("payment_intent")).map(s=>({id:s.id})),has_more:false};
  else if(u.pathname.startsWith("/v1/payment_intents/"))result=[...byId.values()].find(s=>s.payment_intent?.id===u.pathname.split("/").at(-1))?.payment_intent;
  else if(u.pathname==="/v1/disputes")result={data:disputes,has_more:false};
  else throw Error(`Unexpected mock request ${u.pathname}`);
  assert.ok(result);return Response.json(result);
}};
const cache=new Map(),payment=loadTs("lib/lifetime-payment.ts",mocks,cache,runtime),adapter=loadTs("lib/lifetime-stripe.ts",mocks,cache,runtime);
const route=loadTs("app/api/billing/webhook/route.ts",mocks,cache,runtime),ledger=loadTs("lib/commercial-ledger.ts",mocks,cache,runtime);
const {assertLifetimeSalesCapacity}=loadTs("lib/lifetime-capacity.ts",{...mocks,"@/lib/lifetime-access":{LIFETIME_INITIAL_SALES_LIMIT:1}});
let n=0;
async function send(s,type="checkout.session.completed",paymentId) {
  const event={id:`${prefix}-${n++}`,type,livemode:false,data:{object:paymentId?{id:"ch_isolated",payment_intent:paymentId}:{id:s.id,mode:"payment",metadata:s.metadata}}};
  const body=JSON.stringify(event),time=Math.floor(Date.now()/1000),signature=createHmac("sha256",secret).update(`${time}.${body}`).digest("hex");
  return route.POST(new Request("https://synthetic.invalid/api/billing/webhook",{method:"POST",headers:{"stripe-signature":`t=${time},v1=${signature}`},body}));
}
const getProfile=async id=>(await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1",[id])).rows[0].data;
try {
  for(const id of [account,other])await pool.query("INSERT INTO contentos_app.profiles(id,email,data) VALUES($1,$2,$3::jsonb)",[id,`${id}@example.invalid`,JSON.stringify({id,email:`${id}@example.invalid`,plan:"free",subscription_status:"none",stripe_customer_id:"cus_isolated",private_test_marker:prefix,generation_history_json:[{id:"preserved"}]})]);
  const untouched=await getProfile(other);
  await Promise.all([payment.prepareLifetimePurchase(account,adapter.lifetimeStripeProvider,assertLifetimeSalesCapacity),payment.prepareLifetimePurchase(account,adapter.lifetimeStripeProvider,assertLifetimeSalesCapacity)]);
  await assert.rejects(()=>payment.prepareLifetimePurchase(other,adapter.lifetimeStripeProvider,assertLifetimeSalesCapacity));
  assert.equal(sessions.size,1);
  await payment.prepareLifetimePurchase(account,adapter.lifetimeStripeProvider);assert.equal(sessions.size,1);
  const s=[...sessions.values()][0];assert.equal((await send(s)).status,200);assert.equal((await getProfile(account)).lifetime_access,undefined);
  s.status="complete";s.payment_status="paid";s.payment_intent={id:`pi_${randomUUID().replaceAll("-","")}`,metadata:s.metadata,livemode:false,status:"succeeded",amount_received:4900,currency:"gbp",customer:"cus_isolated",latest_charge:{id:"ch_isolated",paid:true,refunded:false,amount_refunded:0,disputed:false,payment_intent:null,customer:"cus_isolated",amount:4900,currency:"gbp",livemode:false}};
  s.payment_intent.latest_charge.payment_intent=s.payment_intent.id;
  failCommit=true;assert.equal((await send(s)).status,500);assert.equal((await getProfile(account)).lifetime_access,undefined);
  assert.equal((await pool.query("SELECT state FROM contentos_app.lifetime_purchases WHERE account_id=$1",[account])).rows[0].state,"open");
  const responses=await Promise.all([send(s),send(s,"checkout.session.async_payment_succeeded")]);assert.ok(responses.every(r=>r.status===200));
  assert.equal((await ledger.getLifetimeBalance(account)).text,12);
  assert.equal(Number((await pool.query("SELECT count(*) n FROM contentos_app.lifetime_payment_events WHERE payment_intent_id=$1 AND event_type='completed'",[s.payment_intent.id])).rows[0].n),1);
  await assert.rejects(()=>payment.prepareLifetimePurchase(account,adapter.lifetimeStripeProvider));
  const quote=loadTs("lib/ai-cost.ts").quoteAI("text",{model:"gpt-4.1",input:"isolated mock",max_output_tokens:24000});
  await ledger.reserveCommercial(account,"synthetic-delivery",quote,data=>({data,result:{status:"reserved"}}));
  await ledger.dispatchCommercial(account,"synthetic-delivery",quote);await ledger.settleCommercialUsage(account,"synthetic-delivery",quote,{input_tokens:1,output_tokens:1});
  await ledger.finishCommercial(account,"synthetic-delivery",quote,true,data=>({data,result:null}));assert.equal((await ledger.getLifetimeBalance(account)).text,11);
  s.payment_intent.latest_charge.disputed=true;disputes=[{status:"needs_response"}];assert.equal((await send(s,"charge.dispute.created",s.payment_intent.id)).status,200);assert.equal(await ledger.getLifetimeBalance(account),null);
  disputes=[{status:"won"}];assert.equal((await send(s,"charge.dispute.closed",s.payment_intent.id)).status,200);assert.equal((await ledger.getLifetimeBalance(account)).text,11);
  assert.equal((await send(s,"charge.dispute.created",s.payment_intent.id)).status,200);assert.equal((await ledger.getLifetimeBalance(account)).text,11);
  await assert.rejects(()=>payment.reconcileLifetimePayment(`${prefix}-stale-race`,s.payment_intent.id,"dispute",{accountId:account,attemptId:s.metadata.attempt_id,version:"2000-01-01T00:00:00Z"}));
  assert.equal((await ledger.getLifetimeBalance(account)).text,11);
  s.payment_intent.latest_charge.amount_refunded=100;assert.equal((await send(s,"charge.refunded",s.payment_intent.id)).status,200);assert.equal(await ledger.getLifetimeBalance(account),null);
  await send(s);assert.equal(await ledger.getLifetimeBalance(account),null);
  assert.deepEqual((await getProfile(account)).generation_history_json,[{id:"preserved"}]);assert.deepEqual(await getProfile(other),untouched);
  console.log("PASS: actual signed webhook + Stripe adapter + isolated Neon: concurrent checkout, delayed payment, transactional rollback/500/retry, exactly-once credits, dispute recovery without reset, stale delivery, partial refund, account/history isolation. No live Stripe/provider calls.");
} finally {
  await pool.query("DELETE FROM contentos_app.lifetime_payment_events WHERE event_id LIKE $1",[`${prefix}%`]);
  await pool.query("DELETE FROM contentos_app.lifetime_purchases WHERE account_id=ANY($1::text[])",[[account,other]]);
  await pool.query("DELETE FROM contentos_app.ai_spend_requests WHERE account_id=ANY($1::text[])",[[account,other]]);
  await pool.query("DELETE FROM contentos_app.profiles WHERE id=ANY($1::text[]) AND data->>'private_test_marker'=$2",[[account,other],prefix]);
  await pool.end();
}
