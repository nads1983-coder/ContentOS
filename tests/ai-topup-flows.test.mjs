import assert from "node:assert/strict";
import test from "node:test";
import {loadTs} from "./image-test-helpers.mjs";

test("included credits precede purchased credits and reset without spending a top-up",()=>{
  const api=loadTs("lib/generation-reservation.ts"),usage=loadTs("lib/usage.ts");
  const now=new Date("2026-11-15T12:00:00Z"),next=new Date("2026-12-01T12:00:00Z"),period=usage.currentUsageWindow(now).periodStart;
  const req={source:"A meaningful synthetic source",tone:"professional",sharpness:"balanced",ctaMode:"soft",presetTopic:"none",selectedTypes:["linkedin"]};
  let p={id:"test-user",email:"test@example.invalid",plan:"pro_creator",subscription_status:"active",generation_usage_json:{[period]:49}};
  let a=api.reserveGenerationInProfile(p,p.id,"request-one",req,now,true);assert.equal(a.result.funding,"included");
  let b=api.reserveGenerationInProfile(a.data,p.id,"request-two",{...req,source:"A different meaningful synthetic source"},now,true);assert.equal(b.result.funding,"purchased");
  const output={id:"gen",createdAt:now.toISOString(),source:req.source,tone:"professional",sharpness:"balanced",ctaMode:"soft",presetTopic:"none",selectedTypes:["linkedin"],title:"Title",summary:"Summary",sections:[{id:"one",type:"linkedin",title:"Post",platform:"LinkedIn",body:"Useful post",items:[]}]};
  p=api.completeGenerationInProfile(b.data,p.id,"request-two",b.result.fingerprint,output,now).data;
  assert.equal(p.generation_usage_json[period],49);assert.equal(p.generation_history_json[0].credit_source,"purchased");
  const fresh=api.reserveGenerationInProfile(p,p.id,"request-three",{...req,source:"Another meaningful source next month"},next,true);
  assert.equal(fresh.result.funding,"included");
});

test("top-up webhook fetches Stripe state, waits for payment and handles reversal events",async()=>{
  const calls=[];
  let session={id:"cs_test_123",payment_status:"unpaid",status:"complete",payment_intent:"pi_test123"};
  const {POST}=loadTs("app/api/billing/webhook/route.ts",{
    "next/server":{NextResponse:Response},"@/lib/ai-topup-offer":{AI_TOPUP_OFFER:{code:"prepaid_text_2026",fulfillmentEnabled:true}},
    "@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{code:"creator_lifetime_2026",fulfillmentEnabled:false}},
    "@/lib/stripe-rest":{verifyStripeSignature:()=>true,retrieveCheckoutSession:async()=>session,retrievePaidLifetimePaymentIntent:async()=>({id:"pi_test123",livemode:false}),retrieveLifetimeDisputes:async()=>[]},
    "@/lib/repository":{},"@/lib/founder-claim-repository":{},"@/lib/founder-checkout-service":{},"@/lib/paid-lifetime-fulfillment":{},"@/lib/paid-lifetime-reservations":{},
    "@/lib/ai-topup-review":{getTopupDecisionRevision:async()=>"0",topupEvidence:()=>[{reason:"dispute",key:"dispute:du_test:needs_response"}]},
    "@/lib/ai-topup-payments":{fulfillTopup:async()=>calls.push("grant"),terminateTopup:async(_id,_session,reason)=>calls.push(reason),reverseTopup:async()=>calls.push("reverse")}
  });
  async function send(type,object,livemode=false){return POST(new Request("https://example.invalid/api/billing/webhook",{method:"POST",body:JSON.stringify({id:"evt_test1",livemode,type,data:{object}})}));}
  const object={id:"cs_test_123",metadata:{offer:"prepaid_text_2026",purchase_id:"purchase"}};
  assert.equal((await (await send("checkout.session.completed",object)).json()).pending,true);assert.deepEqual(calls,[]);
  assert.equal((await send("checkout.session.async_payment_failed",object)).status,200);
  assert.equal((await send("checkout.session.expired",object)).status,200);assert.deepEqual(calls,["failed","expired"]);
  session={...session,payment_status:"paid"};assert.equal((await send("checkout.session.async_payment_succeeded",object)).status,200);assert.deepEqual(calls,["failed","expired","grant"]);
  assert.equal((await send("checkout.session.completed",object,true)).status,503);
  assert.equal((await send("charge.dispute.created",{payment_intent:"pi_test123"})).status,200);assert.deepEqual(calls,["failed","expired","grant","reverse"]);
});

