import assert from "node:assert/strict";
import test from "node:test";
import { loadTs, createImageHarness } from "./image-test-helpers.mjs";

const env = { stripeSecretKey: "offline", stripeLitePriceId: "price_lite", stripeProCreatorPriceId: "price_creator", stripeProStudioPriceId: "price_studio", stripeLegacyProCreatorPriceIds: [], stripeLegacyProStudioPriceIds: [], appUrl: "https://example.invalid" };
// Preserve future enabled-price contract coverage; containment is tested separately below.
const salesEnabled = { LITE_PURCHASES_SUSPENDED: false };
const stripe = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => env } });
const generation = loadTs("lib/generation-reservation.ts");
const now = new Date("2026-10-26T12:00:00Z");
const profile = { id: "synthetic-lite", email: "lite@example.invalid", plan: "lite", subscription_status: "active", workspace: { draft: "keep" } };
const input = { source: "An original synthetic planning checklist", tone: "professional", sharpness: "balanced", ctaMode: "soft", presetTopic: "none", selectedTypes: ["linkedin"] };

test("approved plan order, 10/50 pool and existing allowances are preserved", () => {
  const { pricingPlans } = loadTs("lib/pricing.ts");
  assert.deepEqual(pricingPlans.map(p => [p.name,p.price]), [["Free","£0"],["Lite","£5/month"],["Pro Creator","£9/month"],["Pro Studio","£39/month"]]);
  const { monthlyLimitForPlan } = loadTs("lib/usage.ts");
  assert.deepEqual(["free","lite","founder","pro_creator","pro_studio"].map(monthlyLimitForPlan), [3,10,50,50,250]);
  assert.ok(monthlyLimitForPlan("lite") < monthlyLimitForPlan("pro_creator") / 2);
  const { planCoversPlan } = loadTs("lib/plan-utils.ts");
  assert.equal(planCoversPlan("lite", "pro_creator"), false);
  assert.equal(planCoversPlan("founder", "lite"), true);
});

test("Lite has every text format, one pooled generation/refinement limit and atomic pending capacity", () => {
  const { contentTypes } = loadTs("lib/content-config.ts");
  assert.equal(contentTypes.length, 14);
  for (const type of contentTypes) assert.equal(generation.reserveGenerationInProfile(profile, profile.id, "request-format", {...input, selectedTypes:[type.id]}, now).result.plan, "lite");
  const used = { ...profile, generation_usage_json: { "2026-10-01T00:00:00.000Z": 9 } };
  const refinement = { ...input, refinement: { action: "custom", instructions: "Make it shorter", section: { id:"s", type:"linkedin", title:"Post", platform:"LinkedIn", body:"A synthetic checklist", items:[] } } };
  const admitted = generation.reserveGenerationInProfile(used, profile.id, "request-refine", refinement, now);
  assert.throws(() => generation.reserveGenerationInProfile(admitted.data, profile.id, "request-next", input, now), e => e.code === "quota_exceeded");
  const result = { id:"pack", createdAt:now.toISOString(), source:input.source, tone:input.tone, selectedTypes:["linkedin"], title:"Checklist", summary:"Planning", sections:[refinement.refinement.section] };
  const saved = generation.completeGenerationInProfile(admitted.data, profile.id, "request-refine", admitted.result.fingerprint, result, now);
  assert.equal(saved.data.generation_usage_json["2026-10-01T00:00:00.000Z"],10);
  assert.equal(generation.reserveGenerationInProfile(saved.data, profile.id, "request-refine", refinement, now).result.status,"replay");
  assert.equal(generation.completeGenerationInProfile(saved.data, profile.id, "request-refine", admitted.result.fingerprint, result, now).data.usage_events_json.length,1);
  assert.throws(() => generation.reserveGenerationInProfile(saved.data, profile.id, "request-extra", input, now), e => e.code === "quota_exceeded");
  assert.throws(() => generation.reserveGenerationInProfile(profile, "different-account", "request-cross", input, now), e => e.status === 403);
  assert.deepEqual(saved.data.workspace,profile.workspace);
  assert.equal(generation.reserveGenerationInProfile(saved.data, profile.id, "request-new-month", input, new Date("2026-11-01T00:00:00Z")).result.status,"reserved");
});

