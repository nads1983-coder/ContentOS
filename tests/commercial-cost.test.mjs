import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";
const { quoteAI, usageCost, COST_POLICY, conservativeGBP, DEFAULT_IMAGE_MODEL } = loadTs("lib/ai-cost.ts");
const date = new Date("2026-10-19T12:00:00Z");
const text = { model: "gpt-4.1", input: "synthetic", max_output_tokens: 24000 };
const image = { model: "gpt-image-1.5", prompt: "synthetic", n: 1, quality: "high", size: "1536x1024" };
const productionImage = { ...image, model: "gpt-image-1", output_format: "png", background: "opaque", moderation: "auto" };
test("pinned replacement reserves conservatively and settles official Flare usage", () => {
  assert.equal(DEFAULT_IMAGE_MODEL, "gpt-image-2.5-flare-2026-09-08");
  for (const model of [DEFAULT_IMAGE_MODEL, "gpt-image-2.5-flare"]) {
    for (const [size, output] of [["1024x1024", 1756], ["1536x1024", 1372], ["1024x1536", 1372]]) {
      const q = quoteAI("image", { ...productionImage, model, size }, new Date("2026-10-24T00:00:00Z"));
      assert.equal(q.outputBound, 6250);
      assert.equal(q.maximum, conservativeGBP(q.inputBound * 5 + 6250 * 30));
      assert.equal(usageCost(q, { input_tokens: 100, output_tokens: output }), conservativeGBP(500 + output * 30));
      assert.equal(usageCost(q, null), null);
      assert.throws(() => usageCost(q, { input_tokens: 100, output_tokens: 6251 }));
    }
  }
  const full = { ...productionImage, model: DEFAULT_IMAGE_MODEL, prompt: "" };
  full.prompt = "x".repeat(COST_POLICY.imageBytes - Buffer.byteLength(JSON.stringify(full)));
  assert.equal(quoteAI("image", full, date).maximum, 345576);
  for (const patch of [{model: "gpt-image-2.5-sunburst"}, {quality: "xhigh"}, {quality: "max"}, {size: "2048x2048"}, {partial_images: 1}, {stream: true}, {image: "input"}, {n: 2}]) {
    assert.throws(() => quoteAI("image", { ...full, prompt: "synthetic", ...patch }, date), e => e.code === "unreviewed_provider_payload");
  }
});
test("integer worst-case bounds remain within the shared monthly policy", () => {
  const t = conservativeGBP((COST_POLICY.textBytes+4096)*2+24000*8);
  const i = conservativeGBP((COST_POLICY.imageBytes+4096)*5+6250*32);
  assert.equal(t,547431); assert.equal(i,360576);
  assert.equal(COST_POLICY.monthly,30_000_000);
  assert.ok(t<COST_POLICY.monthly); assert.ok(i<COST_POLICY.monthly);
});
test("production image configuration reserves and settles the same model-specific price", () => {
  for (const size of ["1024x1024", "1024x1536", "1536x1024"]) {
    const q = quoteAI("image", { ...productionImage, size }, date);
    assert.equal(q.maximum, conservativeGBP(q.inputBound * 5 + 6250 * 40));
    assert.equal(usageCost(q, { input_tokens: 100, output_tokens: 6240 }), 300120);
    assert.equal(usageCost(q, { input_tokens: q.inputBound, output_tokens: 6250 }), q.maximum);
    assert.equal(usageCost(q, {}), null);
    assert.throws(() => usageCost(q, { input_tokens: 100, output_tokens: 6251 }));
    assert.throws(() => usageCost(q, { input_tokens: 100, output_tokens: 10, input_tokens_details: { image_tokens: 1 } }));
  }
  const full = { ...productionImage, prompt: "" };
  full.prompt = "x".repeat(COST_POLICY.imageBytes - Buffer.byteLength(JSON.stringify(full)));
  const q = quoteAI("image", full, date);
  assert.equal(q.inputBound, 20096);
  assert.equal(q.maximum, 420576);
  assert.throws(() => quoteAI("image", { ...full, prompt: full.prompt + "x" }, date));
  const previous = quoteAI("image", image, date);
  assert.equal(usageCost(previous, { input_tokens: 100, output_tokens: 6240 }), 240216);
  assert.equal(usageCost({ ...previous, version: "2026-10-19-v1" }, { input_tokens: 100, output_tokens: 6240 }), 240216);
  assert.throws(() => usageCost({ ...q, model: "unreviewed" }, { input_tokens: 100, output_tokens: 10 }));
});
test("production image policy refuses unbounded or unreviewed parameters", () => {
  for (const patch of [
    { model: "gpt-image-2" }, { n: 2 }, { n: "1" }, { quality: "auto" }, { size: "auto" },
    { prompt: {} }, { prompt: " " }, { image: "input" }, { mask: "input" },
    { stream: true }, { partial_images: 3 }, { tools: [] }, { background: "transparent" },
    { output_format: "jpeg" }, { moderation: "low" }
  ]) assert.throws(() => quoteAI("image", { ...productionImage, ...patch }, date), e => e.code === "unreviewed_provider_payload");
});
test("published Image 1 shutdown stops new reservations without blocking settlement or text", () => {
  const q = quoteAI("image", productionImage, new Date("2026-10-22T23:59:59Z"));
  assert.throws(() => quoteAI("image", productionImage, new Date("2026-10-23T00:00:00Z")), e => e.code === "pricing_review_required");
  assert.equal(usageCost(q, { input_tokens: 100, output_tokens: 6240 }), 300120);
  assert.ok(quoteAI("text", text, new Date("2026-10-23T00:00:00Z")));
  assert.ok(quoteAI("image", image, new Date("2026-10-23T00:00:00Z")));
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
