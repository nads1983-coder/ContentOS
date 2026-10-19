import test from "node:test";
import assert from "node:assert/strict";
import { loadTs, imageInput, requestId, PNG, resultFixture } from "./image-test-helpers.mjs";
const { Response, ReadableStream } = globalThis;

const c = loadTs("lib/image-generation-contract.ts");

test("image contract requires a stable UUID and preserves all four formats and six styles", () => {
  for (const format of c.IMAGE_FORMATS) for (const style of c.IMAGE_STYLES) {
    assert.equal(c.normalizeImageRequest(imageInput({ format, style })).format, format);
  }
  assert.equal(c.normalizeImageRequest(imageInput({ requestId: "ABCDEF00-0000-4000-8000-000000000001" })).requestId, "abcdef00-0000-4000-8000-000000000001");
  for (const bad of [null, [], {}, imageInput({ requestId: undefined }), imageInput({ requestId: "repeat" }), imageInput({ outputText: " " }),
    imageInput({ outputText: "x".repeat(2601) }), imageInput({ style: "wrong" }), imageInput({ format: "wrong" }),
    imageInput({ brandContext: [] }), imageInput({ brandContext: { brandName: "x".repeat(141) } }), imageInput({ platform: 123 })]) {
    assert.throws(() => c.normalizeImageRequest(bad), c.ImageGenerationError);
  }
  const clean = c.normalizeImageRequest({ requestId: requestId(), outputText: "  Original meaning  ", extraneous: "ignored" });
  assert.equal(clean.outputText, "Original meaning");
  assert.equal(clean.style, "premium");
  assert.equal(clean.format, "square");
  assert.equal(clean.extraneous, undefined);
});

test("image JSON reader bounds actual UTF-8 bytes, rejects invalid JSON and declared overflow", async () => {
  assert.deepEqual(await c.readImageJson(Response.json({ a: "ok" }), 100), { a: "ok" });
  for (const body of ["{", new Uint8Array([0xff])]) await assert.rejects(c.readImageJson(new Response(body), 100), { status: 400 });
  await assert.rejects(c.readImageJson(new Response('"ééé"'), 7), { status: 413 });
  await assert.rejects(c.readImageJson(new Response("{}", { headers: { "content-length": "101" } }), 100), { status: 413 });
  await assert.rejects(c.readImageJson(new Response(new ReadableStream({ start() {} })), 100, 5), { status: 408 });
});

test("background accepts bounded PNG base64 only and never follows provider URLs", () => {
  assert.equal(c.imageBackgroundFromResponse({ data: [{ b64_json: PNG }] }), `data:image/png;base64,${PNG}`);
  for (const data of [[], [{ url: "http://169.254.169.254/private" }], [{ b64_json: "b2ZmbGluZQ==" }], [{ b64_json: `${PNG}!` }],
    [{ b64_json: "A".repeat(c.IMAGE_LIMITS.backgroundBase64Characters + 4) }], [{ b64_json: PNG }, { b64_json: PNG }]]) {
    assert.equal(c.imageBackgroundFromResponse({ data }), undefined);
  }
});

test("image results have an explicit byte cap and project only the public response", () => {
  assert.deepEqual(c.validateImageResult(resultFixture({ secret: "must not persist" })), resultFixture());
  for (const patch of [{ image: "data:image/svg+xml;charset=utf-8," }, { creditCharged: undefined }, { size: "1x1" }, { createdAt: "invalid" }]) {
    assert.throws(() => c.validateImageResult(resultFixture(patch)), { code: "invalid_image_result" });
  }
  assert.throws(() => c.validateImageResult(resultFixture({ image: resultFixture().image + "x".repeat(c.IMAGE_LIMITS.resultBytes) })), { code: "image_result_too_large" });
});
