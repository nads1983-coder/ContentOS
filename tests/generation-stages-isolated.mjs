import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { loadTs, input, receipt, reviewReceipt } from "./generation-test-helpers.mjs";
import { captured, captureResponse } from "./grounding-capture-helpers.mjs";
import { request as classificationRequest, draft as classificationDraft, classificationResponse } from "./classification-capture-helpers.mjs";
import { request as scopeRequest, draft as scopeDraft, scopeResponse } from "./scope-capture-helpers.mjs";
import { request as parentheticalRequest, draft as parentheticalDraft, seedCapturedDraft, parentheticalResponse } from "./parenthetical-capture-helpers.mjs";
import { finalClassificationResponse } from "./final-classification-capture-helpers.mjs";
import { disagreementResponse } from "./review-disagreement-capture-helpers.mjs";
import { validateImageIsolatedEnvironment } from "./image-isolated.mjs";

// Opt-in, existing isolated Neon only. No auth records, mail, Stripe or provider calls.
validateImageIsolatedEnvironment(process.env);
const cache = new Map(), runtime = { process, fetch: async () => { throw new Error("Network provider calls forbidden"); } };
const repository = loadTs("lib/postgres-repository.ts", { "server-only": {} }, cache, runtime);
const { getPool, getDb } = loadTs("lib/db/client.ts", { "server-only": {} }, cache, runtime);
const contract = loadTs("lib/generation-contract.ts", {}, cache, runtime);
const pool = getPool(), prefix = `stages-isolated-${randomUUID()}`, fixtures = [], checks = [];
async function fixture(name, capturedRequest) {
  const id = `${prefix}-${name}`, email = `${id}@example.invalid`;
  fixtures.push({ id, email });
  const data = {
    id, email, plan: "pro_studio", subscription_status: "active", stages_isolated_run: prefix,
    entitlement_source: "founder_offer", amount_paid: 0, retained_history: ["synthetic prior work"]
  };
  await pool.query("INSERT INTO contentos_app.profiles (id,email,data) VALUES ($1,$2,$3::jsonb)", [id, email, JSON.stringify(
    capturedRequest ? seedCapturedDraft(data, capturedRequest) : data)]);
  return id;
}
async function read(id) {
  const r = await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1 AND data->>'stages_isolated_run'=$2", [id, prefix]);
  assert.equal(r.rowCount, 1); return r.rows[0].data;
}
try {
  const id = await fixture("concurrency"), req = contract.normalizeGenerationRequest(input({ requestId: randomUUID() }));
  const results = await Promise.all([0, 1, 2].map(() => repository.beginTextGenerationStage(id, req.requestId, req, null)));
  const winner = results.find(r => r.status === "dispatch");
  assert.equal(results.filter(r => r.status === "dispatch").length, 1);
  assert.equal(results.filter(r => r.status === "progress" && r.progress.running).length, 2);
  checks.push("separate pooled transactions admit exactly one provider stage");
  const checkpoint = () => repository.checkpointTextGenerationStage(id, req.requestId, winner.fingerprint, winner.stage, req, receipt(), 45_151);
  await Promise.all([checkpoint(), checkpoint()]);
  let row = await read(id);
  assert.equal(row.generation_reservations_json[0].pipeline.metrics.length, 1);
  assert.equal(row.text_generation_daily_attempts_json.count, 1);
  checks.push("repeated/lost-ack checkpoint is idempotent, preserves original admission");
  const lookup = await repository.beginTextGenerationStage(id, req.requestId, req, null);
  assert.equal(lookup.status, "progress"); assert.equal(lookup.progress.stage, "review");
  const review = await repository.beginTextGenerationStage(id, req.requestId, req, lookup.progress.nextStage);
  assert.equal(review.status, "dispatch");
  await repository.checkpointTextGenerationStage(id, req.requestId, review.fingerprint, review.stage, req, reviewReceipt(review.stage.payload), 60_000);
  assert.ok((await read(id)).generation_reservations_json[0].pipeline.metrics.reduce((sum, m) => sum + m.durationMs, 0) > 90_000);
  checks.push("draft plus review can exceed the former shared deadline using separate durable stages");
  const ready = await repository.beginTextGenerationStage(id, req.requestId, req, null);
  const actualDb = getDb();
  const failing = loadTs("lib/postgres-repository.ts", { "server-only": {}, "@/lib/db/client": { getDb: () => ({
    transaction: fn => actualDb.transaction(async tx => { await fn(tx); throw new Error("Synthetic rollback"); })
  }) } }, new Map(), runtime);
  await assert.rejects(failing.beginTextGenerationStage(id, req.requestId, req, ready.progress.nextStage));
  row = await read(id); assert.equal(row.generation_history_json, undefined); assert.equal(row.generation_reservations_json[0].pipeline.phase, "save");
  checks.push("real PostgreSQL final-save rollback retains validated checkpoint without charging");
  const completed = await Promise.all([0, 1, 2].map(() => repository.beginTextGenerationStage(id, req.requestId, req, ready.progress.nextStage)));
  assert.ok(completed.every(r => r.status === "replay")); row = await read(id);
  assert.equal(row.usage_events_json.length, 1); assert.equal(row.generation_history_json.length, 1);
  assert.equal(row.entitlement_source, "founder_offer"); assert.deepEqual(row.retained_history, ["synthetic prior work"]);
  checks.push("concurrent final saves converge, with one charge and unchanged lifetime entitlement/history");
  const other = await fixture("other");
  await assert.rejects(repository.checkpointTextGenerationStage(other, req.requestId, winner.fingerprint, winner.stage, req, receipt(), 1));
  assert.equal((await read(other)).generation_reservations_json, undefined);
  checks.push("account isolation refuses another account's stage checkpoint");
  const crash = await fixture("crash"), crashReq = contract.normalizeGenerationRequest(input({ requestId: randomUUID() }));
  const started = await repository.beginTextGenerationStage(crash, crashReq.requestId, crashReq, null);
  const stale = await repository.beginTextGenerationStage(crash, crashReq.requestId, crashReq, null, new Date(Date.now() + 121_000));
  assert.equal(stale.progress.code, "generation_uncertain");
  row = await read(crash); assert.equal(row.generation_reservations_json[0].pipeline.reservedMicroUsd, started.stage.reservedMicroUsd);
  checks.push("crash/lost result becomes terminal uncertainty with nonrefunded spending and no lease takeover");
  const capturedResults = [];
  const disagreement = process.argv.includes("--only-disagreement");
  const finalClassification = process.argv.includes("--only-final-classification") || disagreement;
  const packs = [...(process.argv.includes("--only-parenthetical") || finalClassification ? [] : captured), ...(process.argv.includes("--include-classification") ? [{ id: "ShelfNotes", request: classificationRequest, result: classificationDraft }] : []),
    ...(process.argv.includes("--include-scope") ? [{id:"Fieldline",request:scopeRequest,result:scopeDraft}] : []),
    ...(process.argv.includes("--only-parenthetical") || finalClassification ? [{id:"Orin",request:parentheticalRequest,result:parentheticalDraft}] : [])];
  for (const pack of packs) {
    const request = { ...pack.request, requestId: randomUUID() };
    const target = await fixture(`capture-${pack.id}`, pack.id === "Orin" ? request : undefined);
    let expected = null, calls = 0, delivered = false;
    const start = performance.now(), timings = [];
    for (let n = 0; n < 30; n++) {
      const stageStarted = performance.now();
      const admitted = await repository.beginTextGenerationStage(target, request.requestId, request, expected);
      if (admitted.status === "replay") {
        assert.equal(admitted.result.sections.length, 14); delivered = true; break;
      }
      if (admitted.status === "progress") {
        assert.notEqual(admitted.progress.status, "failed"); expected = admitted.progress.nextStage; continue;
      }
      calls++;
      const providerStarted = performance.now(), response = pack.id === "Orin" ? (disagreement ? disagreementResponse : finalClassification ? finalClassificationResponse : parentheticalResponse)(admitted.stage.payload) : pack.id === "Fieldline" ? scopeResponse(admitted.stage.payload) : pack.id === "ShelfNotes" ? classificationResponse(admitted.stage.payload) : captureResponse(pack, admitted.stage.payload);
      const progress = await repository.checkpointTextGenerationStage(target, request.requestId, admitted.fingerprint,
        admitted.stage, request, response, performance.now() - providerStarted);
      assert.notEqual(progress.status, "failed"); expected = progress.nextStage;
      timings.push({ stage: admitted.stage.kind, databaseAndMockMs: performance.now() - stageStarted });
    }
    assert.equal(delivered, true);
    const elapsed = performance.now() - start, saved = await read(target);
    assert.equal(saved.generation_history_json.length, 1); assert.equal(saved.usage_events_json.length, 1);
    const repeated = await repository.beginTextGenerationStage(target, request.requestId, request, null);
    assert.equal(repeated.status, "replay");
    const afterReplay = await read(target);
    assert.equal(afterReplay.generation_history_json.length, 1); assert.equal(afterReplay.usage_events_json.length, 1);
    capturedResults.push({ id: pack.id, isolatedDatabaseAndMockExecutionMs: elapsed, mockProviderCalls: calls,
      reviewedUnits: saved.generation_reservations_json[0].pipelineAudit.reviewedUnits,
      correctionStages: saved.generation_reservations_json[0].pipelineAudit.metrics.filter(m => m.kind === "correction").length,
      fullRevalidationBatches: saved.generation_reservations_json[0].pipelineAudit.metrics.filter(m => m.kind === "revalidation").length,
      formats: 14, finalHistoryEntries: 1, successfulUsageEvents: 1, duplicateSaveAddedEntries: 0,
      capturedReviewReceipts: pack.id === "Orin" ? (disagreement ? 3 : finalClassification ? 2 : 1) : 0, timings });
    checks.push(`${pack.id}: captured 14-format pack persisted once with real isolated row locks and mocked review certificates`);
  }
  writeFileSync(process.argv.find(a => a.startsWith("--report="))?.slice(9) ?? "/tmp/contentos-isolated-delivery.json", JSON.stringify({
    recordedAt: new Date().toISOString(), paidCalls: 0, productionWrites: 0,
    limitations: ["Real isolated Neon transactions, synthetic fixtures and mechanical mock review certificates; not live AI validation.",
      "Timings include local processing and warm isolated database network latency, but no model latency. Not production performance."],
    checks, results: capturedResults
  }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "PASS", checks, providerCalls: 0, productionWrites: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", checks, assertion: error instanceof assert.AssertionError ? error.message.split("\n")[0] : "isolated operation failed" }));
  process.exitCode = 1;
} finally {
  try {
    for (const f of fixtures) await pool.query("DELETE FROM contentos_app.profiles WHERE id=$1 AND email=$2 AND data->>'stages_isolated_run'=$3", [f.id, f.email, prefix]);
    console.log("Synthetic stage fixtures removed; existing records and benchmark audit retained.");
  } catch { console.error("Synthetic stage cleanup needs review."); process.exitCode = 1; }
  await pool.end();
}
