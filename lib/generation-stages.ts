import { reserveGenerationInProfile, matchingReservation, completeGenerationInProfile, GenerationReservationError } from "@/lib/generation-reservation";
import type { Reservation } from "@/lib/generation-reservation";
import { PIPELINE_LIMITS, newGenerationPipeline, pipelineKey, pipelineProgress, planProviderStage,
  applyDraft, finishReviewBatch, correctPipeline } from "@/lib/generation-pipeline";
import type { ProviderStage, ProviderReceipt, GenerationPipeline } from "@/lib/generation-pipeline";
import { groundingBatch, parseBatchReview } from "@/lib/grounding-batches";
import { GroundingError } from "@/lib/factual-grounding";
import type { GenerationInput } from "@/lib/generation-contract";
import type { GenerationProgress } from "@/lib/generation-progress";
import type { GenerationResult } from "@/types/content";
import type { UserProfile } from "@/types/saas";

type Document = UserProfile & Record<string, unknown>;
export type StageAdmission =
  | { status: "replay"; result: GenerationResult }
  | { status: "progress"; progress: GenerationProgress }
  | { status: "dispatch"; stage: ProviderStage; fingerprint: string };
function journal(data: Document, entries: Reservation[], entry: Reservation, p: GenerationPipeline) {
  if (Buffer.byteLength(JSON.stringify(p), "utf8") > PIPELINE_LIMITS.journalBytes) {
    throw new GenerationReservationError("Generation checkpoint is too large.", 503, "checkpoint_limit");
  }
  const updated = entries.map(r => r.requestId === entry.requestId ? { ...entry, pipeline: p } : r);
  if (Buffer.byteLength(JSON.stringify(updated.filter(r => r.pipeline)), "utf8") > PIPELINE_LIMITS.accountJournalBytes) {
    throw new GenerationReservationError("Saved generation checkpoints reached their storage limit. Resume existing work or wait for expiry.", 503, "checkpoint_limit");
  }
  return { ...data, generation_reservations_json: updated };
}
export function beginGenerationStage(data: Document, userId: string, id: string, request: GenerationInput,
  expectedStage: string | null, now = new Date()): { data: Document; result: StageAdmission } {
  const admitted = reserveGenerationInProfile(data, userId, id, request, now, true);
  if (admitted.result.status === "replay") return { data: admitted.data, result: { status: "replay", result: admitted.result.result } };
  const fingerprint = admitted.result.fingerprint;
  const matched = matchingReservation(admitted.data, userId, id, fingerprint, now);
  const p = structuredClone(matched.entry.pipeline ?? newGenerationPipeline());
  if (p.version !== PIPELINE_LIMITS.version) throw new GenerationReservationError("This saved attempt needs its original pipeline version.", 409, "pipeline_version");
  const progress = (): { data: Document; result: StageAdmission } => ({
    data: journal(matched.data, matched.entries, matched.entry, p), result: { status: "progress", progress: pipelineProgress(p, id) }
  });
  if (p.failure) return progress();
  const running = p.metrics.at(-1);
  if (running?.status === "running") {
    if (now.getTime() - Date.parse(running.startedAt) >= PIPELINE_LIMITS.runningMs) {
      running.status = "unknown"; p.failure = "generation_uncertain";
    }
    return progress(); // No lease takeover: the provider may already have charged.
  }
  const key = pipelineKey(p);
  // A repeated HTTP request can read progress, but cannot silently advance another paid stage.
  if (expectedStage !== key && !(expectedStage === null && p.phase === "draft")) return progress();
  if (p.phase === "save") {
    if (!p.draft) throw new GroundingError();
    const started = performance.now();
    p.metrics.push({ key, kind: "save", startedAt: now.toISOString(), finishedAt: now.toISOString(),
      durationMs: Math.max(0, performance.now() - started), status: "complete", inputBytes: 0, reservedMicroUsd: 0 });
    const complete = completeGenerationInProfile(journal(matched.data, matched.entries, matched.entry, p), userId, id, fingerprint, p.draft, now);
    return { data: complete.data, result: { status: "replay", result: complete.result } };
  }
  if (p.phase === "correction") {
    const started = performance.now();
    try { correctPipeline(p, request); } catch { p.failure = "grounding_failed"; }
    p.metrics.push({ key, kind: "correction", startedAt: now.toISOString(), finishedAt: now.toISOString(),
      durationMs: Math.max(0, performance.now() - started), status: p.failure ? "failed" : "complete", inputBytes: 0, reservedMicroUsd: 0 });
    return progress();
  }
  let stage: ProviderStage;
  try { stage = planProviderStage(p, request); } catch { p.failure = "generation_budget"; return progress(); }
  p.reservedMicroUsd += stage.reservedMicroUsd;
  p.metrics.push({ key, kind: stage.kind, startedAt: now.toISOString(), status: "running",
    payloadHash: stage.hash, inputBytes: stage.inputBytes, reservedMicroUsd: stage.reservedMicroUsd,
    inputTokenLimit: stage.inputBytes + 4096, outputTokenLimit: stage.payload.max_output_tokens });
  return { data: journal(matched.data, matched.entries, matched.entry, p), result: { status: "dispatch", stage, fingerprint } };
}

export function checkpointGenerationStage(data: Document, userId: string, id: string, fingerprint: string,
  stage: Pick<ProviderStage, "key" | "hash">, request: GenerationInput, receipt: ProviderReceipt | null,
  durationMs: number, now = new Date()): { data: Document; result: GenerationProgress } {
  const matched = matchingReservation(data, userId, id, fingerprint, now);
  const p = structuredClone(matched.entry.pipeline);
  if (!p || p.version !== PIPELINE_LIMITS.version) throw new GroundingError();
  const metric = p.metrics.find(m => m.key === stage.key && m.payloadHash === stage.hash);
  if (!metric) throw new GenerationReservationError("Stage does not match this attempt.", 409, "stage_mismatch");
  // A lost database acknowledgment may replay persistence, never provider work.
  if (metric.status !== "running") return { data: matched.data, result: pipelineProgress(p, id) };
  metric.finishedAt = now.toISOString(); metric.durationMs = Math.max(0, Math.round(durationMs));
  metric.status = receipt ? "complete" : "unknown";
  if (!receipt) p.failure = "generation_uncertain";
  else {
    for (const [source, target] of [["input_tokens", "inputTokens"], ["output_tokens", "outputTokens"]] as const) {
      const value = receipt.usage?.[source];
      if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) metric[target] = value;
    }
    try {
      if (metric.inputTokens === undefined || metric.outputTokens === undefined ||
          metric.inputTokens > (metric.inputTokenLimit ?? 0) || metric.outputTokens > (metric.outputTokenLimit ?? 0)) {
        metric.status = "unknown"; p.failure = "generation_uncertain";
        return { data: journal(matched.data, matched.entries, matched.entry, p), result: pipelineProgress(p, id) };
      }
      if (Buffer.byteLength(receipt.output_text, "utf8") > PIPELINE_LIMITS.responseBytes || receipt.status !== "completed") throw new GroundingError();
      if (p.phase === "draft") applyDraft(p, receipt, request);
      else {
        if (!p.draft) throw new GroundingError();
        const batch = groundingBatch(p.draft, request, p.batch, p.pass);
        const review = parseBatchReview(receipt.output_text, batch);
        finishReviewBatch(p, review.decisions, request);
      }
    } catch {
      metric.status = "failed"; p.failure = p.phase === "draft" ? "generation_failed" : "grounding_failed";
    }
  }
  return { data: journal(matched.data, matched.entries, matched.entry, p), result: pipelineProgress(p, id) };
}
