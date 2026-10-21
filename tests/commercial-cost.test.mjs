import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";
const { quoteAI, usageCost, COST_POLICY, conservativeGBP } = loadTs("lib/ai-cost.ts");
const date = new Date("2026-10-19T12:00:00Z");
const text = { model: "gpt-4.1", input: "synthetic", max_output_tokens: 24000 };
const image = { model: "gpt-image-1.5", prompt: "synthetic", n: 1, quality: "high", size: "1536x1024" };
test("integer worst-case bounds remain within the shared monthly policy", () => {
  const t = conservativeGBP((COST_POLICY.textBytes+4096)*2+24000*8);
  const i = conservativeGBP((COST_POLICY.imageBytes+4096)*5+6250*32);
  assert.equal(t,547431); assert.equal(i,360576);
  assert.equal(COST_POLICY.monthly,30_000_000);
  assert.ok(t<COST_POLICY.monthly); assert.ok(i<COST_POLICY.monthly);
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
