import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { loadTs } from "./image-test-helpers.mjs";

const secret="synthetic-webhook-secret-not-a-credential";
const price={id:"price_synthetic",active:true,currency:"gbp",unit_amount:4900,type:"one_time",livemode:false};
const account="synthetic-account",attempt="synthetic-attempt";
const meta={purchase:"lifetime_access_v1",user_id:account,attempt_id:attempt};
const session=()=>({id:"cs_synthetic",mode:"payment",status:"complete",payment_status:"paid",currency:"gbp",amount_total:4900,client_reference_id:account,metadata:meta,customer:"cus_synthetic",subscription:null,url:"https://checkout.stripe.com/c/pay/synthetic",expires_at:Math.floor(Date.now()/1000)+1800,livemode:false,line_items:{data:[{quantity:1,price:{id:price.id}}]},payment_intent:{id:"pi_synthetic",status:"succeeded",amount_received:4900,currency:"gbp",customer:"cus_synthetic",livemode:false,metadata:meta,latest_charge:{id:"ch_synthetic",paid:true,refunded:false,amount_refunded:0,disputed:false,payment_intent:"pi_synthetic",customer:"cus_synthetic",amount:4900,currency:"gbp",livemode:false}}});

function harness() {
  const calls=[],mutations=[],cache=new Map();
  const h={session:session(),price:{...price},subscriptions:[],disputes:[],customers:[],fail:false,dbFail:false,bound:true};
  const mocks={"server-only":{},"next/server":{NextResponse:Response},
    "@/lib/env":{getEnv:()=>({appUrl:"https://test.invalid",stripeSecretKey:"synthetic",stripeWebhookSecret:secret}),isStripeConfigured:()=>true},
    "@/lib/commercial-ledger":{commercialTransaction:async fn=>{if(h.dbFail)throw Error("synthetic database unavailable");return fn({query:async(sql,params)=>{
      if(sql.includes("JOIN contentos_app.profiles"))return {rows:h.bound?[{checkout_session_id:"cs_synthetic",payment_intent_id:null,customer:"cus_synthetic",version:"2026-10-21T00:00:00Z"}]:[],rowCount:h.bound?1:0};
      mutations.push({sql,params});return {rows:[],rowCount:1};
    }});}},
    "@/lib/repository":{updateSubscriptionStatus:async()=>{throw Error("One-time purchase reached subscription fallback");}},
    "@/lib/founder-claim-repository":{founderClaimRepository:{}}
  };
  const runtime={process:{env:{STRIPE_LIFETIME_PRICE_ID:price.id,STRIPE_LIFETIME_MODE:"test"}},console:{log(){},warn(){},error(){}},fetch:async(url,init)=>{
    const u=new URL(url);assert.equal(u.origin,"https://api.stripe.com");calls.push({path:u.pathname,query:u.searchParams,init});
    if(h.fail)throw Error("synthetic Stripe failure");
    let result;
    if(u.pathname==="/v1/prices/price_synthetic")result=h.price;
    else if(u.pathname==="/v1/customers/cus_synthetic")result={id:"cus_synthetic",metadata:{user_id:account}};
    else if(u.pathname==="/v1/customers")result={data:h.customers,has_more:false};
    else if(u.pathname==="/v1/subscriptions")result={data:h.subscriptions,has_more:false};
    else if(u.pathname==="/v1/checkout/sessions/cs_synthetic")result=h.session;
    else if(u.pathname==="/v1/checkout/sessions")result=init.method==="POST"?{id:"cs_synthetic"}:{data:[{id:"cs_synthetic"}],has_more:false};
    else if(u.pathname==="/v1/payment_intents/pi_synthetic")result=h.session.payment_intent;
    else if(u.pathname==="/v1/disputes")result={data:h.disputes,has_more:false};
    else throw Error(`Unexpected mocked path ${u.pathname}`);
    return Response.json(result);
  }};
  const core=loadTs("lib/lifetime-payment.ts",mocks,cache,runtime);
  let fulfilled=0;
  mocks["@/lib/lifetime-payment"]={...core,fulfillLifetimePurchase:async(event,id,provider)=>{
    if(h.dbFail)throw Error("synthetic persistence failure");
    core.validateLifetimeSession(await provider.retrieve(id),account,attempt,await provider.price(),true);fulfilled++;
  },reconcileLifetimePayment:async(...args)=>{mutations.push(args);}};
  const adapter=loadTs("lib/lifetime-stripe.ts",mocks,cache,runtime);
  const route=loadTs("app/api/billing/webhook/route.ts",mocks,cache,runtime);
  const event=(type="checkout.session.completed")=>({id:"evt_synthetic",type,livemode:false,data:{object:{id:"cs_synthetic",mode:"payment",metadata:meta}}});
  const send=async(e=event(),options={})=>{
    const body=JSON.stringify(e),time=options.time??Math.floor(Date.now()/1000);
    const sig=createHmac("sha256",secret).update(`${time}.${body}`).digest("hex");
    return route.POST(new Request("https://test.invalid/api/billing/webhook",{method:"POST",headers:{"stripe-signature":options.bad?"invalid":`t=${time},v1=${"0".repeat(64)},v1=${sig}`},body}));
  };
  return Object.assign(h,{calls,mutations,adapter,send,event,getFulfilled:()=>fulfilled});
}

