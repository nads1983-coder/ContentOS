import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";

test("reconciliation requires a secret even when fulfillment is disabled",async()=>{
  for(const enabled of [false,true]){
    let runs=0;
    const {GET}=loadTs("app/api/lifetime/reconcile/route.ts",{
      "@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{fulfillmentEnabled:enabled}},
      "@/lib/paid-lifetime-reconciliation":{reconcileLifetimeCheckouts:async()=>{runs++;return {checked:1};}}
    },new Map(),{process:{env:{CRON_SECRET:"synthetic-cron-secret"}}});
    const send=auth=>GET(new Request("https://example.invalid/api/lifetime/reconcile",{headers:auth?{authorization:auth}:{}}));
    assert.equal((await send()).status,401);assert.equal((await send("Bearer wrong")).status,401);
    assert.equal((await send("Bearer synthetic-cron-secret")).status,200);assert.equal(runs,Number(enabled));
  }
});

test("enabled lifetime route rejects anonymous, existing subscriptions and old open subscription checkouts; ignores browser identity/price",async()=>{
  for(const scenario of ["anonymous","active","pending","new"]){
    const calls=[];
    const {POST}=loadTs("app/api/lifetime/checkout/route.ts",{
      "next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
      "@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{checkoutEnabled:true}},
      "@/lib/auth":{getCurrentUser:async()=>scenario==="anonymous"?null:{id:"actual-user",email:"actual@example.invalid"}},
      "@/lib/repository":{getUserProfileForUser:async()=>({id:"actual-user",plan:"free",subscription_status:"none",stripe_customer_id:"cus_test"}),syncUserSubscriptionState:async()=>{}},
      "@/lib/paid-lifetime-reservations":{},"@/lib/paid-lifetime-reconciliation":{reconcileLifetimeCheckouts:async()=>{}},
      "@/lib/paid-lifetime-checkout-service":{startPaidLifetimeCheckout:async input=>{calls.push(input);return {url:"https://checkout.stripe.com/test"};}},
      "@/lib/stripe-rest":{getStripeSubscriptionState:async()=>({status:scenario==="active"?"active":"canceled",stripeCustomerId:"cus_test"}),hasPendingSubscriptionCheckout:async()=>scenario==="pending"}
    });
    const response=await POST(new Request("https://example.invalid/api/lifetime/checkout",{method:"POST",body:JSON.stringify({userId:"attacker",pricePence:1})}));
    assert.equal(response.status,scenario==="anonymous"?401:scenario==="new"?200:409);
    if(scenario==="new")assert.deepEqual(calls,[{userId:"actual-user",email:"actual@example.invalid",customerId:"cus_test"}]);else assert.equal(calls.length,0);
  }
});

test("refund and all dispute lifecycle webhooks retain unmatched events and retry persistence failure",async()=>{
  for(const type of ["charge.refunded","charge.dispute.created","charge.dispute.updated","charge.dispute.closed"]){
    for(const fail of [false,true]){
      const calls=[];
      const {POST}=loadTs("app/api/billing/webhook/route.ts",{
        "next/server":{NextResponse:Response},"@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{fulfillmentEnabled:true}},
        "@/lib/stripe-rest":{verifyStripeSignature:()=>true,retrievePaidLifetimePaymentIntent:async()=>({latest_charge:{refunded:type==="charge.refunded"}})},
        "@/lib/repository":{},"@/lib/founder-claim-repository":{},"@/lib/founder-checkout-service":{},"@/lib/paid-lifetime-reservations":{},
        "@/lib/paid-lifetime-fulfillment":{reversePaidCreatorLifetimePurchase:async(...args)=>{calls.push(args);if(fail)throw Error("db unavailable");return {status:"retained"};}}
      },new Map(),{console:{error(){},log(){}}});
      const response=await POST(new Request("https://example.invalid/api/billing/webhook",{method:"POST",body:JSON.stringify({id:"evt_test",type,data:{object:{payment_intent:"pi_test"}}})}));
      assert.equal(response.status,fail?503:200);assert.deepEqual(calls,[["pi_test",type==="charge.refunded"?"refunded":"disputed","evt_test",type]]);
    }
  }
});

test("historical unpaid recurring checkout blocks only until its subscription is definitively ended",async()=>{
  for(const status of ["processing","active","canceled","incomplete_expired"]){
    const {hasPendingSubscriptionCheckout}=loadTs("lib/stripe-rest.ts",{
      "@/lib/env":{isStripeConfigured:()=>true,getEnv:()=>({stripeSecretKey:"synthetic"})}
    },new Map(),{fetch:async url=>Response.json(String(url).includes("checkout/sessions")?
      {has_more:false,data:[{id:"cs_old",mode:"subscription",status:"complete",payment_status:"unpaid",subscription:"sub_old"}]}:
      {id:"sub_old",status})});
    assert.equal(await hasPendingSubscriptionCheckout("cus_test"),!["canceled","incomplete_expired"].includes(status));
  }
});

test("an interrupted lost-session search stops before contacting Stripe",async()=>{
  let calls=0;
  const {findLifetimeCheckoutSessions}=loadTs("lib/stripe-rest.ts",{
    "@/lib/env":{isStripeConfigured:()=>true,getEnv:()=>({stripeSecretKey:"synthetic"})}
  },new Map(),{fetch:async()=>{calls++;throw Error("unexpected provider call");}});
  const controller=new AbortController();controller.abort();
  await assert.rejects(findLifetimeCheckoutSessions({id:"purchase",attemptKey:"attempt",createdAt:"2026-11-08T00:00:00Z"},controller.signal));
  assert.equal(calls,0);
});
