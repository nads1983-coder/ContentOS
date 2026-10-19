import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { sql } from "drizzle-orm";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
function loadTs(relative, mocks = {}, cache = new Map()) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`, mocks, cache) : nativeRequire(id);
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}
const helpers = loadTs("lib/generation-reservation.ts");
const { reserveGenerationInProfile: reserve, completeGenerationInProfile: complete, failGenerationInProfile: fail, effectiveGenerationPlan, generationFingerprint } = helpers;
const now = new Date("2026-10-18T12:00:00Z");
const profile = (extra = {}) => ({ id: "alice", email: "alice@example.test", plan: "free", subscription_status: "none", ...extra });
const request = (extra = {}) => ({ source: "Useful original source text", tone: "professional", sharpness: "balanced", ctaMode: "soft", presetTopic: "none", selectedTypes: ["linkedin"], ...extra });
const result = () => ({ id: "generated-1", createdAt: now.toISOString(), source: request().source, tone: "professional", selectedTypes: ["linkedin"], title: "Title", summary: "Summary", sections: [{ id: "section-1", type: "linkedin", platform: "LinkedIn", title: "Post", body: "Useful post content", items: [] }] });
const code = expected => error => error.code === expected;

test("effective paid tier rejects expired or canceled access and preserves both lifetime sources", () => {
  for (const subscription_status of ["none", "canceled", "past_due", "incomplete"]) assert.equal(effectiveGenerationPlan(profile({ plan: "pro_studio", subscription_status }), now), "free");
  assert.equal(effectiveGenerationPlan(profile({ plan: "pro_studio", subscription_status: "active", subscription_current_period_end: "2026-09-01" }), now), "free");
  assert.equal(effectiveGenerationPlan(profile({ plan: "pro_creator", subscription_status: "trialing", subscription_current_period_end: "2026-11-01" }), now), "pro_creator");
  assert.equal(effectiveGenerationPlan(profile({ plan: "founder", subscription_status: "active", entitlement_source: "founder_offer", subscription_current_period_end: "2025-01-01" }), now), "founder");
  assert.equal(effectiveGenerationPlan(profile({ plan: "pro_studio", subscription_status: "active", entitlement_source: "manual_lifetime_upgrade_cousin" }), now), "pro_studio");
});
test("paid output selection is enforced server-side without changing the billing record", () => {
  const data = profile({ plan: "pro_creator", subscription_status: "canceled" });
  assert.throws(() => reserve(data, "alice", "request-1", request({ selectedTypes: ["carousel"] }), now), code("paid_output_required"));
  assert.equal(data.plan, "pro_creator");
  assert.equal(reserve(profile({ plan: "founder", subscription_status: "active", entitlement_source: "founder_offer" }), "alice", "request-1", request({ selectedTypes: ["carousel"] }), now).result.plan, "founder");
});
test("request IDs, tenant identity, fingerprint and extended model inputs are validated", () => {
  assert.throws(() => reserve(profile(), "bob", "request-1", request(), now), e => e.status === 403);
  assert.throws(() => reserve(profile(), "alice", "bad", request(), now), code("invalid_request_id"));
  assert.throws(() => reserve(profile(), "alice", "request-1", request({ selectedTypes: ["not-a-format"] }), now), code("invalid_request"));
  const hash = generationFingerprint(request());
  assert.equal(hash, generationFingerprint({ selectedTypes: ["linkedin"], ...request(), requestId: "ignored" }));
  assert.notEqual(hash, generationFingerprint(request({ length: "short" })));
  assert.notEqual(hash, generationFingerprint(request({ refinement: { action: "shorten", section: result().sections[0] } })));
});
test("same request and concurrent identical fingerprints cannot trigger a second provider call", () => {
  const first = reserve(profile(), "alice", "request-1", request(), now);
  assert.equal(first.result.status, "reserved");
  assert.throws(() => reserve(first.data, "alice", "request-1", request(), now), code("request_in_progress"));
  assert.throws(() => reserve(first.data, "alice", "request-2", request(), now), code("duplicate_in_progress"));
  assert.throws(() => reserve(first.data, "alice", "request-1", request({ source: "Different source" }), now), code("request_mismatch"));
});
test("completion atomically appends history and usage once and replays the stored result", () => {
  const admission = reserve(profile(), "alice", "request-1", request(), now);
  const saved = complete(admission.data, "alice", "request-1", admission.result.fingerprint, result(), now);
  assert.equal(saved.data.usage_events_json.length, 1);
  assert.equal(saved.data.generation_history_json.length, 1);
  assert.equal(saved.data.generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
  const again = complete(saved.data, "alice", "request-1", admission.result.fingerprint, { ...result(), title: "Untrusted second result" }, now);
  assert.equal(again.data, saved.data);
  assert.equal(again.result.title, "Title");
  assert.equal(reserve(saved.data, "alice", "request-1", request(), now).result.status, "replay");
  assert.deepEqual(fail(saved.data, "alice", "request-1", admission.result.fingerprint, now).data, saved.data);
});
test("failures remain terminal for the same request and cannot later be completed", () => {
  const admitted = reserve(profile(), "alice", "request-1", request(), now);
  const failed = fail(admitted.data, "alice", "request-1", admitted.result.fingerprint, now);
  assert.equal(failed.data.generation_reservations_json[0].status, "failed");
  assert.equal(failed.data.usage_events_json, undefined);
  assert.throws(() => reserve(failed.data, "alice", "request-1", request(), new Date("2027-01-01")), code("request_failed"));
  assert.throws(() => complete(failed.data, "alice", "request-1", admitted.result.fingerprint, result(), now), code("request_failed"));
});
test("ambiguous reservations never expire into automatic regeneration", () => {
  const admitted = reserve(profile(), "alice", "request-1", request(), now);
  assert.throws(() => reserve(admitted.data, "alice", "request-1", request(), new Date("2027-01-01")), code("request_expired"));
  assert.throws(() => complete(admitted.data, "bob", "request-1", admitted.result.fingerprint, result(), now), e => e.status === 403);
  assert.throws(() => complete(admitted.data, "alice", "request-1", "wrong", result(), now), code("reservation_mismatch"));
});
test("quota includes concurrent reservations, legacy history and image usage", () => {
  let data = profile({ usage_events_json: [{ event_type: "image_generation", user_id: "alice", created_at: now.toISOString() }], generation_history_json: [{ user_id: "alice", created_at: now.toISOString(), payload: result() }] });
  data = reserve(data, "alice", "request-1", request(), now).data;
  assert.throws(() => reserve(data, "alice", "request-2", request({ source: "Different source" }), now), code("quota_exceeded"));
  assert.equal(data.generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
});
test("durable counter enforces quota after history/event pruning and resets with monthly window", () => {
  const data = profile({ generation_usage_json: { "2026-10-01T00:00:00.000Z": 3 }, usage_events_json: [], generation_history_json: [] });
  assert.throws(() => reserve(data, "alice", "request-1", request(), now), code("quota_exceeded"));
  assert.equal(reserve(data, "alice", "request-1", request(), new Date("2026-11-01")).result.status, "reserved");
});
test("completion charges the original admission month across a boundary", () => {
  const admitted = reserve(profile(), "alice", "request-1", request(), new Date("2026-10-31T23:59:59Z"));
  const saved = complete(admitted.data, "alice", "request-1", admitted.result.fingerprint, result(), new Date("2026-11-01T00:00:01Z"));
  assert.equal(saved.data.generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
  assert.equal(saved.data.usage_events_json[0].created_at, "2026-10-31T23:59:59.000Z");
  assert.equal(saved.data.generation_history_json[0].created_at, "2026-10-31T23:59:59.000Z");
});

function repositoryHarness() {
  const rows = new Map([["alice", profile()], ["bob", profile({ id: "bob" })]]);
  let queue = Promise.resolve(), writes = 0, failWrites = false, locks = 0;
  const session = {
    select: () => ({ from: () => ({ where: id => ({ for: async mode => { assert.equal(mode, "update"); locks++; return rows.has(id) ? [{ data: structuredClone(rows.get(id)) }] : []; }, limit: async () => rows.has(id) ? [{ data: structuredClone(rows.get(id)) }] : [] }) }) }),
    update: () => ({ set: value => ({ where: async id => { if (failWrites) throw Error("Database write failed"); writes++; rows.set(id, structuredClone(value.data)); } }) })
  };
  const db = { ...session, transaction: fn => { const job = queue.then(() => fn(session)); queue = job.catch(() => {}); return job; } };
  const repo = loadTs("lib/postgres-repository.ts", { "server-only": {}, "drizzle-orm": { sql, eq: (_column, id) => id }, "@/lib/db/client": { getDb: () => db }, "@/lib/db/app-schema": { profiles: { id: "id" } } });
  return { repo, rows, failWrites: () => { failWrites = true; }, get writes() { return writes; }, get locks() { return locks; } };
}
test("repository row-lock serializes duplicate admission and completion across callers", async () => {
  const h = repositoryHarness();
  const outcomes = await Promise.allSettled([h.repo.reserveTextGeneration("alice", "request-1", request()), h.repo.reserveTextGeneration("alice", "request-2", request())]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  const admitted = outcomes[0].value;
  await Promise.all([h.repo.completeTextGeneration("alice", "request-1", admitted.fingerprint, result()), h.repo.completeTextGeneration("alice", "request-1", admitted.fingerprint, result())]);
  assert.equal(h.rows.get("alice").usage_events_json.length, 1);
  assert.equal(h.rows.get("alice").generation_history_json.length, 1);
  assert.equal(h.locks, 4);
  assert.equal((await h.repo.reserveTextGeneration("bob", "request-1", request())).status, "reserved");
});
test("repository refuses nonexistent account and never reports success when commit fails", async () => {
  const h = repositoryHarness();
  await assert.rejects(h.repo.reserveTextGeneration("missing", "request-1", request()), /unavailable/);
  h.failWrites();
  await assert.rejects(h.repo.reserveTextGeneration("alice", "request-1", request()), /write failed/);
  assert.equal(h.rows.get("alice").generation_reservations_json, undefined);
  assert.equal(h.writes, 0);
});
test("failed completion commit retains reservation, with no history or usage to claim success", async () => {
  const h = repositoryHarness();
  const admission = await h.repo.reserveTextGeneration("alice", "request-1", request());
  h.failWrites();
  await assert.rejects(h.repo.completeTextGeneration("alice", "request-1", admission.fingerprint, result()), /write failed/);
  assert.equal(h.rows.get("alice").generation_reservations_json[0].status, "reserved");
  assert.equal(h.rows.get("alice").usage_events_json, undefined);
  assert.equal(h.rows.get("alice").generation_history_json, undefined);
});
test("legacy 2000-entry ledger compacts terminal identities and admits new requests", () => {
  const entries = Array.from({ length: 2000 }, (_, i) => ({ requestId: `old-request-${i}`, fingerprint: "old", status: "failed", createdAt: now.toISOString(), plan: "free", periodStart: "2026-10-01T00:00:00Z", periodEnd: "2026-11-01T00:00:00Z" }));
  const data = profile({ generation_reservations_json: entries });
  const next = reserve(data, "alice", "request-new", request(), now);
  assert.equal(next.result.status, "reserved");
  assert.equal(next.data.generation_reservations_json.length, 1);
  assert.equal(Object.keys(next.data.generation_tombstones_json).length, 2000);
  assert.throws(() => reserve(next.data, "alice", "old-request-1", request(), now), code("request_failed"));
  assert.equal(reserve({ ...profile({ id: "bob" }) }, "bob", "old-request-1", request(), now).result.status, "reserved");
  assert.equal(data.generation_reservations_json.length, 2000);
});
const later = milliseconds => new Date(now.getTime() + milliseconds);
const hash = id => createHash("sha256").update(id).digest("hex");
test("30-day replay expiry rejects old IDs, leaves history/usage untouched and accepts a fresh ID", () => {
  const admission = reserve(profile(), "alice", "request-1", request(), now);
  const saved = complete(admission.data, "alice", "request-1", admission.result.fingerprint, result(), now);
  const boundary = helpers.GENERATION_RETENTION.replayMs;
  assert.equal(reserve(saved.data, "alice", "request-1", request(), later(boundary - 1)).result.status, "replay");
  assert.throws(() => reserve(saved.data, "alice", "request-1", request(), later(boundary)), e => e.status === 410 && e.code === "request_expired");
  const fresh = reserve(saved.data, "alice", "request-2", request(), later(boundary));
  assert.equal(fresh.result.status, "reserved");
  assert.equal(fresh.data.generation_tombstones_json[hash("request-1")], "completed");
  assert.equal(fresh.data.generation_history_json, saved.data.generation_history_json);
  assert.equal(fresh.data.usage_events_json, saved.data.usage_events_json);
  assert.equal(fresh.data.generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
  assert.throws(() => reserve(fresh.data, "alice", "request-1", request({ source: "Different body" }), later(boundary)), code("request_expired"));
  assert.throws(() => complete(fresh.data, "alice", "request-1", admission.result.fingerprint, result(), later(boundary)), code("request_expired"));
});
test("abandoned slots expire terminally after grace period, never into retry leases", () => {
  let data = profile();
  for (let i = 0; i < 3; i++) data = reserve(data, "alice", `request-${i}`, request({ source: `Original source ${i}` }), now).data;
  assert.throws(() => reserve(data, "alice", "request-4", request(), later(helpers.GENERATION_RETENTION.reservationMs - 1)), code("quota_exceeded"));
  const after = later(helpers.GENERATION_RETENTION.reservationMs);
  const next = reserve(data, "alice", "request-4", request(), after);
  assert.equal(next.result.status, "reserved");
  assert.equal(next.data.generation_reservations_json.length, 1);
  assert.equal(next.data.generation_tombstones_json[hash("request-0")], "expired");
  assert.throws(() => reserve(next.data, "alice", "request-0", request({ source: "Original source 0" }), after), code("request_expired"));
  assert.throws(() => complete(next.data, "alice", "request-0", generationFingerprint(request({ source: "Original source 0" })), result(), after), code("request_expired"));
  assert.equal(next.data.usage_events_json, undefined);
});
test("concurrency limit is temporary and failed slots reopen without losing failed-ID protection", () => {
  let data = profile({ plan: "pro_studio", subscription_status: "active", entitlement_source: "manual_lifetime_upgrade_cousin" });
  for (let i = 0; i < helpers.GENERATION_RETENTION.concurrentRequests; i++) data = reserve(data, "alice", `request-${i}`, request({ source: `Original source ${i}` }), now).data;
  assert.throws(() => reserve(data, "alice", "request-new", request(), now), code("generation_concurrency_limit"));
  data = fail(data, "alice", "request-0", generationFingerprint(request({ source: "Original source 0" })), now).data;
  const next = reserve(data, "alice", "request-new", request(), now);
  assert.equal(next.result.status, "reserved");
  assert.throws(() => reserve(next.data, "alice", "request-0", request({ source: "Original source 0" }), now), code("request_failed"));
});
test("cache pressure evicts only replay bodies, not history or terminal identity", () => {
  const large = result();
  large.sections = Array.from({ length: 4 }, (_, i) => ({ ...large.sections[0], id: `section-${i}`, body: "x".repeat(24000) }));
  const entries = Array.from({ length: 90 }, (_, i) => ({ requestId: `old-request-${i}`, fingerprint: generationFingerprint(request()), status: "completed", createdAt: now.toISOString(), completedAt: new Date(now.getTime() - i * 1000).toISOString(), plan: "pro_studio", periodStart: "2026-09-01T00:00:00Z", periodEnd: "2026-10-01T00:00:00Z", result: { ...large, id: `old-result-${i}` } }));
  const data = profile({ generation_reservations_json: entries, generation_history_json: [{ payload: result(), created_at: "2026-09-01T00:00:00Z" }] });
  assert.ok(Buffer.byteLength(JSON.stringify(entries)) > 8_000_000);
  const next = reserve(data, "alice", "request-new", request(), now);
  assert.equal(next.result.status, "reserved");
  assert.ok(Buffer.byteLength(JSON.stringify(next.data.generation_reservations_json)) < helpers.GENERATION_RETENTION.replayBytes + 1000);
  assert.equal(next.data.generation_tombstones_json[hash("old-request-89")], "completed");
  assert.equal(next.data.generation_history_json, data.generation_history_json);
  assert.equal(reserve(next.data, "alice", "old-request-0", request(), now).result.status, "replay");
  assert.throws(() => reserve(next.data, "alice", "old-request-89", request(), now), code("request_expired"));
  const committed = complete(next.data, "alice", "request-new", next.result.fingerprint, large, now);
  assert.equal(committed.result.id, large.id);
  assert.ok(Buffer.byteLength(JSON.stringify(committed.data.generation_reservations_json)) < helpers.GENERATION_RETENTION.replayBytes);
  assert.equal(committed.data.usage_events_json.length, 1);
});
test("malformed tombstones fail closed and failed compaction commits leave original ledger intact", async () => {
  assert.throws(() => reserve(profile({ generation_tombstones_json: { garbage: "completed" } }), "alice", "request-1", request(), now), code("invalid_reservations"));
  const h = repositoryHarness();
  const expired = [{ requestId: "old-request", fingerprint: generationFingerprint(request()), status: "reserved", createdAt: "2020-01-01T00:00:00Z", plan: "free" }];
  h.rows.set("alice", profile({ generation_reservations_json: expired }));
  h.failWrites();
  await assert.rejects(h.repo.reserveTextGeneration("alice", "request-new", request()), /write failed/);
  assert.deepEqual(h.rows.get("alice").generation_reservations_json, expired);
  assert.equal(h.rows.get("alice").generation_tombstones_json, undefined);
});
test("workspace CAS uses the same repository lock and leaves only one concurrent winner", async () => {
  const h = repositoryHarness();
  const value = { revision: 0, store: { version: 1, recent: [], saved: [], drafts: [] }, preferences: { brandName: "", audience: "", offer: "", writingStyle: "", contentGoal: "" } };
  const outcomes = await Promise.allSettled([h.repo.saveWorkspace("alice", value), h.repo.saveWorkspace("alice", value)]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(x => x.status === "rejected").reason.status, 409);
  assert.equal((await h.repo.getWorkspace("alice")).revision, 1);
  assert.equal((await h.repo.getWorkspace("bob")).revision, 0);
});
test("usage summary uses durable text count even after recent event truncation", async () => {
  const h = repositoryHarness();
  const date = new Date();
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
  h.rows.set("alice", profile({ generation_usage_json: { [start]: 200 }, usage_events_json: [{ event_type: "image_generation", created_at: date.toISOString() }] }));
  assert.equal(await h.repo.getMonthlyUsageCount({ userId: "alice" }), 201);
  assert.equal(await h.repo.getMonthlyUsageCount({ userId: "alice", eventType: "text_generation" }), 200);
});

test("durable attempt budget counts failures without charging successful credits", () => {
  let data = profile();
  for (let i = 0; i < helpers.TEXT_ATTEMPT_BUDGET.max; i++) {
    const id = `attempt-${i}`;
    const admission = reserve(data, "alice", id, request(), now);
    data = fail(admission.data, "alice", id, admission.result.fingerprint, now).data;
  }
  assert.equal(data.text_generation_attempts_json.length, 20);
  assert.equal(data.generation_usage_json["2026-10-01T00:00:00.000Z"], 0);
  assert.equal(data.usage_events_json, undefined);
  const before = JSON.stringify(data);
  assert.throws(() => reserve(data, "alice", "attempt-next", request(), now), e => e.status === 429 && e.code === "generation_attempt_limit" && e.retryAfterSeconds === 60);
  assert.equal(JSON.stringify(data), before);
  assert.throws(() => reserve(data, "alice", "attempt-next", request(), later(59_001)), e => e.retryAfterSeconds === 1);
  const next = reserve(data, "alice", "attempt-next", request(), later(60_000));
  assert.deepEqual(next.data.text_generation_attempts_json, [later(60_000).getTime()]);
  assert.throws(() => reserve(next.data, "alice", "attempt-0", request(), later(60_000)), code("request_failed"));
  assert.equal(reserve(profile({ id: "bob" }), "bob", "attempt-next", request(), now).result.status, "reserved");
});

test("replays and rejected duplicate IDs never consume attempt capacity", () => {
  const admission = reserve(profile(), "alice", "attempt-success", request(), now);
  const saved = complete(admission.data, "alice", "attempt-success", admission.result.fingerprint, result(), now);
  const data = { ...saved.data, text_generation_attempts_json: Array(20).fill(now.getTime()) };
  assert.equal(reserve(data, "alice", "attempt-success", request(), now).result.status, "replay");
  assert.deepEqual(complete(data, "alice", "attempt-success", admission.result.fingerprint, result(), now).data.text_generation_attempts_json, data.text_generation_attempts_json);
  assert.throws(() => reserve(data, "alice", "attempt-success", request({ source: "Changed original source" }), now), code("request_mismatch"));
  assert.throws(() => reserve(admission.data, "alice", "attempt-other", request(), now), code("duplicate_in_progress"));
  assert.equal(admission.data.text_generation_attempts_json.length, 1);
});

test("attempt budget is rolling, bounded, fail-closed, and does not reset on backwards clock", () => {
  const times = Array.from({ length: 20 }, (_, i) => now.getTime() - i * 1000);
  const data = profile({ text_generation_attempts_json: times });
  assert.throws(() => reserve(data, "alice", "attempt-new", request(), now), e => e.retryAfterSeconds === 41);
  assert.throws(() => reserve(data, "alice", "attempt-new", request(), later(-1000)), code("generation_attempt_limit"));
  const next = reserve(data, "alice", "attempt-new", request(), later(41_000));
  assert.equal(next.data.text_generation_attempts_json.length, 20);
  for (const invalid of [{}, "[]", [-1], [NaN], [1.5], Array(21).fill(1)]) {
    assert.throws(() => reserve(profile({ text_generation_attempts_json: invalid }), "alice", "attempt-new", request(), now), code("invalid_attempt_budget"));
  }
});

test("repository serializes the last attempt slot across callers and preserves it on failed completion", async () => {
  const h = repositoryHarness();
  h.rows.set("alice", profile({ text_generation_attempts_json: Array(19).fill(Date.now()) }));
  const outcomes = await Promise.allSettled([h.repo.reserveTextGeneration("alice", "attempt-one", request()), h.repo.reserveTextGeneration("alice", "attempt-two", request({ source: "Different source for race" }))]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(x => x.status === "rejected").reason.code, "generation_attempt_limit");
  const admitted = outcomes.find(x => x.status === "fulfilled").value;
  assert.equal(h.rows.get("alice").text_generation_attempts_json.length, 20);
  h.failWrites();
  await assert.rejects(h.repo.completeTextGeneration("alice", admitted.requestId, admitted.fingerprint, result()), /write failed/);
  assert.equal(h.rows.get("alice").text_generation_attempts_json.length, 20);
  assert.equal(h.rows.get("alice").text_generation_daily_attempts_json.count, 20);
});

test("monthly total uses the image event/counter maximum plus other events without double-counting", () => {
  const start = "2026-10-01T00:00:00.000Z";
  const event = event_type => ({ event_type, user_id: "alice", created_at: now.toISOString() });
  for (const [imageCount, imageEvents] of [[2, 1], [1, 2], [2, 2]]) {
    const data = profile({ image_generation_usage_json: { [start]: imageCount }, usage_events_json: Array.from({ length: imageEvents }, () => event("image_generation")) });
    const admitted = reserve(data, "alice", "image-total", request(), now);
    assert.equal(admitted.result.status, "reserved");
    assert.equal(admitted.data.generation_usage_json[start], 0);
    assert.deepEqual(admitted.data.image_generation_usage_json, data.image_generation_usage_json);
    assert.throws(() => reserve(admitted.data, "alice", "image-total-next", request({ source: "Different source for pending quota" }), now), code("quota_exceeded"));
    assert.throws(() => reserve({ ...data, usage_events_json: [...data.usage_events_json, event("other_generation")] }, "alice", "image-total-other", request(), now), code("quota_exceeded"));
  }
  const pruned = profile({ image_generation_usage_json: { [start]: 3 }, usage_events_json: [] });
  assert.throws(() => reserve(pruned, "alice", "pruned-images", request(), now), code("quota_exceeded"));
  assert.equal(reserve(pruned, "alice", "next-month-images", request(), new Date("2026-11-01")).result.status, "reserved");
  const foreignAndOld = profile({ usage_events_json: [{ ...event("image_generation"), user_id: "bob" }, { ...event("image_generation"), created_at: "2026-09-01" }], image_generation_usage_json: { [start]: 2 } });
  assert.equal(reserve(foreignAndOld, "alice", "valid-images", request(), now).result.status, "reserved");
});

test("malformed durable image accounting fails closed before text admission or completion", () => {
  const start = "2026-10-01T00:00:00.000Z";
  for (const invalid of [[], "{}", 3, { bad: 1 }, { [start]: -1 }, { [start]: 1.5 }, { [start]: "1" }, { [start]: NaN }, { [start]: Number.MAX_SAFE_INTEGER + 1 }]) {
    const data = profile({ image_generation_usage_json: invalid });
    assert.throws(() => reserve(data, "alice", "invalid-images", request(), now), e => e.status === 503 && e.code === "invalid_usage");
    assert.equal(data.text_generation_attempts_json, undefined);
    const admission = reserve(profile(), "alice", "valid-admission", request(), now);
    assert.throws(() => complete({ ...admission.data, image_generation_usage_json: invalid }, "alice", "valid-admission", admission.result.fingerprint, result(), now), code("invalid_usage"));
  }
});

test("durable image accounting preserves all existing monthly plan limits and lifetime entitlements", () => {
  const start = "2026-10-01T00:00:00.000Z";
  for (const [extra, limit] of [[{}, 3], [{ plan: "pro_creator", subscription_status: "active" }, 50], [{ plan: "pro_studio", subscription_status: "active" }, 250], [{ plan: "founder", subscription_status: "active", entitlement_source: "founder_offer" }, 50], [{ plan: "pro_studio", subscription_status: "active", entitlement_source: "manual_lifetime_upgrade_cousin" }, 250]]) {
    const original = profile({ ...extra, generation_usage_json: { [start]: limit - 2 }, image_generation_usage_json: { [start]: 1 } });
    const admitted = reserve(original, "alice", "last-total-credit", request(), now);
    const saved = complete(admitted.data, "alice", "last-total-credit", admitted.result.fingerprint, result(), now).data;
    assert.equal(saved.generation_usage_json[start], limit - 1);
    assert.equal(saved.image_generation_usage_json[start], 1);
    assert.equal(saved.plan, original.plan);
    assert.equal(saved.entitlement_source, original.entitlement_source);
    assert.throws(() => reserve(saved, "alice", "beyond-total-credit", request(), now), code("quota_exceeded"));
  }
  const renewal = profile({ plan: "pro_studio", subscription_status: "active", subscription_current_period_end: "2026-10-25T00:00:00.000Z", image_generation_usage_json: { "2026-09-25T00:00:00.000Z": 250 } });
  assert.throws(() => reserve(renewal, "alice", "billing-window-full", request(), now), code("quota_exceeded"));
  assert.equal(reserve({ ...renewal, image_generation_usage_json: { [start]: 250 } }, "alice", "outside-billing-window", request(), now).result.status, "reserved");
});

test("100 daily attempts include failures across minute windows while replay and success credits stay independent", () => {
  let data = profile(), last;
  for (let i = 0; i < helpers.TEXT_ATTEMPT_BUDGET.dailyMax; i++) {
    const at = later(i * 60_000), id = `daily-attempt-${i}`;
    const admitted = reserve(data, "alice", id, request(), at);
    data = i === 99 ? complete(admitted.data, "alice", id, admitted.result.fingerprint, result(), at).data : fail(admitted.data, "alice", id, admitted.result.fingerprint, at).data;
    last = at;
  }
  assert.deepEqual(data.text_generation_daily_attempts_json, { day: "2026-10-18", count: 100 });
  assert.equal(data.generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
  assert.equal(data.usage_events_json.length, 1);
  const retry = Math.ceil((Date.parse("2026-10-19T00:00:00Z") - last.getTime()) / 1000);
  const before = JSON.stringify(data);
  assert.throws(() => reserve(data, "alice", "daily-attempt-101", request(), last), e => e.status === 429 && e.code === "generation_attempt_limit" && e.retryAfterSeconds === retry);
  assert.equal(reserve(data, "alice", "daily-attempt-99", request(), last).result.status, "replay");
  assert.throws(() => reserve(data, "alice", "daily-attempt-0", request(), last), code("request_failed"));
  assert.equal(JSON.stringify(data), before);
  const next = reserve(data, "alice", "daily-tomorrow", request(), new Date("2026-10-19T00:00:00Z"));
  assert.deepEqual(next.data.text_generation_daily_attempts_json, { day: "2026-10-19", count: 1 });
  assert.equal(next.data.generation_usage_json["2026-10-01T00:00:00.000Z"], 1);
  assert.equal(reserve(profile({ id: "bob" }), "bob", "daily-independent", request(), last).data.text_generation_daily_attempts_json.count, 1);
});

test("UTC daily rollover preserves rolling cap and Retry-After covers both limits", () => {
  const time = new Date("2026-10-18T23:59:50Z");
  const data = profile({ text_generation_attempts_json: Array(20).fill(time.getTime()), text_generation_daily_attempts_json: { day: "2026-10-18", count: 100 } });
  assert.throws(() => reserve(data, "alice", "daily-midnight", request(), time), e => e.retryAfterSeconds === 60);
  assert.throws(() => reserve(data, "alice", "daily-midnight", request(), new Date("2026-10-19T00:00:01Z")), e => e.retryAfterSeconds === 49);
  const next = reserve(data, "alice", "daily-midnight", request(), new Date("2026-10-19T00:00:50Z"));
  assert.deepEqual(next.data.text_generation_daily_attempts_json, { day: "2026-10-19", count: 1 });
  assert.equal(next.data.text_generation_attempts_json.length, 1);
  const both = { ...data, text_generation_attempts_json: Array(20).fill(now.getTime()) };
  assert.throws(() => reserve(both, "alice", "daily-both-limits", request(), now), e => e.retryAfterSeconds === 43200);
});

test("daily budget fails closed for corruption or backwards days and seeds known legacy attempts", () => {
  for (const invalid of [null, [], "{}", {}, { day: "2026-10-18", count: -1 }, { day: "2026-10-18", count: 101 }, { day: "2026-10-18", count: 1.5 }, { day: "2026-10-18", count: "1" }, { day: "2026-10-18", count: NaN }, { day: "2026-02-30", count: 0 }, { day: "2026-10-19", count: 1 }, { day: "garbage", count: 0 }]) {
    assert.throws(() => reserve(profile({ text_generation_daily_attempts_json: invalid }), "alice", "invalid-daily", request(), now), e => e.status === 503 && e.code === "invalid_attempt_budget");
  }
  const legacy = profile({ text_generation_attempts_json: [later(-60_000).getTime(), now.getTime()] });
  const migrated = reserve(legacy, "alice", "daily-migration", request(), now);
  assert.deepEqual(migrated.data.text_generation_daily_attempts_json, { day: "2026-10-18", count: 3 });
  assert.equal(migrated.data.text_generation_attempts_json.length, 2);
});

test("repository serializes the final daily slot and failures or failed writes never refund it", async () => {
  const h = repositoryHarness(), day = new Date().toISOString().slice(0, 10);
  h.rows.set("alice", profile({ text_generation_daily_attempts_json: { day, count: 99 } }));
  const outcomes = await Promise.allSettled([h.repo.reserveTextGeneration("alice", "daily-race-one", request()), h.repo.reserveTextGeneration("alice", "daily-race-two", request({ source: "Another daily race source" }))]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(x => x.status === "rejected").reason.code, "generation_attempt_limit");
  const admitted = outcomes.find(x => x.status === "fulfilled").value;
  await h.repo.failTextGeneration("alice", admitted.requestId, admitted.fingerprint);
  assert.equal(h.rows.get("alice").text_generation_daily_attempts_json.count, 100);
  const fresh = repositoryHarness();
  fresh.failWrites();
  await assert.rejects(fresh.repo.reserveTextGeneration("alice", "daily-write-failed", request()), /write failed/);
  assert.equal(fresh.rows.get("alice").text_generation_daily_attempts_json, undefined);
  assert.equal(fresh.rows.get("alice").text_generation_attempts_json, undefined);
});
