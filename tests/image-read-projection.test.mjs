import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createImageHarness, imageInput, requestId, resultFixture } from "./image-test-helpers.mjs";

const fields = ["image_generation_reservations_json", "image_generation_tombstones_json", "generation_reservations_json", "generation_tombstones_json"];

test("all read-only repository paths project ledgers in SQL without dropping history, counters, brands or billing", async () => {
  const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const h = createImageHarness({ profile: {
    image_generation_reservations_json: [{ result: { image: "synthetic body".repeat(10000) } }],
    image_generation_tombstones_json: { terminal: "fixture" }, generation_reservations_json: [{ result: "text replay" }], generation_tombstones_json: { terminal: "fixture" },
    generation_usage_json: { [start]: 4 }, image_generation_usage_json: { [start]: 7 },
    brand_profiles_json: [{ id: "brand-1", user_id: "user-test", brand_name: "Synthetic" }],
    subscription_current_period_end: "2099-01-01T00:00:00Z", stripe_subscription_id: "sub_fixture",
    generation_history_json: [], usage_events_json: [], custom_unrelated: { retained: true }
  } });
  assert.equal((await h.repository.getUserProfile("user-test")).stripe_subscription_id, "sub_fixture");
  assert.equal((await h.repository.getUserProfileForUser("user-test", "ignored@invalid")).id, "user-test");
  assert.equal((await h.repository.getUserProfileByEmail("  TEST@EXAMPLE.INVALID  ")).id, "user-test");
  assert.equal((await h.repository.listBrandProfiles("user-test"))[0].brand_name, "Synthetic");
  assert.equal(await h.repository.getMonthlyUsageCount({ userId: "user-test" }), 11);
  assert.equal((await h.repository.getWorkspace("user-test")).revision, 0);
  assert.equal(await h.repository.getUserProfile("absent"), null);
  assert.equal(await h.repository.getUserProfileByEmail("absent@invalid"), null);
  assert.ok(h.reads.length >= 8);
  for (const read of h.reads) {
    assert.equal(read.locked, false);
    for (const field of fields) assert.ok(!read.keys.includes(field));
    if (read.keys.length) for (const field of ["generation_history_json", "image_generation_usage_json", "generation_usage_json", "stripe_subscription_id", "brand_profiles_json", "custom_unrelated"]) assert.ok(read.keys.includes(field));
  }
  for (const field of fields) assert.ok(h.data[field], "projection must not alter stored data");
});

test("workspace and metadata writes re-read full locked profiles and preserve both image and text replay state", async () => {
  const h = createImageHarness(), input = imageInput();
  const admission = await h.repository.reserveImageGeneration("user-test", input);
  const result = resultFixture();
  await h.repository.completeImageGeneration("user-test", input.requestId, admission.fingerprint, result);
  const failedInput = imageInput({ requestId: requestId(2), outputText: "failed synthetic source" });
  const failed = await h.repository.reserveImageGeneration("user-test", failedInput);
  await h.repository.failImageGeneration("user-test", failed.requestId, failed.fingerprint);
  const key = createHash("sha256").update("text-fixture").digest("hex");
  h.data = { ...h.data, generation_reservations_json: [{ requestId: "text-fixture", result: { source: "retained text replay" } }], generation_tombstones_json: { [key]: "failed" } };
  const before = Object.fromEntries(fields.map(field => [field, h.data[field]]));
  const workspace = await h.repository.getWorkspace("user-test");
  await h.repository.saveWorkspace("user-test", { revision: workspace.revision, store: workspace.store, preferences: { ...workspace.preferences, brandName: "Updated safely" } });
  await h.repository.saveOnboarding("user-test", { writingStyle: "Direct" });
  await h.repository.createBrandProfile("user-test", { brand_name: "New brand" });
  assert.deepEqual(Object.fromEntries(fields.map(field => [field, h.data[field]])), before);
  assert.ok(h.reads.some(read => read.locked && fields.every(field => read.keys.includes(field))));
  assert.equal((await h.repository.getWorkspace("user-test")).preferences.brandName, "Updated safely");
  assert.deepEqual((await h.repository.reserveImageGeneration("user-test", input)).result, result);
  await assert.rejects(h.repository.reserveImageGeneration("user-test", failedInput), error => error.code === "request_failed");
  assert.equal(Object.values(h.data.image_generation_usage_json)[0], 1);
});
