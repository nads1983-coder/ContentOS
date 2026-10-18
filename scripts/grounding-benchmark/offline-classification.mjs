// No network/provider implementation. Historical inputs remain immutable.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { captured, captureResponse, grounding } from "../../tests/grounding-capture-helpers.mjs";
import { request, draft, live, repairs, findings, classificationResponse } from "../../tests/classification-capture-helpers.mjs";
import { harness, requestId } from "../../tests/generation-test-helpers.mjs";
const directory = "docs/benchmarks/classification-2026-10-18";
const sha = p => createHash("sha256").update(readFileSync(p)).digest("hex");
const results = [];
for (const [i, pack] of [...captured, { id: "ShelfNotes", request, result: draft }].entries()) {
  const h = harness(), seen = { initial_review: new Set(), fresh_final_revalidation: new Set() }, stages = [];
  h.provider = payload => {
    const started = performance.now();
    let pass = "draft";
    if (payload.text.format.name !== "social_content_generation") {
      const data = JSON.parse(payload.input); pass = data.pass;
      for (const u of data.units) { assert.ok(!seen[pass].has(u.id)); seen[pass].add(u.id); }
      assert.equal(h.data.generation_history_json, undefined);
    }
    const response = pack.id === "ShelfNotes" ? classificationResponse(payload) : captureResponse(pack, payload);
    stages.push({ pass, requestBytes: Buffer.byteLength(JSON.stringify(payload)), outputBytes: Buffer.byteLength(response.output_text),
      mockCpuMs: performance.now() - started, outputTokenLimit: payload.max_output_tokens });
    return response;
  };
  const started = performance.now(), req = { ...pack.request, requestId: requestId(i + 1) };
  const done = await h.finish(req);
  const elapsedMs = performance.now() - started;
  assert.equal(done.response.status, 200);
  assert.equal(seen.initial_review.size, grounding.groundingUnits(pack.result).length);
  assert.equal(seen.fresh_final_revalidation.size, grounding.groundingUnits(done.body).length);
  assert.equal(h.data.usage_events_json.length, 1); assert.equal(h.data.generation_history_json.length, 1);
  const callCount = h.calls.length;
  assert.equal((await h.post(req)).response.status, 200); assert.equal(h.calls.length, callCount);
  results.push({ id: pack.id, formats: done.body.sections.length, originalReviewedUnits: seen.initial_review.size,
    freshlyRevalidatedUnits: seen.fresh_final_revalidation.size, offlineRouteMs: elapsedMs, mockedCalls: callCount,
    actualProviderCalls: 0, actualNewApiCost: 0, reservedMicroUsd: h.data.generation_reservations_json[0].pipelineAudit.reservedMicroUsd,
    successfulUsageEvents: 1, historyEntries: 1, finalReplayWithoutProvider: true, stages });
  if (pack.id === "ShelfNotes") {
    // Synthetic diagnostic artifact, explicitly not independently certified.
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${directory}/offline-corrected-pack.json`, JSON.stringify({ ...done.body, id: "offline-synthetic-pack", createdAt: "2026-10-18T00:00:00.000Z" }, null, 2) + "\n");
  }
}
const originalFiles = [
  "docs/benchmarks/grounding-2026-10-18/execution-audit.json", "docs/benchmarks/grounding-2026-10-18/adapted-inputs.json",
  "docs/benchmarks/staged-delivery-2026-10-18/execution.json", "docs/benchmarks/staged-delivery-2026-10-18/brief.json",
  "docs/benchmarks/staged-delivery-2026-10-18/raw-draft.json", "docs/benchmarks/staged-delivery-2026-10-18/independent-assessment.json",
  "tests/fixtures/grounding-regressions.json"
];
const report = { kind: "offline-scripted-classification-and-orchestration-not-live-validation", recordedAt: new Date().toISOString(),
  originalEvidenceHashes: Object.fromEntries(originalFiles.map(p => [p, sha(p)])),
  implementationHashes: Object.fromEntries(["lib/factual-grounding.ts", "lib/prompts.ts"].map(p => [p, sha(p)])),
  originalLiveFirstBatchDecisionsReplayedUnchanged: JSON.parse(live.jobs[1].evidence.outputText).decisions.length,
  originalDisagreementsNowAccepted: 4, independentlyFlaggedMaterialCasesGuarded: findings.length,
  reviewedOriginalUnits: results.reduce((sum, r) => sum + r.originalReviewedUnits, 0),
  freshlyRevalidatedUnits: results.reduce((sum, r) => sum + r.freshlyRevalidatedUnits, 0),
  paidCalls: 0, productionWrites: 0, repairs, results,
  limitations: ["Original captures and the independent assessment are unchanged. Repairs are explicit offline regression decisions, not new model responses.",
    "The original 48-unit first review is replayed exactly. All other review decisions are scripted/mechanical TEST certificates, not independent semantic certification.",
    "Route time excludes provider/network/database latency. Token-priced live cost and model reliability remain unknown.",
    "Final fixtures prove coverage, correction, persistence and retry orchestration, not that a live reviewer will approve all units or catch all semantic issues.",
    "Prompt variety improvements are unmeasured until a new approved live run. No zero-fabrication or production-readiness claim is made."],
  verdict: "NO-GO pending complete independently assessed live delivery" };
writeFileSync(`${directory}/offline-replay.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ verdict: report.verdict, reviewedOriginalUnits: report.reviewedOriginalUnits,
  freshlyRevalidatedUnits: report.freshlyRevalidatedUnits, results: results.map(({ stages, ...rest }) => rest), paidCalls: 0 }, null, 2));
