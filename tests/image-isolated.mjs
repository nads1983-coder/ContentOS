import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { loadTs, imageInput, resultFixture } from "./image-test-helpers.mjs";

const { console } = globalThis;
const branch = "br-divine-term-b2rihbxv";
const hosts = ["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech", "ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"];

// This opt-in integration script is deliberately outside the *.test.mjs glob.
export function validateImageIsolatedEnvironment(env) {
  let url;
  try { url = new URL(env.DATABASE_URL ?? "http://invalid"); } catch { throw new Error("Isolated database configuration rejected."); }
  if (env.CONTENTOS_ISOLATED_BRANCH !== branch || !hosts.includes(url.hostname) ||
      !["postgres:", "postgresql:"].includes(url.protocol) || !["", "5432"].includes(url.port) || url.pathname !== "/contentos" ||
      [...url.searchParams.keys()].some(key => !["sslmode", "channel_binding"].includes(key)) ||
      new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length ||
      !["require", "verify-full", "verify-ca"].includes(url.searchParams.get("sslmode")) ||
      ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "OPENAI_API_KEY"].some(key => Boolean(env[key]))) {
    throw new Error("Isolated database configuration rejected.");
  }
}

export async function runImageIsolated() {
  // Validate before loading any database module or creating a connection.
  validateImageIsolatedEnvironment(process.env);
  let providerCalls = 0;
  const runtime = { process, fetch: async () => { providerCalls++; throw new Error("Provider calls forbidden in isolated image integration."); } };
  const cache = new Map(), mocks = { "server-only": {} };
  const repository = loadTs("lib/postgres-repository.ts", mocks, cache, runtime);
  const { getPool, getDb } = loadTs("lib/db/client.ts", mocks, cache, runtime);
  const pool = getPool(), prefix = `image-isolated-${randomUUID()}`, fixtures = [], checks = [];
  const now = new Date(), periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  let phase = "create synthetic fixtures";
  let readMetrics;

  async function fixture(name, patch = {}) {
    const id = `${prefix}-${name}`, email = `${id}@example.invalid`;
    const data = { plan: "pro_studio", subscription_status: "active", ...patch, id, email, image_isolated_run: prefix };
    const saved = { id, email };
    // Register before INSERT so a lost acknowledgement is still cleanup-safe.
    fixtures.push(saved);
    await pool.query("INSERT INTO contentos_app.profiles (id,email,data) VALUES ($1,$2,$3::jsonb)", [id, email, JSON.stringify(data)]);
    return saved;
  }
  async function read(saved) {
    const rows = await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1 AND email=$2 AND data->>'image_isolated_run'=$3", [saved.id, saved.email, prefix]);
    assert.equal(rows.rowCount, 1, "synthetic fixture exists");
    return rows.rows[0].data;
  }
  async function replace(saved, data) {
    const update = await pool.query("UPDATE contentos_app.profiles SET data=$1::jsonb WHERE id=$2 AND email=$3 AND data->>'image_isolated_run'=$4", [JSON.stringify(data), saved.id, saved.email, prefix]);
    assert.equal(update.rowCount, 1, "only synthetic fixture updated");
  }
  function admitted(outcomes, expected, code) {
    const successes = outcomes.filter(item => item.status === "fulfilled").map(item => item.value);
    assert.equal(successes.length, expected, "expected number of locked admissions");
    for (const item of outcomes.filter(item => item.status === "rejected")) assert.equal(item.reason.code, code, "expected admission denial");
    return successes;
  }
  const input = (label = "original") => imageInput({ requestId: randomUUID(), outputText: `Synthetic image integration ${label}. No customer content.` });
  const completed = label => resultFixture({ createdAt: new Date().toISOString(), warning: `Synthetic fixture ${label}` });

  try {
    phase = "concurrent last-credit admission and idempotent completion";
    const quota = await fixture("quota", { image_generation_usage_json: { [periodStart]: 99 } });
    const requests = [input("quota-a"), input("quota-b"), input("quota-c")];
    const [winner] = admitted(await Promise.allSettled(requests.map(request => repository.reserveImageGeneration(quota.id, request))), 1, "image_quota_exceeded");
    assert.equal(winner.status, "reserved");
    const savedResult = completed("quota");
    const finishes = await Promise.all([0, 1, 2].map(() => repository.completeImageGeneration(quota.id, winner.requestId, winner.fingerprint, savedResult)));
    for (const result of finishes) assert.deepEqual(result, savedResult);
    let data = await read(quota);
    assert.equal(data.image_generation_usage_json[periodStart], 100);
    assert.equal(data.usage_events_json.length, 1);
    assert.equal(data.image_generation_attempts_json.count, 1);
    await replace(quota, { ...data, usage_events_json: [] });
    assert.equal(await repository.getMonthlyUsageCount({ userId: quota.id, eventType: "image_generation" }), 100);
    assert.equal(await repository.getMonthlyUsageCount({ userId: quota.id }), 100);
    assert.equal((await repository.reserveImageGeneration(quota.id, requests.find(item => item.requestId === winner.requestId))).status, "replay");
    await assert.rejects(repository.reserveImageGeneration(quota.id, input("over-quota")), error => error.code === "image_quota_exceeded");
    checks.push(phase);

    phase = "same-ID and identical-payload deduplication under real row locks";
    const duplicate = await fixture("duplicate"), same = input("same");
    const [first] = admitted(await Promise.allSettled([0, 1, 2].map(() => repository.reserveImageGeneration(duplicate.id, same))), 1, "request_in_progress");
    await assert.rejects(repository.reserveImageGeneration(duplicate.id, { ...same, requestId: randomUUID() }), error => error.code === "duplicate_in_progress");
    await repository.failImageGeneration(duplicate.id, first.requestId, first.fingerprint);
    await assert.rejects(repository.reserveImageGeneration(duplicate.id, same), error => error.code === "request_failed");
    data = await read(duplicate);
    assert.equal(data.image_generation_attempts_json.count, 1);
    assert.equal(data.image_generation_usage_json[periodStart], 0);
    checks.push(phase);

    phase = "concurrency cap and idempotent failure release";
    const concurrent = await fixture("concurrent");
    const pending = admitted(await Promise.allSettled(["a", "b", "c"].map(label => repository.reserveImageGeneration(concurrent.id, input(`concurrent-${label}`)))), 2, "image_concurrency_limit");
    await Promise.all([0, 1].map(() => repository.failImageGeneration(concurrent.id, pending[0].requestId, pending[0].fingerprint)));
    assert.equal((await repository.reserveImageGeneration(concurrent.id, input("concurrent-new"))).status, "reserved");
    data = await read(concurrent);
    assert.equal(data.image_generation_reservations_json.length, 2);
    assert.equal(data.image_generation_attempts_json.count, 3);
    assert.equal(data.image_generation_usage_json[periodStart], 0);
    checks.push(phase);

    phase = "last attempt slot is durable across concurrent failures";
    const attemptTime = new Date();
    const attempts = await fixture("attempts", { image_generation_attempts_json: { day: attemptTime.toISOString().slice(0, 10), count: 5, recent: Array(5).fill(attemptTime.toISOString()) } });
    const [attempt] = admitted(await Promise.allSettled(["a", "b", "c"].map(label => repository.reserveImageGeneration(attempts.id, input(`attempt-${label}`)))), 1, "image_attempt_limit");
    await repository.failImageGeneration(attempts.id, attempt.requestId, attempt.fingerprint);
    await assert.rejects(repository.reserveImageGeneration(attempts.id, input("after-failure")), error => error.code === "image_attempt_limit" && error.retryAfterSeconds > 0);
    assert.equal((await read(attempts)).image_generation_attempts_json.count, 6);
    checks.push(phase);

    phase = "completion SQL rollback preserves hold and successful usage remains zero";
    const rollback = await fixture("rollback"), uncertainInput = input("rollback");
    const held = await repository.reserveImageGeneration(rollback.id, uncertainInput);
    const actualDb = getDb();
    const failingDb = { transaction: fn => actualDb.transaction(async tx => {
      await fn(tx); // Execute the real completion UPDATE, then force PostgreSQL rollback.
      throw new Error("Synthetic completion rollback");
    }) };
    const failingRepository = loadTs("lib/postgres-repository.ts", { "server-only": {}, "@/lib/db/client": { getDb: () => failingDb } }, new Map(), runtime);
    await assert.rejects(failingRepository.completeImageGeneration(rollback.id, held.requestId, held.fingerprint, completed("rollback")), /Synthetic completion rollback/);
    data = await read(rollback);
    assert.equal(data.image_generation_reservations_json[0].status, "reserved");
    assert.equal(data.image_generation_usage_json[periodStart], 0);
    assert.equal(data.usage_events_json, undefined);
    assert.equal(data.image_generation_attempts_json.count, 1);
    await assert.rejects(repository.reserveImageGeneration(rollback.id, uncertainInput), error => error.code === "request_in_progress");
    checks.push(phase);

    phase = "lost completion acknowledgement recovers through replay without another charge";
    const recoveredResult = completed("recovered");
    await assert.rejects((async () => {
      await repository.completeImageGeneration(rollback.id, held.requestId, held.fingerprint, recoveredResult);
      throw new Error("Synthetic acknowledgement loss");
    })(), /Synthetic acknowledgement loss/);
    const replay = await repository.reserveImageGeneration(rollback.id, uncertainInput);
    assert.equal(replay.status, "replay");
    assert.deepEqual(replay.result, recoveredResult);
    assert.equal((await read(rollback)).image_generation_usage_json[periodStart], 1);
    checks.push(phase);

    phase = "same request ID remains isolated between synthetic accounts";
    const other = await fixture("other"), otherAdmission = await repository.reserveImageGeneration(other.id, uncertainInput);
    assert.equal(otherAdmission.status, "reserved");
    await repository.completeImageGeneration(other.id, otherAdmission.requestId, otherAdmission.fingerprint, completed("other"));
    assert.equal((await repository.reserveImageGeneration(rollback.id, uncertainInput)).result.warning, recoveredResult.warning);
    assert.notEqual((await repository.reserveImageGeneration(other.id, uncertainInput)).result.warning, recoveredResult.warning);
    checks.push(phase);

    phase = "expired crash reservation becomes terminal without regenerating";
    const expired = await fixture("expired"), expiredInput = input("expired");
    await repository.reserveImageGeneration(expired.id, expiredInput);
    data = await read(expired);
    data.image_generation_reservations_json[0].createdAt = new Date(Date.now() - 16 * 60000).toISOString();
    await replace(expired, data);
    await assert.rejects(repository.reserveImageGeneration(expired.id, expiredInput), error => error.code === "request_expired");
    await repository.reserveImageGeneration(expired.id, input("explicit-new"));
    assert.equal(Object.keys((await read(expired)).image_generation_tombstones_json).length, 1);
    checks.push(phase);

    phase = "SQL reader projection reduces synthetic payload while locked writes preserve replay";
    const projected = await fixture("projection", { image_generation_usage_json: { [periodStart]: 7 }, generation_usage_json: { [periodStart]: 3 } });
    const discardedInput = input("projection-terminal"), discarded = await repository.reserveImageGeneration(projected.id, discardedInput);
    await repository.failImageGeneration(projected.id, discarded.requestId, discarded.fingerprint);
    const textInput = { source: "Synthetic isolated text reservation. No customer data.", tone: "professional", sharpness: "balanced", ctaMode: "soft", presetTopic: "none", selectedTypes: ["linkedin"] };
    const textFailed = await repository.reserveTextGeneration(projected.id, "projection-failed-text", textInput);
    await repository.failTextGeneration(projected.id, textFailed.requestId, textFailed.fingerprint);
    const textPending = await repository.reserveTextGeneration(projected.id, "projection-pending-text", textInput);
    const largeInput = input("projection-retained"), large = await repository.reserveImageGeneration(projected.id, largeInput);
    const largeResult = completed("projection");
    largeResult.creditCharged = false;
    largeResult.image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><desc>${"A".repeat(1_000_000)}</desc></svg>`)}`;
    await repository.completeImageGeneration(projected.id, large.requestId, large.fingerprint, largeResult);
    const startedFull = performance.now(), full = await read(projected);
    const excluded = ["image_generation_reservations_json", "image_generation_tombstones_json", "generation_reservations_json", "generation_tombstones_json"];
    const retained = Object.fromEntries(excluded.map(key => [key, full[key]]));
    readMetrics = { fixturePayloadCharacters: 1_000_000, full: { jsonBytes: Buffer.byteLength(JSON.stringify(full)), elapsedMs: Number((performance.now() - startedFull).toFixed(2)) }, projected: [] };
    let readerLabel;
    // Observe rows returned by the actual SQL query before public profile mapping.
    const observedDb = {
      select: fields => ({ from: table => ({ where: predicate => ({ limit: async count => {
        const query = getDb().select(fields).from(table).where(predicate).limit(count);
        for (const key of excluded) assert.ok(query.toSQL().sql.includes(`'${key}'`), "SQL excludes replay field");
        const started = performance.now(), rows = await query;
        assert.equal(rows.length, 1);
        for (const key of excluded) assert.equal(Object.hasOwn(rows[0].data, key), false, "replay bytes did not cross database boundary");
        assert.equal(rows[0].data.image_generation_usage_json[periodStart], 7);
        assert.equal(rows[0].data.generation_usage_json[periodStart], 3);
        readMetrics.projected.push({ reader: readerLabel, jsonBytes: Buffer.byteLength(JSON.stringify(rows[0].data)), elapsedMs: Number((performance.now() - started).toFixed(2)) });
        return rows;
      } }) }) }),
      transaction: fn => getDb().transaction(fn)
    };
    const readerRepository = loadTs("lib/postgres-repository.ts", { "server-only": {}, "@/lib/db/client": { getDb: () => observedDb } }, new Map(), runtime);
    readerLabel = "getUserProfile";
    assert.equal((await readerRepository.getUserProfile(projected.id)).id, projected.id);
    readerLabel = "getUserProfileByEmail";
    assert.equal((await readerRepository.getUserProfileByEmail(projected.email.toUpperCase())).id, projected.id);
    readerLabel = "getWorkspace";
    const workspace = await readerRepository.getWorkspace(projected.id);
    readerLabel = "listBrandProfiles";
    assert.deepEqual(await readerRepository.listBrandProfiles(projected.id), []);
    readerLabel = "getMonthlyUsageCount";
    assert.equal(await readerRepository.getMonthlyUsageCount({ userId: projected.id }), 10);
    for (const sample of readMetrics.projected) assert.ok(sample.jsonBytes < readMetrics.full.jsonBytes / 20, "synthetic JSON payload reduced by at least 95 percent");
    await readerRepository.saveWorkspace(projected.id, { revision: workspace.revision, store: workspace.store, preferences: { ...workspace.preferences, brandName: "Projection-safe workspace" } });
    const after = await read(projected);
    assert.deepEqual(Object.fromEntries(excluded.map(key => [key, after[key]])), retained);
    assert.deepEqual((await repository.reserveImageGeneration(projected.id, largeInput)).result, largeResult);
    await assert.rejects(repository.reserveImageGeneration(projected.id, discardedInput), error => error.code === "request_failed");
    await assert.rejects(repository.reserveTextGeneration(projected.id, textPending.requestId, textInput), error => error.code === "request_in_progress");
    await assert.rejects(repository.reserveTextGeneration(projected.id, textFailed.requestId, textInput), error => error.code === "request_failed");
    checks.push(phase);
    assert.equal(providerCalls, 0);
    console.log(JSON.stringify({ status: "PASS", checks, readMetrics, providerCalls, productionWrites: 0, fixturePrefix: prefix }, null, 2));
  } catch {
    // Never print SQL, connection strings, driver exceptions, or data payloads.
    console.error(JSON.stringify({ status: "FAIL", phase, completedChecks: checks, fixturePrefix: prefix }));
    process.exitCode = 1;
  } finally {
    try {
      const removed = await pool.query("DELETE FROM contentos_app.profiles WHERE id=ANY($1::text[]) AND email LIKE $2 AND data->>'image_isolated_run'=$3", [fixtures.map(item => item.id), `${prefix}-%@example.invalid`, prefix]);
      console.log(JSON.stringify({ cleanup: "synthetic image profiles removed", removed: removed.rowCount, fixturePrefix: prefix }));
    } catch {
      console.error(JSON.stringify({ cleanup: "review required", fixturePrefix: prefix }));
      process.exitCode = 1;
    } finally { await pool.end(); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--validate-only")) {
      validateImageIsolatedEnvironment(process.env);
      console.log("Isolated image integration configuration accepted; no connection opened.");
    } else await runImageIsolated();
  } catch {
    console.error("Isolated image integration could not start; no raw diagnostic details logged.");
    process.exitCode = 1;
  }
}
