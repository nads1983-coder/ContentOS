import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";
const { quoteAI, usageCost, COST_POLICY, conservativeGBP } = loadTs("lib/ai-cost.ts");
const { usesLifetimeCredits } = loadTs("lib/lifetime-access.ts");
const date = new Date("2026-10-19T12:00:00Z");
const text = { model: "gpt-4.1", input: "synthetic", max_output_tokens: 24000 };
const image = { model: "gpt-image-1.5", prompt: "synthetic", n: 1, quality: "high", size: "1536x1024" };
test("integer worst-case bounds reject proposed 50 credits and support 14 + 5 before failure headroom", () => {
  const t = conservativeGBP((COST_POLICY.textBytes+4096)*2+24000*8);
  const i = conservativeGBP((COST_POLICY.imageBytes+4096)*5+6250*32);
  assert.equal(t,547431); assert.equal(i,360576);
  assert.ok(t*50>COST_POLICY.text); assert.ok(t*14<COST_POLICY.text);
  assert.ok(i*5<COST_POLICY.image); assert.equal(t*14+i*5,9466914);
  assert.equal(t*COST_POLICY.textCredits+i*COST_POLICY.imageCredits,8011476);
});
test("full serialized payload including schema is priced; UTF-8 bytes are not character counts", () => {
  const q = quoteAI("text",{...text,instructions:"é".repeat(1000)},date);
  assert.ok(q.inputBound>6000); assert.equal(q.outputBound,24000);
  assert.notEqual(q.hash,quoteAI("text",text,date).hash);
  assert.throws(()=>quoteAI("text",{...text,input:"x".repeat(128000)},date),/capacity/);
});
test("unknown models, stale prices, tools, unbounded outputs and unreviewed image configurations fail closed", () => {
  for (const patch of [{model:"gpt-unknown"},{max_output_tokens:24001},{tools:[{}]},{previous_response_id:"anything"},{background:true}]) assert.throws(()=>quoteAI("text",{...text,...patch},date));
  for (const patch of [{model:"unknown"},{n:2},{quality:"auto"},{size:"auto"},{image:"input"}]) assert.throws(()=>quoteAI("image",{...image,...patch},date));
  assert.throws(()=>quoteAI("text",text,new Date(COST_POLICY.expires)));
});
test("known usage reconciles conservatively; uncertain and malformed usage never releases money", () => {
  const q=quoteAI("text",text,date);
  assert.equal(usageCost(q,{input_tokens:2033,output_tokens:3078}),34428);
  for(const value of [null,{}, {input_tokens:-1,output_tokens:10},{input_tokens:1.1,output_tokens:1}]) assert.equal(usageCost(q,value),null);
  assert.throws(()=>usageCost(q,{input_tokens:q.inputBound+1,output_tokens:0}));
  assert.throws(()=>usageCost(quoteAI("image",image,date),{input_tokens:10,output_tokens:10,input_tokens_details:{image_tokens:1}}));
});
test("new Lifetime membership remains separate from recurring, owner and Founder benefits", () => {
  const member={plan:"free",subscription_status:"none",lifetime_access:{source:"lifetime_purchase",status:"active",textCredits:12,imageCredits:4}};
  assert.equal(usesLifetimeCredits(member),true);
  for(const plan of ["founder","pro_creator","pro_studio"]) assert.equal(usesLifetimeCredits({...member,plan,subscription_status:"active"}),false);
  assert.equal(usesLifetimeCredits({...member,lifetime_access:{...member.lifetime_access,status:"revoked"}}),false);
});
test("Lifetime checkout remains refused before authentication or any Stripe interaction",async()=>{
  const {POST}=loadTs("app/api/billing/lifetime-checkout/route.ts",{
    "server-only":{},"next/server":{NextResponse:Response},"@/lib/request-security":{rejectUnsafeWrite:()=>null},
    "@/lib/auth":{getCurrentUser:()=>assert.fail("Disabled checkout must not authenticate")},
    "@/lib/lifetime-payment":{prepareLifetimePurchase:()=>assert.fail("Disabled checkout must not create a purchase")},
    "@/lib/lifetime-stripe":{lifetimeStripeProvider:{}},"@/lib/lifetime-capacity":{}
  });
  const response=await POST(new Request("https://test.invalid/api/billing/lifetime-checkout",{method:"POST",body:JSON.stringify({price:1,credits:100000})}));
  assert.equal(response.status,409); assert.equal((await response.json()).code,"lifetime_not_activated");
});
