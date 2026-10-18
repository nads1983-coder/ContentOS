import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";
const receipt={version:1,launchApproval:"explicit-owner-approval",verification:"passed",
 approvedRelease:"a".repeat(40),verifiedRelease:"a".repeat(40),productionDeployment:"dpl_synthetic",
 verifiedAt:"2026-01-01T12:00:00.000Z",retiredAt:"2026-01-01T12:01:00.000Z"};
const {founderOfferRetired}=loadTs("lib/founder-retirement.ts");
const raw=JSON.stringify(receipt),now=Date.parse("2026-01-01T13:00:00.000Z");

test("retirement requires explicit approval, matched verified release, deployment and ordered timestamps",()=>{
 assert.equal(founderOfferRetired(undefined,now),false);
 assert.equal(founderOfferRetired(raw,now),true);
 for(const value of ["", "true","null","{}","{",JSON.stringify({...receipt,launchApproval:false}),
  JSON.stringify({...receipt,verification:"pending"}),JSON.stringify({...receipt,verifiedRelease:"b".repeat(40)}),
  JSON.stringify({...receipt,productionDeployment:""}),JSON.stringify({...receipt,verifiedAt:"2027-01-01T12:00:00.000Z"}),
  JSON.stringify({...receipt,retiredAt:"2026-01-01T11:00:00.000Z"}),JSON.stringify({...receipt,retiredAt:"2026-02-30T12:01:00.000Z"})]){
  assert.equal(founderOfferRetired(value,now),false);
 }
 assert.equal(founderOfferRetired(raw,Date.parse(receipt.retiredAt)-1),false);
 assert.equal(founderOfferRetired(raw,Date.parse(receipt.retiredAt)),true);
});

test("retired checkout POST refuses direct/stale requests before profile, claim or Stripe work",async()=>{
 let external=0;
 const forbidden=()=>{external++;throw Error("Unexpected external operation");};
 const route=loadTs("app/api/billing/checkout/route.ts",{
  "next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
  "@/lib/auth":{getCurrentUser:async()=>({id:"synthetic",email:"synthetic@example.invalid"})},
  "@/lib/backend":{isAuthConfigured:()=>true,isDatabaseConfigured:()=>true},
  "@/lib/repository":{getUserProfileForUser:forbidden},"@/lib/stripe-rest":{createCheckoutSession:forbidden},
  "@/lib/founder-claim-repository":{founderClaimRepository:{reserveClaim:forbidden}}
 },new Map(),{process:{env:{FOUNDER_RETIREMENT_RECEIPT:raw}}});
 for(const founderOffer of [true,"true",1]){
  const response=await route.POST(new Request("https://test.invalid/api/billing/checkout",{method:"POST",body:JSON.stringify({plan:"pro_creator",founderOffer})}));
  assert.equal(response.status,410);assert.equal((await response.json()).code,"founder_offer_retired");
 }
 assert.equal(external,0);
});

test("Stripe boundary refuses new Founder sessions but preserves normal prices and disables code-entry bypass",async()=>{
 for(const retired of [false,true]){
  const calls=[];
  const env={appUrl:"https://test.invalid",stripeSecretKey:"offline-placeholder",stripeProCreatorPriceId:"price_creator",stripeProStudioPriceId:"price_studio"};
  const stripe=loadTs("lib/stripe-rest.ts",{"@/lib/env":{getEnv:()=>env,isStripeConfigured:()=>true}},new Map(),{
   process:{env:retired?{FOUNDER_RETIREMENT_RECEIPT:raw}:{}},fetch:async(url,options)=>{
    calls.push(new URLSearchParams(options.body));return Response.json({id:"cs_synthetic",url:"https://checkout.test/normal"});
   }
  });
  if(retired){await assert.rejects(stripe.createCheckoutSession({plan:"pro_creator",founderOffer:true}),/offer has closed/);assert.equal(calls.length,0);}
  for(const plan of ["pro_creator","pro_studio"]){
   await stripe.createCheckoutSession({plan});
   const sent=calls.at(-1);assert.equal(sent.get("line_items[0][price]"),plan==="pro_creator"?"price_creator":"price_studio");
   assert.equal(sent.get("allow_promotion_codes"),retired?"false":"true");
   assert.equal(sent.get("discounts[0][promotion_code]"),null);
  }
 }
});

test("retirement does not change existing lifetime entitlement or qualifying completed-checkout evidence",()=>{
 const runtime={process:{env:{FOUNDER_RETIREMENT_RECEIPT:raw}}};
 const entitlements=loadTs("lib/entitlements.ts",{},new Map(),runtime);
 assert.equal(entitlements.hasLifetimeEntitlement({plan:"founder",subscription_status:"active",entitlement_source:"founder_offer"}),true);
 const offer=loadTs("lib/founder-offer.ts",{},new Map(),runtime);
 const completed={amount_total:0,mode:"subscription",status:"complete",payment_status:"no_payment_required",customer:"cus_synthetic",subscription:"sub_synthetic",
  client_reference_id:"synthetic",metadata:{offer:"founder",founder_offer:"true",expected_total:"0",user_id:"synthetic"},discounts:[{promotion_code:"promo_synthetic"}]};
 assert.equal(offer.founderCompletedCheckoutSessionQualifies(completed,"promo_synthetic","synthetic"),true);
 assert.equal(offer.founderCompletedCheckoutSessionQualifies({...completed,amount_total:1},"promo_synthetic","synthetic"),false);
});

test("a qualifying pre-retirement Checkout still activates through the webhook after retirement and retries converge",async()=>{
 const metadata={offer:"founder",founder_offer:"true",expected_total:"0",user_id:"synthetic"};
 const session={id:"cs_synthetic",amount_total:0,mode:"subscription",status:"complete",payment_status:"no_payment_required",
  customer:"cus_synthetic",subscription:"sub_synthetic",client_reference_id:"synthetic",metadata,discounts:[{promotion_code:"promo_synthetic"}]};
 const claim={id:"claim_synthetic",userId:"synthetic",email:"synthetic@example.invalid",status:"open",promotionCodeId:"promo_synthetic",stripeCheckoutSessionId:session.id};
 let persisted=0,canceled=0;
 const route=loadTs("app/api/billing/webhook/route.ts",{
  "next/server":{NextResponse:Response},
  "@/lib/stripe-rest":{verifyStripeSignature:()=>true,retrieveCheckoutSession:async()=>session,
   scheduleFounderSubscriptionCancellation:async()=>{canceled++;}},
  "@/lib/founder-claim-repository":{founderClaimRepository:{findClaimBySession:async()=>claim,
   completeClaim:async input=>{assert.equal(persisted,1);Object.assign(claim,{status:"completed",stripeSubscriptionId:input.stripeSubscriptionId});},
   findCompletedClaimBySubscription:async()=>claim.status==="completed"?claim:null}},
  "@/lib/repository":{updateSubscriptionStatus:async input=>{assert.equal(input.plan,"founder");assert.equal(input.entitlementSource,"founder_offer");persisted++;return[{}];}}
 },new Map(),{process:{env:{FOUNDER_RETIREMENT_RECEIPT:raw}},console:{log:()=>{},error:()=>{}}});
 for(const type of ["checkout.session.completed","checkout.session.completed","customer.subscription.deleted"]){
  const object=type.startsWith("checkout")?session:{id:session.subscription,metadata};
  const result=await route.POST(new Request("https://test.invalid/api/billing/webhook",{method:"POST",body:JSON.stringify({type,data:{object}})}));
  assert.equal(result.status,200);
 }
 assert.equal(persisted,1);assert.equal(canceled,2);assert.equal(claim.status,"completed");
});
