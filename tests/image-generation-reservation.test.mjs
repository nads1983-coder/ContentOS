import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { loadTs, imageInput, requestId, profile, resultFixture } from "./image-test-helpers.mjs";

const r = loadTs("lib/image-generation-reservation.ts");
const now = new Date("2026-10-18T12:00:00Z");
const later = ms => new Date(now.getTime() + ms);
const reserve = (data = profile(), input = imageInput(), time = now) => r.reserveImageInProfile(data, "user-test", input, time);
const complete = (admission, result = resultFixture(), time = now) => r.completeImageInProfile(admission.data, "user-test", admission.result.requestId, admission.result.fingerprint, result, time);
const fail = admission => r.failImageInProfile(admission.data, "user-test", admission.result.requestId, admission.result.fingerprint, now);
const hash = text => createHash("sha256").update(text).digest("hex");

test("image reservation validates ownership and effective entitlement", () => {
  for (const data of [profile({ plan: "free" }), profile({ plan: "pro" }), profile({ subscription_status: "canceled" }),
    profile({ subscription_current_period_end: "2026-10-01T00:00:00Z" })]) assert.throws(() => reserve(data), { code: "image_plan_required" });
  assert.throws(() => reserve(profile({ id: "other" })), { code: "account_mismatch" });
  assert.equal(reserve().result.status, "reserved");
  assert.equal(reserve(profile({ entitlement_source: "manual_lifetime_upgrade_cousin", subscription_current_period_end: null })).result.status, "reserved");
  assert.throws(() => reserve(profile({ plan: "founder", entitlement_source: "founder_offer" })), { code: "image_plan_required" });
});

test("fingerprint covers every normalized render field but excludes request ID", () => {
  const original = r.imageGenerationFingerprint(imageInput());
  assert.equal(r.imageGenerationFingerprint(imageInput({ requestId: requestId(2) })), original);
  for (const patch of [{ outputText: "Other" }, { platform: "Instagram" }, { contentType: "Article" }, { style: "bold" }, { format: "vertical" },
    ...["brandName", "audience", "offer", "writingStyle", "contentGoal", "brandColors", "visualStyle", "contentTopic"].map(key => ({ brandContext: { [key]: "different" } }))]) {
    assert.notEqual(r.imageGenerationFingerprint(imageInput(patch)), original);
  }
});

test("pending IDs, identical concurrent payloads and two-active cap prevent duplicate spend", () => {
  const first = reserve();
  assert.throws(() => reserve(first.data), { code: "request_in_progress" });
  assert.throws(() => reserve(first.data, imageInput({ outputText: "edited" })), { code: "request_mismatch" });
  assert.throws(() => reserve(first.data, imageInput({ requestId: requestId(2) })), { code: "duplicate_in_progress" });
  const second = reserve(first.data, imageInput({ requestId: requestId(2), outputText: "second" }));
  assert.throws(() => reserve(second.data, imageInput({ requestId: requestId(3), outputText: "third" })), { code: "image_concurrency_limit" });
  assert.equal(second.data.image_generation_attempts_json.count, 2);
});

test("last monthly credit includes pending holds and completes once with durable usage", () => {
  const first = reserve(profile({ image_generation_usage_json: { "2026-10-01T00:00:00.000Z": 99 } }));
  assert.throws(() => reserve(first.data, imageInput({ requestId: requestId(2), outputText: "second" })), { code: "image_quota_exceeded" });
  const done = complete(first);
  assert.equal(done.data.image_generation_usage_json["2026-10-01T00:00:00.000Z"], 100);
  assert.equal(done.data.usage_events_json.length, 1);
  const twice = r.completeImageInProfile(done.data, "user-test", requestId(), first.result.fingerprint, resultFixture(), now);
  assert.deepEqual(twice.data, done.data);
  const replay = reserve({ ...done.data, plan: "free" });
  assert.equal(replay.result.status, "replay");
  assert.deepEqual(replay.result.result, done.result);
  assert.equal(replay.data.image_generation_attempts_json.count, 1);
  assert.throws(() => reserve(done.data, imageInput({ outputText: "changed" })), { code: "request_mismatch" });
  assert.ok(!JSON.stringify(done.data.usage_events_json).includes("data:image"));
});

