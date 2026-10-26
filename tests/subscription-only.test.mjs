import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { loadTs, createImageHarness } from "./image-test-helpers.mjs";

test("cancelled Lifetime product has no route, marketing, adapter or migration", () => {
  for (const path of ["app/api/billing/lifetime-checkout/route.ts", "app/lifetime-terms/page.tsx", "lib/lifetime-payment.ts", "lib/lifetime-access.ts", "lib/lifetime-stripe.ts", "lib/lifetime-capacity.ts"]) assert.equal(existsSync(path),false,path);
  for (const path of ["app/pricing/page.tsx", "app/studio/page.tsx", "app/dashboard/page.tsx", "components/studio-shell.tsx"]) assert.doesNotMatch(readFileSync(path,"utf8"), /Lifetime Access|£49|nonRenewing|one-time text credits/);
  const migration=readFileSync("drizzle/0003_commercial_spending.sql","utf8");
  assert.doesNotMatch(migration,/lifetime|DROP|DELETE|UPDATE contentos_app.profiles/i);
  assert.equal((migration.match(/CREATE TABLE /g)||[]).length,3);
});

test("subscription checkout preserves Creator/Studio, suspends new Lite and rejects a forged Lifetime plan",async()=>{
  const calls=[];
  const {POST}=loadTs("app/api/billing/checkout/route.ts",{
    "server-only":{},"next/server":{NextResponse:Response},
    "@/lib/request-security":{rejectUnsafeWrite:()=>null},
    "@/lib/auth":{getCurrentUser:async()=>({id:"synthetic-user",email:"synthetic@example.invalid"})},
    "@/lib/backend":{isDatabaseConfigured:()=>true,isAuthConfigured:()=>true},
    "@/lib/repository":{getUserProfileForUser:async()=>({id:"synthetic-user",plan:"free",subscription_status:"none"}),syncUserSubscriptionState:async()=>{}},
    "@/lib/founder-claim-repository":{},
    "@/lib/stripe-rest":{getStripeSubscriptionState:async()=>({plan:"free",status:"none"}),reconcileActiveSubscriptionPlan:s=>s,checkoutPlanIsCoveredByState:()=>false,hasActiveUnknownPaidSubscription:()=>false,createCheckoutSession:async input=>{calls.push(input);return {url:"https://checkout.stripe.com/synthetic"};}}
  });
  const send=plan=>POST(new Request("https://example.invalid/api/billing/checkout",{method:"POST",body:JSON.stringify({plan})}));
  assert.equal((await send("lite")).status,503);
  for(const plan of ["pro_creator","pro_studio"]) assert.equal((await send(plan)).status,200);
  assert.equal((await send("lifetime_access")).status,400);
  assert.deepEqual(calls.map(c=>c.plan),["pro_creator","pro_studio"]);
  assert.ok(calls.every(c=>c.founderOffer===false&&c.userId==="synthetic-user"));
});

test("profile mutations retain historical unknown fields and existing lifetime benefits",async()=>{
  for(const protection of [{plan:"founder",subscription_status:"active",entitlement_source:"founder_offer"},{plan:"pro_studio",subscription_status:"active",entitlement_source:"owner_complimentary_lifetime",subscription_current_period_end:null}]){
    const h=createImageHarness({profile:{...protection,historical_lifetime_record:{reference:"synthetic-history",preserve:true},workspace:{draft:"keep"}}});
    const before=structuredClone(h.data);
    await h.repository.updateSubscriptionStatus({userId:"user-test",plan:"free",status:"canceled"});
    assert.deepEqual(h.data,before);
  }
});

test("shared Stripe signature protection accepts rotation and refuses stale, forged or malformed delivery",()=>{
  const secret="synthetic-secret",payload=JSON.stringify({type:"customer.subscription.updated"});
  const {verifyStripeSignature}=loadTs("lib/stripe-rest.ts",{"@/lib/env":{getEnv:()=>({stripeWebhookSecret:secret})}});
  const time=Math.floor(Date.now()/1000);
  const signature=t=>createHmac("sha256",secret).update(`${t}.${payload}`).digest("hex");
  assert.equal(verifyStripeSignature(payload,`t=${time},v1=${"0".repeat(64)},v1=${signature(time)}`),true);
  for(const header of [null,"invalid",`t=1,v1=${signature(1)}`,`t=${time+600},v1=${signature(time+600)}`,`t=${time},t=${time},v1=${signature(time)}`,`t=${time},v1=not-hex`]) assert.equal(verifyStripeSignature(payload,header),false);
  assert.equal(verifyStripeSignature(payload+" ",`t=${time},v1=${signature(time)}`),false);
});