test("adapter creates server-priced GBP49 payment with stable idempotency, account and terms binding",async()=>{
  const h=harness();await h.adapter.lifetimeStripeProvider.create({accountId:account,attemptId:attempt,priceId:price.id,idempotencyKey:"logical-attempt",customerId:"cus_synthetic",email:"synthetic@example.invalid"});
  const post=h.calls.find(c=>c.init.method==="POST");assert.equal(post.init.headers["Idempotency-Key"],"logical-attempt");
  const body=post.init.body;
  for(const [key,value] of Object.entries({mode:"payment","line_items[0][price]":price.id,"line_items[0][quantity]":"1",customer:"cus_synthetic",client_reference_id:account,"metadata[attempt_id]":attempt,"payment_intent_data[metadata][user_id]":account,"consent_collection[terms_of_service]":"required"}))assert.equal(body.get(key),value);
  for(const key of ["allow_promotion_codes","discounts[0][coupon]","subscription_data","payment_method_types"])assert.equal(body.has(key),false);
  assert.ok(h.calls.at(-1).query.getAll("expand[]").includes("payment_intent.latest_charge"));
});
test("adapter refuses active Stripe subscriptions, ambiguous customers and price mismatch before creation",async()=>{
  const h=harness(),input={accountId:account,attemptId:attempt,priceId:price.id,idempotencyKey:"logical-attempt",customerId:"cus_synthetic",email:"synthetic@example.invalid"};
  h.subscriptions=[{status:"active"}];await assert.rejects(()=>h.adapter.lifetimeStripeProvider.create(input));
  await assert.rejects(()=>h.adapter.lifetimeStripeProvider.create({...input,priceId:"price_wrong"}));
  h.customers=[{id:"cus_other"}];await assert.rejects(()=>h.adapter.lifetimeStripeProvider.create({...input,customerId:undefined}));
  assert.equal(h.calls.filter(c=>c.init.method==="POST").length,0);
});
test("real webhook signature rejects missing, altered and old signatures before Stripe or DB; supports rotation",async()=>{
  const h=harness();assert.equal((await h.send(h.event(),{bad:true})).status,400);
  assert.equal((await h.send(h.event(),{time:1})).status,400);assert.equal(h.calls.length,0);
  assert.equal((await h.send()).status,200);assert.equal(h.getFulfilled(),1);
});
test("signed sync and asynchronous successes fulfill; unpaid and unrelated one-time payments never sync subscriptions",async()=>{
  const h=harness();assert.equal((await h.send()).status,200);assert.equal((await h.send(h.event("checkout.session.async_payment_succeeded"))).status,200);
  assert.equal(h.getFulfilled(),2);h.session.payment_status="unpaid";await h.send();assert.equal(h.getFulfilled(),2);
  assert.equal((await h.send(h.event("checkout.session.async_payment_succeeded"))).status,500);
  const unrelated=h.event();unrelated.data.object.metadata={};assert.equal((await h.send(unrelated)).status,200);assert.equal(h.getFulfilled(),2);
});
test("permanent amount, mode and binding rejection acknowledges without credits; infrastructure failures retry",async()=>{
  for(const patch of [{amount_total:4800},{client_reference_id:"other-account"},{livemode:true},{metadata:{...meta,attempt_id:"wrong"}}]){
    const h=harness();Object.assign(h.session,patch);assert.equal((await h.send()).status,200);assert.equal(h.getFulfilled(),0);
  }
  const h=harness();h.fail=true;assert.equal((await h.send()).status,500);h.fail=false;h.dbFail=true;assert.equal((await h.send()).status,500);h.dbFail=false;assert.equal((await h.send()).status,200);
  h.price.unit_amount=5000;assert.equal((await h.send()).status,500);
});
test("expired event uses current evidence and cannot expire a paid checkout",async()=>{
  const h=harness();await h.send(h.event("checkout.session.expired"));assert.equal(h.mutations.length,0);
  h.session.status="expired";h.session.payment_status="unpaid";await h.send(h.event("checkout.session.expired"));assert.equal(h.mutations.length,1);assert.match(h.mutations[0].sql,/state IN \('creating','open'\)/);
});
test("refund/dispute handling retrieves current Stripe evidence and binds account before any mutation",async()=>{
  const h=harness(),e=h.event("charge.refunded");e.data.object={id:"ch_synthetic",payment_intent:"pi_synthetic"};h.session.payment_intent.latest_charge.amount_refunded=100;
  assert.equal((await h.send(e)).status,200);assert.deepEqual(h.mutations.at(-1),["evt_synthetic","pi_synthetic","refund",{accountId:account,attemptId:attempt,version:"2026-10-21T00:00:00Z"}]);
  h.mutations.length=0;h.bound=false;await h.send(e);assert.equal(h.mutations.length,0);
  h.bound=true;h.session.payment_intent.metadata={};await h.send(e);assert.equal(h.mutations.length,0);
});
test("won dispute restores only after current evidence is clear; lost dispute remains suspended",async()=>{
  const h=harness(),e=h.event("charge.dispute.closed");e.data.object={id:"dp_synthetic",payment_intent:"pi_synthetic"};h.session.payment_intent.latest_charge.disputed=true;
  h.disputes=[{status:"lost"}];await h.send(e);assert.equal(h.mutations.at(-1)[2],"dispute");
  h.disputes=[{status:"won"}];await h.send(e);assert.equal(h.mutations.at(-1)[2],"clear");
  h.disputes=[];assert.equal((await h.send(e)).status,500);
});
test("sales proposal refuses unknown opening spend and deducts existing use and commitments",()=>{
  const {proposedLifetimeSales}=loadTs("lib/lifetime-capacity.ts");
  const x={reconciled:true,opening:0,currentReservations:0,outstandingLifetimeCommitments:0,protectedCustomerReserve:10_000_000};
  assert.equal(proposedLifetimeSales({...x,reconciled:false}).maximumSales,0);
  assert.equal(proposedLifetimeSales({...x,opening:null}).maximumSales,0);
  assert.equal(proposedLifetimeSales({...x,opening:11_000_000}).maximumSales,0);
  assert.equal(proposedLifetimeSales({...x,opening:5_000_000,currentReservations:1_000_000}).maximumSales,1);
  assert.equal(proposedLifetimeSales({...x,opening:5_000_000,currentReservations:1_000_000,outstandingLifetimeCommitments:10_000_000}).maximumSales,0);
});
test("checkout stays hard-disabled before auth or Stripe; approved-mode handler binds only authenticated account",async()=>{
  let user={id:account},calls=0;
  const mocks={"server-only":{},"next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
    "@/lib/auth":{getCurrentUser:async()=>user},"@/lib/lifetime-stripe":{lifetimeStripeProvider:{}},
    "@/lib/lifetime-payment":{LifetimePaymentRejected:class extends Error{},prepareLifetimePurchase:async id=>{calls++;assert.equal(id,account);return {url:"https://checkout.stripe.com/synthetic"};}}};
  const disabled=loadTs("app/api/billing/lifetime-checkout/route.ts",mocks);
  const request=id=>new Request("https://test.invalid/api/billing/lifetime-checkout",{method:"POST",headers:{"X-ContentOS-Account":id},body:JSON.stringify({price:1,userId:"attacker"})});
  assert.equal((await disabled.POST(request(account))).status,409);assert.equal(calls,0);
  const enabled=loadTs("app/api/billing/lifetime-checkout/route.ts",{...mocks,"@/lib/lifetime-access":{LIFETIME_CHECKOUT_ENABLED:true},"@/lib/lifetime-capacity":{assertLifetimeSalesCapacity:async()=>{}}});
  assert.equal((await enabled.POST(request("wrong"))).status,409);assert.equal(calls,0);
  user=null;assert.equal((await enabled.POST(request(account))).status,401);user={id:account};
  assert.equal((await enabled.POST(request(account))).status,200);assert.equal(calls,1);
});
test("unapproved initial sales capacity fails before reading or writing a database",async()=>{
  const {assertLifetimeSalesCapacity}=loadTs("lib/lifetime-capacity.ts");await assert.rejects(()=>assertLifetimeSalesCapacity({query:()=>assert.fail("Unexpected query")}));
});