test("failure releases credit hold but remains terminal and retains attempt budget", () => {
  const first = reserve(), failed = fail(first);
  assert.equal(failed.data.image_generation_reservations_json.length, 0);
  assert.equal(failed.data.image_generation_attempts_json.count, 1);
  assert.equal(failed.data.usage_events_json, undefined);
  assert.throws(() => reserve(failed.data), { code: "request_failed" });
  assert.throws(() => reserve(failed.data, imageInput({ outputText: "changed" })), { code: "request_mismatch" });
  assert.deepEqual(r.failImageInProfile(failed.data, "user-test", requestId(), first.result.fingerprint, now).data, failed.data);
  assert.equal(reserve(failed.data, imageInput({ requestId: requestId(2) })).result.status, "reserved");
});

test("free SVG fallback is replayable without credit usage but still consumes attempt budget", () => {
  const done = complete(reserve(), resultFixture({ creditCharged: false }));
  assert.equal(done.data.usage_events_json, undefined);
  assert.equal(Object.values(done.data.image_generation_usage_json)[0], 0);
  assert.equal(done.data.image_generation_attempts_json.count, 1);
  assert.equal(reserve(done.data).result.result.creditCharged, false);
});

test("legacy image usage migrates to durable count and event pruning cannot reset quota", () => {
  const events = Array.from({ length: 99 }, () => ({ event_type: "image_generation", user_id: "user-test", created_at: now.toISOString() }));
  const done = complete(reserve(profile({ usage_events_json: events })));
  assert.throws(() => reserve({ ...done.data, usage_events_json: [] }, imageInput({ requestId: requestId(2) })), { code: "image_quota_exceeded" });
});

