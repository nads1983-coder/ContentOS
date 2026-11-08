import test from "node:test";
import assert from "node:assert/strict";
import {loadTs,createImageHarness} from "./image-test-helpers.mjs";
import {readFileSync} from "node:fs";
import ts from "typescript";
const lifetime={id:"user-test",email:"test@example.invalid",plan:"free",subscription_status:"none",paid_creator_lifetime_status:"active",paid_creator_lifetime_purchase_id:"purchase"};

test("direct recurring Creator checkout is refused for lifetime; deliberate Studio upgrade remains possible",async()=>{
  const calls=[];
  const {POST}=loadTs("app/api/billing/checkout/route.ts",{
    "server-only":{},"next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
    "@/lib/auth":{getCurrentUser:async()=>lifetime},"@/lib/backend":{isDatabaseConfigured:()=>true,isAuthConfigured:()=>true},
    "@/lib/repository":{getUserProfileForUser:async()=>lifetime,syncUserSubscriptionState:async()=>{}},"@/lib/founder-claim-repository":{},
    "@/lib/stripe-rest":{getStripeSubscriptionState:async()=>({plan:"free",status:"none"}),reconcileActiveSubscriptionPlan:s=>s,checkoutPlanIsCoveredByState:()=>false,hasActiveUnknownPaidSubscription:()=>false,createCheckoutSession:async input=>{calls.push(input);return {url:"https://checkout.stripe.com/test"};}}
  });
  const send=plan=>POST(new Request("https://example.invalid/api/billing/checkout",{method:"POST",body:JSON.stringify({plan})}));
  assert.equal((await send("pro_creator")).status,409);
  assert.equal((await send("lite")).status,409);
  assert.equal((await send("pro_studio")).status,200);
  assert.deepEqual(calls.map(c=>c.plan),["pro_studio"]);
});

test("server billing refreshes delayed Studio renewal before lifetime fallback and retains lifetime during outage",async()=>{
  const stripe=loadTs("lib/stripe-rest.ts",{"@/lib/env":{getEnv:()=>({})}});
  for(const state of ["renewed","canceled","outage"]){
    let reads=0;
    const profile={...lifetime,plan:"pro_studio",subscription_status:"active",stripe_subscription_id:"sub_test",subscription_current_period_end:"2025-01-01"};
    const {getServerBillingState}=loadTs("lib/server-billing-state.ts",{
      "@/lib/auth":{getCurrentUser:async()=>lifetime},"@/lib/backend":{isDatabaseConfigured:()=>true},"@/lib/env":{isStripeConfigured:()=>true},
      "@/lib/repository":{getUserProfileForUser:async()=>profile,syncUserSubscriptionState:async s=>({...profile,plan:s.plan,subscription_status:s.status,subscription_current_period_end:s.currentPeriodEnd})},
      "@/lib/stripe-rest":{...stripe,getStripeSubscriptionState:async()=>{reads++;if(state==="outage")throw Error("offline");return {plan:state==="renewed"?"pro_studio":"free",status:state==="renewed"?"active":"canceled",currentPeriodEnd:"2099-01-01"};}}
    });
    const result=await getServerBillingState();assert.equal(reads,1);assert.equal(result.plan,state==="renewed"?"pro_studio":"pro_creator");assert.equal(result.status,"active");
  }
});

test("subscription cancellation preserves lifetime and image generation cannot consume lifetime allowance",async()=>{
  const h=createImageHarness({profile:{...lifetime,plan:"pro_studio",subscription_status:"active",stripe_subscription_id:"sub_test"}});
  await h.repository.updateSubscriptionStatus({userId:"user-test",plan:"free",status:"canceled",stripeSubscriptionId:"sub_test"});
  assert.equal(h.data.paid_creator_lifetime_status,"active");
  const result=await h.post();assert.equal(result.response.status,403);assert.ok(!h.calls.includes("provider"));
});

test("Studio page reconciles renewal and requests text-only usage on lifetime fallback",async()=>{
  const {outputText}=ts.transpileModule(readFileSync("app/studio/page.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  const stripe=loadTs("lib/stripe-rest.ts",{"@/lib/env":{getEnv:()=>({})}});
  for(const renewed of [true,false]){
    let reads=0,usageInput;
    const p={...lifetime,plan:"pro_studio",subscription_status:"active",subscription_current_period_end:"2025-01-01"};
    const mocks={"react/jsx-runtime":{jsx:(_component,props)=>props},"@/components/studio-shell":{StudioShell:()=>null},"@/lib/site":{absoluteUrl:s=>s},
      "@/lib/auth":{getCurrentUser:async()=>lifetime},"@/lib/backend":{isDatabaseConfigured:()=>true},"@/lib/env":{isStripeConfigured:()=>true},
      "@/lib/usage":loadTs("lib/usage.ts"),"@/lib/entitlements":loadTs("lib/entitlements.ts"),
      "@/lib/repository":{getUserProfileForUser:async()=>p,getMonthlyUsageCount:async input=>{usageInput=input;return 2;},syncUserSubscriptionState:async s=>({...p,plan:s.plan,subscription_status:s.status,subscription_current_period_end:s.currentPeriodEnd})},
      "@/lib/stripe-rest":{...stripe,getStripeSubscriptionState:async()=>{reads++;return {plan:renewed?"pro_studio":"free",status:renewed?"active":"canceled",currentPeriodEnd:"2099-01-01"};}}};
    const module={exports:{}};new Function("require","module","exports",outputText)(id=>{assert.ok(Object.hasOwn(mocks,id),id);return mocks[id];},module,module.exports);
    const result=await module.exports.default();assert.equal(reads,1);assert.equal(result.initialPlan,renewed?"pro_studio":"pro_creator");
    assert.equal(usageInput.eventType,renewed?undefined:"text_generation");if(!renewed)assert.equal(usageInput.periodEnd,null);
  }
});

test("success message is account bound and distinguishes pending, active and reversed purchases",async()=>{
  for(const [status,owner,expected] of [["open","user-test",/being verified/],["completed","user-test",/one-time payment with no recurring/],["refunded","user-test",/reversed/],["completed","other",/Sign in/]]){
    const {paidLifetimeSuccessMessage}=loadTs("lib/paid-lifetime-success.ts",{
      "server-only":{},"@/lib/auth":{getCurrentUser:async()=>lifetime},"@/lib/repository":{getUserProfileForUser:async()=>lifetime},
      "@/lib/paid-lifetime-reservations":{getPaidLifetimeReservation:async()=>({id:"purchase",userId:owner,stripeCheckoutSessionId:"cs_test",status})},
      "@/lib/stripe-rest":{retrieveCheckoutSession:async()=>({metadata:{offer:"creator_lifetime_2026",purchase_id:"purchase"}})}
    });
    assert.match(await paidLifetimeSuccessMessage("cs_test"),expected);
  }
});
