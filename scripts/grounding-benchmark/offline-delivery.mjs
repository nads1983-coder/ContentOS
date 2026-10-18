// No provider transport or credentials. Synthetic fixtures and mocked review certificates only.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { captured, grounding, batches, captureResponse } from "../../tests/grounding-capture-helpers.mjs";
import { harness, requestId } from "../../tests/generation-test-helpers.mjs";
const sha = value => createHash("sha256").update(value).digest("hex");
const oldDiagnostics = JSON.parse(readFileSync("docs/benchmarks/grounding-2026-10-18/offline-diagnostics.json", "utf8"));
const results = [];
for (const pack of captured) {
  const h = harness(), measurements = [];
  h.provider = payload => {
    const start = performance.now(), response = captureResponse(pack, payload);
    measurements.push({ stage: payload.text.format.name === "social_content_generation" ? "draft" : "review",
      requestBytes: Buffer.byteLength(JSON.stringify(payload)), inputBytes: Buffer.byteLength(payload.input),
      outputBytes: Buffer.byteLength(response.output_text), mockCpuMs: performance.now() - start,
      outputTokenLimit: payload.max_output_tokens });
    return response;
  };
  const started = performance.now();
  const done = await h.finish({ ...pack.request, requestId: requestId() });
  const elapsed = performance.now() - started;
  assert.equal(done.response.status, 200);
  const entry = h.data.generation_reservations_json[0], units = grounding.groundingUnits(pack.result);
  const reviews = measurements.filter(m => m.stage === "review");
  const batch = batches.groundingBatch(pack.result, pack.request, 0, 0);
  const oldInput = JSON.stringify({ sources: batch.context.sources, constraints: { noCta: batch.context.noCta, instructions: batch.context.instructions },
    units: units.map(u => ({ ...u, findings: grounding.deterministicIssues(u, batch.context) })) });
  // Scenario, not a tokenizer measurement or a model-performance prediction.
  // Includes fresh uncached instructions/schema/context on every review call.
  const reviewScenarioUsd = reviews.reduce((sum, m) => sum + (m.requestBytes / 4 * 1.75 + m.outputBytes / 4 * 14) / 1e6, 0);
  results.push({ id: pack.id, formats: done.body.sections.length, coveredUnits: entry.pipelineAudit.reviewedUnits,
    expectedUnits: units.length, unchangedUnits: true, deterministicFlags: units.filter(u => grounding.deterministicIssues(u, batch.context).length).length,
    offlineCompleted: true, offlineExecutionMs: elapsed, mockCertificateCpuMs: measurements.reduce((sum, m) => sum + m.mockCpuMs, 0),
    liveDraftLatencyMs: pack.evidence.latencyMs, liveDraftCostUsd: pack.evidence.costUsd,
    actualReviewLatencyMs: null, actualReviewCostUsd: null,
    callsIfInitialReviewPasses: measurements.length, reviewBatches: reviews.length,
    maximumCallsWithFullCorrectionRevalidation: 1 + 2 * reviews.length,
    previousMonolithicInputBytesWithCurrentAnnotations: Buffer.byteLength(oldInput),
    capturedOriginalMonolithicRequestBytes: oldDiagnostics.packs.find(p => p.packId === `${pack.id}:candidate`).reviewSerializedRequestBytes,
    maximumBatchRequestBytes: Math.max(...reviews.map(m => m.requestBytes)),
    maximumBatchInputBytes: Math.max(...reviews.map(m => m.inputBytes)), totalBatchRequestBytes: reviews.reduce((sum, m) => sum + m.requestBytes, 0),
    mockedReviewOutputBytes: reviews.reduce((sum, m) => sum + m.outputBytes, 0),
    illustrativeKnownDraftPlusReviewUsd: pack.evidence.costUsd + reviewScenarioUsd,
    actualInitialPassReservationUsd: entry.pipelineAudit.reservedMicroUsd / 1e6,
    hypotheticalWallTimeSeconds: [10, 20, 40].map(reviewSeconds => ({ assumedReviewSeconds: reviewSeconds,
      sequential: pack.evidence.latencyMs / 1000 + reviews.length * reviewSeconds,
      parallelTwo: pack.evidence.latencyMs / 1000 + Math.ceil(reviews.length / 2) * reviewSeconds })),
    stages: measurements });
}
const report = {
  recordedAt: new Date().toISOString(), kind: "offline-mocked-delivery-not-live-validation", paidCalls: 0,
  sourceHashes: Object.fromEntries(["lib/generation-pipeline.ts", "lib/generation-stages.ts", "lib/grounding-batches.ts", "lib/factual-grounding.ts", "app/api/generate/route.ts"].map(p => [p, sha(readFileSync(p))])),
  limitations: [
    "Review decisions are mechanical test certificates, not independent semantic judgments. They prove orchestration and coverage only.",
    "Offline execution time excludes live provider and database latency; it is not an end-to-end customer latency estimate.",
    "No successful prior live review exists to calibrate review throughput. Latency scenarios are assumptions, not measured speedups.",
    "Illustrative costs use four UTF-8 bytes per token and mocked review output sizes. Actual tokenizer/reasoning output/caching may differ.",
    "Reservations use one byte per input token plus framing, capped output and a 25% buffer. Unknown/failed admissions remain reserved.",
    "Parallel-two is an analytical alternative only; the implemented journal intentionally admits one call at a time per account attempt."
  ], results,
  totalCoverage: results.reduce((sum, r) => sum + r.coveredUnits, 0),
  releaseVerdict: "NO-GO pending separately authorized end-to-end live validation"
};
writeFileSync("docs/benchmarks/grounding-2026-10-18/offline-delivery.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ kind: report.kind, coverage: report.totalCoverage, paidCalls: 0, results: results.map(({ stages, ...r }) => r) }, null, 2));