test("completion uses the admission billing window across month rollover", () => {
  const first = reserve(profile(), imageInput(), new Date("2026-10-31T23:59:59Z"));
  const done = complete(first, resultFixture(), new Date("2026-11-01T00:00:01Z"));
  assert.equal(done.data.image_generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
  assert.equal(done.data.image_generation_usage_json["2026-11-01T00:00:00.000Z"], undefined);
});

test("expired pending requests become terminal; late completion never charges or regenerates", () => {
  const first = reserve();
  const time = later(r.IMAGE_RETENTION.reservationMs);
  assert.throws(() => reserve(first.data, imageInput(), time), { code: "request_expired" });
  assert.throws(() => complete(first, resultFixture(), time), { code: "request_expired" });
  const next = reserve(first.data, imageInput({ requestId: requestId(2) }), time);
  assert.equal(next.data.image_generation_reservations_json.length, 1);
  assert.equal(next.data.image_generation_tombstones_json[hash(requestId())].status, "expired");
});

test("replay expires at 24 hours while the terminal identity prevents regeneration forever", () => {
  const done = complete(reserve());
  assert.throws(() => reserve(done.data, imageInput(), later(r.IMAGE_RETENTION.replayMs)), { code: "request_expired" });
  const next = reserve(done.data, imageInput({ requestId: requestId(2) }), later(r.IMAGE_RETENTION.replayMs));
  assert.throws(() => reserve(next.data, imageInput(), later(365 * 86400000)), { code: "request_expired" });
});

test("replay storage is capped by both bytes and count, retaining tombstones for evicted bodies", () => {
  let data = profile();
  for (let i = 1; i <= 9; i++) {
    const time = later(i * 11 * 60000);
    const first = reserve(data, imageInput({ requestId: requestId(i) }), time);
    data = complete(first, resultFixture(), time).data;
  }
  assert.equal(data.image_generation_reservations_json.length, 8);
  assert.throws(() => reserve(data, imageInput(), later(100 * 60000)), { code: "request_expired" });
  data = profile();
  for (let i = 1; i <= 3; i++) {
    const first = reserve(data, imageInput({ requestId: requestId(i) }), later(i));
    data = complete(first, resultFixture({ image: resultFixture().image + "a".repeat(3_500_000) }), later(i)).data;
  }
  assert.equal(data.image_generation_reservations_json.length, 2);
  assert.ok(Buffer.byteLength(JSON.stringify(data.image_generation_reservations_json)) <= r.IMAGE_RETENTION.replayBytes);
  assert.equal(Object.keys(data.image_generation_tombstones_json).length, 1);
});

test("bounded terminal identity capacity fails closed rather than permitting old-ID reuse", () => {
  const fingerprint = r.imageGenerationFingerprint(imageInput());
  const tombstones = Object.fromEntries(Array.from({ length: r.IMAGE_RETENTION.terminalIdentities }, (_, i) => [hash(requestId(i + 1)), { fingerprint, status: "failed" }]));
  const data = profile({ image_generation_tombstones_json: tombstones });
  assert.throws(() => reserve(data, imageInput({ requestId: requestId(10001) })), { code: "image_identity_capacity" });
  assert.throws(() => reserve(data), { code: "request_failed" });
});

test("six per rolling ten minutes includes failures; replay is free and rejected admission does not count", () => {
  let data = complete(reserve(), resultFixture({ creditCharged: false })).data;
  for (let i = 2; i <= 6; i++) data = fail(reserve(data, imageInput({ requestId: requestId(i) }))).data;
  assert.equal(data.image_generation_attempts_json.count, 6);
  assert.throws(() => reserve(data, imageInput({ requestId: requestId(7) })), { code: "image_attempt_limit" });
  assert.equal(reserve(data).result.status, "replay");
  assert.equal(data.image_generation_attempts_json.count, 6);
  assert.equal(reserve(data, imageInput({ requestId: requestId(7) }), later(10 * 60000)).data.image_generation_attempts_json.count, 7);
});

test("100 daily attempts survive failures and reset on UTC day boundary without erasing rolling limit", () => {
  let data = profile();
  for (let i = 1; i <= 100; i++) {
    const time = new Date(`2026-10-18T${String(Math.floor((i - 1) / 6)).padStart(2, "0")}:00:00Z`);
    const admitted = reserve(data, imageInput({ requestId: requestId(i) }), time);
    data = r.failImageInProfile(admitted.data, "user-test", requestId(i), admitted.result.fingerprint, time).data;
  }
  assert.equal(data.image_generation_attempts_json.count, 100);
  assert.throws(() => reserve(data, imageInput({ requestId: requestId(101) }), new Date("2026-10-18T23:59:00Z")), { code: "image_attempt_limit", retryAfterSeconds: 60 });
  const next = reserve(data, imageInput({ requestId: requestId(101) }), new Date("2026-10-19T00:00:00Z"));
  assert.equal(next.data.image_generation_attempts_json.count, 1);
  const nearMidnight = profile({ image_generation_attempts_json: { day: "2026-10-17", count: 100, recent: Array(6).fill("2026-10-17T23:59:59Z") } });
  assert.throws(() => reserve(nearMidnight, imageInput(), new Date("2026-10-18T00:00:00Z")), { code: "image_attempt_limit", retryAfterSeconds: 599 });
});

test("corrupt durable state fails closed before admitting a provider attempt", () => {
  for (const patch of [
    { image_generation_reservations_json: "invalid" }, { image_generation_reservations_json: [{}] },
    { image_generation_tombstones_json: { invalid: {} } }, { image_generation_usage_json: { invalid: -1 } },
    { image_generation_usage_json: { "2026-10-01T00:00:00.000Z": "0" } }, { usage_events_json: [null] },
    { image_generation_attempts_json: { day: "2026-10-18", count: 101, recent: [] } },
    { image_generation_attempts_json: { day: "2026-10-18", count: 1, recent: ["invalid"] } }
  ]) assert.throws(() => reserve(profile(patch)), { code: "image_storage_unavailable" });
});