test("top-up checkout remains closed even before authentication",async()=>{
  const {POST}=loadTs("app/api/topups/checkout/route.ts",{
    "@/lib/request-security":{rejectUnsafeWrite:()=>null},"@/lib/ai-topup-offer":{AI_TOPUP_OFFER:{checkoutEnabled:false}},
    "@/lib/auth":{getCurrentUser:async()=>{throw Error("must not run");}},"@/lib/ai-topup-payments":{},"@/lib/repository":{},"@/lib/generation-reservation":{},"@/lib/stripe-rest":{},"server-only":{}
  });
  assert.equal((await POST(new Request("https://example.invalid",{method:"POST"}))).status,503);
});

test("checkout is account-bound and takes price only from the reserved server package",async()=>{
  const calls=[];let user={id:"actual-user",email:"test@example.invalid"};
  const {POST}=loadTs("app/api/topups/checkout/route.ts",{
    "@/lib/request-security":{rejectUnsafeWrite:()=>null},"@/lib/ai-topup-offer":{AI_TOPUP_OFFER:{checkoutEnabled:true}},
    "@/lib/auth":{getCurrentUser:async()=>user},"@/lib/admin-json":{readAdminJson:async r=>r.json()},
    "@/lib/repository":{getUserProfileForUser:async()=>({plan:"pro_creator",subscription_status:"active"})},
    "@/lib/generation-reservation":{effectiveGenerationPlan:()=>"pro_creator"},
    "@/lib/ai-topup-payments":{prepareTopup:async(...args)=>{calls.push(args);return {id:"purchase",attempt_key:"attempt",price_pence:900,credits:50,status:"preparing"};}},
    "@/lib/stripe-rest":{createTestTopupCheckoutSession:async v=>{calls.push(v);return {url:"https://checkout.stripe.com/test"};}}
  });
  const send=(account)=>POST(new Request("https://example.invalid",{method:"POST",headers:{"X-ContentOS-Account":account},body:JSON.stringify({package:"popular",requestId:"test-request",pricePence:1,userId:"other"})}));
  assert.equal((await send("other")).status,409);assert.deepEqual(calls,[]);
  assert.equal((await send("actual-user")).status,200);assert.deepEqual(calls[0],["actual-user","popular","test-request"]);assert.equal(calls[1].pricePence,900);
  user=null;assert.equal((await send("actual-user")).status,401);
});

test("the test Checkout adapter refuses a live key before any provider call",async()=>{
  let fetches=0;
  const api=loadTs("lib/stripe-rest.ts",{
    "@/lib/ai-topup-offer":{AI_TOPUP_OFFER:{checkoutEnabled:true}},
    "@/lib/env":{getEnv:()=>({stripeSecretKey:"sk_live_synthetic"}),isStripeConfigured:()=>true}
  },new Map(),{fetch:async()=>{fetches++;throw Error("network forbidden");}});
  await assert.rejects(api.createTestTopupCheckoutSession({id:"p",accountId:"a",attemptKey:"attempt",pricePence:500,credits:25,email:"test@example.invalid"}));
  assert.equal(fetches,0);
});

test("top-up operational status is restricted to authenticated administrators",async()=>{
  for(const mode of ["anonymous","ordinary","admin"]) {
    let reads=0;
    const {GET}=loadTs("app/api/admin/topups/reconciliation/route.ts",{
      "@/lib/auth":{getCurrentUser:async()=>mode==="anonymous"?null:{id:"user",email:"test@example.invalid"},isAdminEmail:()=>mode==="admin"},
      "@/lib/db/client":{getPool:()=>({query:async()=>{reads++;return {rows:[]};}})},
      "@/lib/request-security":{},"@/lib/admin-json":{},"server-only":{}
    });
    const response=await GET();assert.equal(response.status,mode==="admin"?200:403);assert.equal(reads,mode==="admin"?5:0);
  }
});
