import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import ts from "typescript";
import { loadTs } from "./image-test-helpers.mjs";
const { isImageContentType } = loadTs("lib/image-generation-contract.ts");
const { boundDeviceImages } = loadTs("lib/image-device-store.ts");

const source = readFileSync(new URL("../components/studio-shell.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("studio-shell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let fn;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "generateImage") fn = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(fn, "Use the actual image action from StudioShell");
const compiled = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness(overrides = {}) {
  const state = { calls: [], errors: [], images: {}, pending: false, response: { ok: true, data: { image: "data:image/svg+xml;charset=utf-8,%3Csvg%3E", creditCharged: true } } };
  const context = {
    imageSection: { id: "section1", title: "Original title", platform: "LinkedIn", type: "linkedin" },
    imageInFlight: { current: false }, imageRequestAttempt: { current: null }, activeAccount: { current: "account1" },
    accountId: "account1", isProStudio: true, result: { source: "Original user source" },
    imageStyle: "premium", imageFormat: "square", brandName: "", audience: "", offer: "", writingStyle: "", contentGoal: "",
    imageBrandColors: "", imageVisualStyle: "", crypto: { randomUUID },
    imageMode: "auto", imageInstructions: "", imageSource: overrides.result?.source ?? "Original user source", imageIndustry: "", imagePlatform: "",
    buildSectionCopyText: (_section, options) => options.sourceText, labelForContentType: () => "LinkedIn Post",
    formatSectionImageText: (_section, source) => source, isImageContentType,
    boundDeviceImages,
    setImagePending: value => { state.pending = value; }, setImageError: value => state.errors.push(value),
    setGeneratedImages: updater => { state.images = updater(state.images); },
    fetch: async (_url, options) => {
      state.calls.push({ body: JSON.parse(options.body), headers: options.headers });
      if (state.wait) await state.wait;
      if (state.throwNetwork) throw new Error("Network response lost");
      return { ok: state.response.ok, json: async () => state.response.data };
    }
  };
  Object.assign(context, overrides);
  const action = new Function(...Object.keys(context), `${compiled}; return generateImage;`)(...Object.values(context));
  return { state, context, action };
}

test("image UI sends account header and UUID; ambiguous saves and network errors retain ID and payload", async () => {
  const h = harness();
  h.state.response = { ok: false, data: { code: "image_save_uncertain", error: "Retry same ID" } };
  await h.action();
  const first = h.state.calls[0];
  assert.match(first.body.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(first.headers["X-ContentOS-Account"], "account1");
  h.state.throwNetwork = true;
  await h.action();
  assert.deepEqual(h.state.calls[1], first);
  h.state.throwNetwork = false;
  h.state.response = { ok: true, data: { image: "data:image/svg+xml;charset=utf-8,%3Csvg%3E", creditCharged: false } };
  await h.action();
  assert.deepEqual(h.state.calls[2], first);
  assert.equal(h.context.imageRequestAttempt.current, null);
  assert.ok(h.state.images.section1);
  await h.action();
  assert.notEqual(h.state.calls[3].body.requestId, first.body.requestId);
});

test("long article and brand preferences produce a bounded image excerpt without mutating originals", async () => {
  const article = "Original article. ".repeat(500);
  const preference = "  Brand preference ".repeat(100);
  const h = harness({
    result: { source: article }, imageSection: { id: "section1", title: preference, platform: preference, type: "blog" },
    brandName: preference, audience: preference, offer: preference, writingStyle: preference,
    contentGoal: preference, imageBrandColors: preference, imageVisualStyle: preference
  });
  h.state.response = { ok: false, data: { code: "image_save_uncertain" } };
  await h.action();
  const payload = h.state.calls[0].body;
  const { normalizeImageRequest } = loadTs("lib/image-generation-contract.ts");
  assert.doesNotThrow(() => normalizeImageRequest(payload));
  assert.equal(payload.outputText, article.trim().slice(0, 2600));
  assert.equal(payload.brandContext.brandName.length, 140);
  assert.equal(payload.brandContext.audience.length, 220);
  assert.equal(payload.brandContext.offer.length, 220);
  for (const key of ["writingStyle", "contentGoal", "brandColors", "visualStyle", "contentTopic"]) assert.equal(payload.brandContext[key].length, 180);
  assert.equal(h.context.result.source, article);
  assert.equal(h.context.brandName, preference);
  await h.action();
  assert.deepEqual(h.state.calls[1], h.state.calls[0]);
});

test("image title does not append a second platform heading and caption hashtags stay intact", async () => {
  const caption = "A useful announcement. #ContentOS #ProductivityTools";
  const h = harness({ result: { source: caption }, imageSection: {
    id: "section1", title: "LinkedIn Announcement Post", platform: "LinkedIn", type: "linkedin"
  } });
  await h.action();
  assert.equal(h.state.calls[0].body.brandContext.contentTopic, "LinkedIn Announcement Post");
  assert.equal(h.state.calls[0].body.outputText, caption);
  assert.equal(h.context.result.source, caption);
});

test("hashtag cards cannot start an image request, including stale open image panels", async () => {
  const h = harness({ imageSection: { id: "tags", type: "platformHashtags", title: "Platform Hashtags", platform: "All" } });
  await h.action();
  assert.equal(h.state.calls.length, 0);
  assert.equal(h.state.pending, false);
  assert.equal(h.context.imageRequestAttempt.current, null);
  assert.match(h.state.errors[0], /Choose a post or caption/);
});

test("image UI double-click is guarded synchronously and terminal failure permits next explicit attempt", async () => {
  const h = harness();
  let release;
  h.state.wait = new Promise(resolve => { release = resolve; });
  h.state.response = { ok: false, data: { code: "request_expired", error: "Expired" } };
  const first = h.action();
  await h.action();
  assert.equal(h.state.calls.length, 1);
  release();
  await first;
  assert.equal(h.context.imageRequestAttempt.current, null);
  h.state.wait = null;
  await h.action();
  assert.notEqual(h.state.calls[1].body.requestId, h.state.calls[0].body.requestId);
});

test("image UI discards success and failure results after an account switch", async () => {
  for (const throwNetwork of [false, true]) {
    const h = harness();
    let release;
    h.state.wait = new Promise(resolve => { release = resolve; });
    h.state.throwNetwork = throwNetwork;
    const pending = h.action();
    h.context.activeAccount.current = "account2";
    release();
    await pending;
    assert.deepEqual(h.state.images, {});
    assert.deepEqual(h.state.errors, [""]);
  }
});