test("Lite cancellation/expiry falls back to Free, upgrades retain used capacity", () => {
  for (const status of ["canceled","past_due","none","incomplete"]) assert.equal(generation.effectiveGenerationPlan({...profile, subscription_status:status},now),"free");
  assert.equal(generation.effectiveGenerationPlan({...profile, subscription_current_period_end:"2026-09-01"},now),"free");
  const used={...profile,generation_usage_json:{"2026-10-01T00:00:00.000Z":10}};
  const upgraded=generation.reserveGenerationInProfile({...used,plan:"pro_creator"},profile.id,"request-upgrade",input,now);
  assert.equal(upgraded.data.generation_usage_json["2026-10-01T00:00:00.000Z"],10);
  assert.throws(()=>generation.reserveGenerationInProfile({...used,generation_usage_json:{"2026-10-01T00:00:00.000Z":25}},profile.id,"request-downgrade",input,now),e=>e.code==="quota_exceeded");
});

test("Lite and Creator image requests are denied before provider dispatch", async () => {
  for(const plan of ["lite","pro_creator"]){
    const h=createImageHarness({profile:{plan}});
    const {response}=await h.post();
    assert.equal(response.status,403);
    assert.equal(h.calls.includes("provider"),false);
    assert.deepEqual(h.commercial,[]);
  }
});

test("Lite signup/verification continuation and price-mapped portal plan changes", () => {
  const { founderLoginCallbackUrl } = loadTs("lib/founder-offer.ts");
  assert.equal(founderLoginCallbackUrl("https://example.invalid","lite"),"https://example.invalid/login?plan=lite");
  for(const [price,metadata,expected] of [["price_lite","pro_creator","lite"],["price_creator","lite","pro_creator"],["price_studio","lite","pro_studio"]]){
    const state=stripe.stripeSubscriptionToState({id:"sub_synthetic",customer:"cus_synthetic",status:"active",metadata:{plan:metadata},items:{data:[{price:{id:price}}]}});
    assert.equal(state.plan,expected);
    assert.equal(state.status,"active");
  }
  assert.equal(stripe.normalizePlanId("lite"),"lite");
  assert.equal(stripe.checkoutPlanIsCoveredByState("pro_creator",{plan:"lite",status:"active"}),false);
});

test("Lite checkout validates GBP5 monthly price, passes account binding, fails closed when absent or wrong", async () => {
  const valid={id:"price_lite",active:true,currency:"gbp",unit_amount:500,type:"recurring",recurring:{interval:"month",interval_count:1,usage_type:"licensed"}};
  for(const changes of [null,{active:false},{currency:"usd"},{unit_amount:900},{recurring:{interval:"year",interval_count:1,usage_type:"licensed"}}]){
    const calls=[];
    const api=loadTs("lib/stripe-rest.ts",{"@/lib/lite-availability":salesEnabled,"@/lib/env":{getEnv:()=>env,isStripeConfigured:()=>true}},new Map(),{fetch:async(url,init)=>{calls.push({url,init});return Response.json(init?.method==="POST"?{id:"cs_synthetic",url:"https://checkout.stripe.com/synthetic"}:{...valid,...changes});}});
    const run=()=>api.createCheckoutSession({plan:"lite",userId:profile.id,email:profile.email});
    if(changes){await assert.rejects(run,/GBP 5/);assert.equal(calls.length,1);}
    else {await run(); const body=new URLSearchParams(calls[1].init.body); assert.equal(body.get("line_items[0][price]"),"price_lite");assert.equal(body.get("subscription_data[metadata][plan]"),"lite");assert.equal(body.get("client_reference_id"),profile.id);}
  }
  const missing=loadTs("lib/stripe-rest.ts",{"@/lib/lite-availability":salesEnabled,"@/lib/env":{getEnv:()=>({...env,stripeLitePriceId:""})}});
  await assert.rejects(()=>missing.createCheckoutSession({plan:"lite"}),/not configured/);
});

test("Lite upgrade/downgrade uses existing billing portal, never another subscription checkout", async () => {
  for(const [current,target] of [["lite","pro_creator"],["pro_creator","lite"],["lite","lite"]]){
    let checkouts=0,portals=0;
    const {POST}=loadTs("app/api/billing/checkout/route.ts",{
      "@/lib/lite-availability":salesEnabled,
      "server-only":{},"next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
      "@/lib/auth":{getCurrentUser:async()=>({id:profile.id,email:profile.email})},"@/lib/backend":{isDatabaseConfigured:()=>true,isAuthConfigured:()=>true},
      "@/lib/repository":{getUserProfileForUser:async()=>({...profile,plan:current}),syncUserSubscriptionState:async()=>{}},"@/lib/founder-claim-repository":{},
      "@/lib/stripe-rest":{...stripe,getStripeSubscriptionState:async()=>({plan:current,status:"active",stripeCustomerId:"cus_synthetic",stripeSubscriptionId:"sub_synthetic"}),createCustomerPortalSession:async({customerId})=>{assert.equal(customerId,"cus_synthetic");portals++;return{url:"https://billing.stripe.com/synthetic"};},createCheckoutSession:async()=>{checkouts++;}}
    });
    const response=await POST(new Request("https://example.invalid/api/billing/checkout",{method:"POST",body:JSON.stringify({plan:target})}));
    assert.equal(response.status,200);assert.equal(portals,1);assert.equal(checkouts,0);
  }
});

test("incident containment refuses Lite before account, Stripe or provider work", async () => {
  const suspended={LITE_PURCHASES_SUSPENDED:true,LITE_SUSPENDED_MESSAGE:"New Lite subscriptions are temporarily unavailable."};
  const {POST}=loadTs("app/api/billing/checkout/route.ts",{
    "@/lib/lite-availability":suspended,
    "server-only":{},"next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
    "@/lib/auth":{getCurrentUser:async()=>{throw new Error("Should not access account");}},
    "@/lib/backend":{},"@/lib/repository":{},"@/lib/founder-claim-repository":{}
  });
  const response=await POST(new Request("https://example.invalid/api/billing/checkout",{method:"POST",body:JSON.stringify({plan:"lite"})}));
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/temporarily unavailable/);
  const contained=loadTs("lib/stripe-rest.ts",{"@/lib/env":{getEnv:()=>env},"@/lib/lite-availability":suspended});
  await assert.rejects(()=>contained.createCheckoutSession({plan:"lite"}),/temporarily unavailable/);
});

test("Lite webhook activation, upgrades, downgrades and cancellation preserve content and other accounts", async () => {
  const h=createImageHarness({profile:{plan:"free",subscription_status:"none",workspace:{draft:"keep"},brand_profiles_json:[{name:"Synthetic"}]}});
  const other=structuredClone(h.rows.get("other-user"));
  let current;
  const {POST}=loadTs("app/api/billing/webhook/route.ts",{
    "next/server":{NextResponse:Response},"@/lib/founder-claim-repository":{},
    "@/lib/stripe-rest":{...stripe,verifyStripeSignature:()=>true,getStripeSubscriptionState:async()=>stripe.stripeSubscriptionToState(current)},
    "@/lib/repository":{updateSubscriptionStatus:h.repository.updateSubscriptionStatus}
  },new Map(),{console:{log:()=>{},warn:()=>{},error:()=>{}}});
  for(const [type,price,metadata,expected,status] of [
    ["checkout.session.completed","price_lite","lite","lite","active"],
    ["customer.subscription.updated","price_creator","lite","pro_creator","active"],
    ["customer.subscription.updated","price_lite","pro_creator","lite","active"],
    ["customer.subscription.deleted","price_lite","lite","free","canceled"]
  ]){
    current={id:"sub_synthetic",customer:"cus_synthetic",status,metadata:{plan:metadata,user_id:"user-test"},items:{data:[{price:{id:price}}]}};
    const response=await POST(new Request("https://example.invalid/webhook",{method:"POST",body:JSON.stringify({type,data:{object:{...current,client_reference_id:"user-test",subscription:"sub_synthetic"}}})}));
    assert.equal(response.status,200);assert.equal(h.data.plan,expected);assert.equal(h.data.subscription_status,status);
    assert.deepEqual(h.data.workspace,{draft:"keep"});assert.deepEqual(h.data.brand_profiles_json,[{name:"Synthetic"}]);assert.deepEqual(h.rows.get("other-user"),other);
  }
});
