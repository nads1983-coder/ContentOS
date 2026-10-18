import { createHash } from "node:crypto";
import { buildInstructions, buildInput } from "@/lib/prompts";
import { generationOutputSchema, parseGenerationOutput, GENERATION_LIMITS, GenerationOutputError } from "@/lib/generation-contract";
import type { GenerationInput } from "@/lib/generation-contract";
import { groundingUnits, GroundingError, repairGrounding } from "@/lib/factual-grounding";
import type { GroundingDecision } from "@/lib/factual-grounding";
import { groundingBatch, batchReviewInstructions, batchReviewSchema } from "@/lib/grounding-batches";
import type { GenerationProgress } from "@/lib/generation-progress";
import type { GenerationResult } from "@/types/content";

export const PIPELINE_LIMITS = {
  version: 1, model: "gpt-5.2", stageMs: 90_000, runningMs: 120_000,
  reviewPolicy: 2,
  lifetimeMs: 45 * 60_000, inputBytes: 160_000, responseBytes: 180_000,
  reviewTokens: 4_800, calls: 23, journalBytes: 750_000, accountJournalBytes: 8_000_000,
  // Conservative, nonrefundable admission accounting, not a provider invoice.
  // Default-tier USD1.75/M input, USD14/M output; no cached discount, +25% buffer.
  maxReservedMicroUsd: 4_000_000
} as const;
export type StageKind = "draft" | "review" | "correction" | "revalidation" | "save";
export type StageMetric = {
  key: string; kind: StageKind; startedAt: string; finishedAt?: string; durationMs?: number;
  status: "running" | "complete" | "failed" | "unknown"; payloadHash?: string;
  inputBytes: number; reservedMicroUsd: number; inputTokens?: number; outputTokens?: number;
  inputTokenLimit?: number; outputTokenLimit?: number;
};
export type GenerationPipeline = {
  version: 1; pass: number; batch: number; phase: StageKind;
  reviewPolicy: number;
  draft?: GenerationResult; decisions: GroundingDecision[]; metrics: StageMetric[];
  reservedMicroUsd: number; failure?: "generation_failed" | "grounding_failed" | "generation_uncertain" | "generation_budget";
};
export type ProviderStage = {
  key: string; kind: "draft" | "review" | "revalidation";
  payload: ReturnType<typeof pipelinePayload>; hash: string; reservedMicroUsd: number; inputBytes: number;
};
export type ProviderReceipt = { status?: string; output_text: string; usage?: { input_tokens?: number; output_tokens?: number } };
export const pipelineHash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function newGenerationPipeline(): GenerationPipeline {
  return { version: 1, reviewPolicy: PIPELINE_LIMITS.reviewPolicy, pass: 0, batch: 0, phase: "draft", decisions: [], metrics: [], reservedMicroUsd: 0 };
}
export function pipelineKey(p: GenerationPipeline) { return `${p.version}:${p.phase}:${p.pass}:${p.batch}`; }
export function pipelineProgress(p: GenerationPipeline, requestId: string): GenerationProgress {
  const error = p.failure === "generation_uncertain"
    ? "A provider result could not be confirmed. Saved stages and your existing draft are preserved. This attempt will not repeat paid work automatically."
    : p.failure ? "Validation could not finish. Unchecked content was not delivered. Your existing draft is unchanged." : undefined;
  return { status: p.failure ? "failed" : "pending", requestId, stage: p.phase, nextStage: pipelineKey(p),
    running: p.metrics.at(-1)?.status === "running", reviewedUnits: p.decisions.length,
    totalUnits: p.draft ? groundingUnits(p.draft).length : 0, ...(error ? { error, code: p.failure } : {}) };
}
export function pipelinePayload(p: GenerationPipeline, request: GenerationInput) {
  const draft = p.phase === "draft";
  if (!draft && (!p.draft || !["review", "revalidation"].includes(p.phase))) throw new GroundingError();
  return { model: PIPELINE_LIMITS.model, store: false as const, service_tier: "default" as const,
    instructions: draft ? buildInstructions() : batchReviewInstructions,
    input: draft ? buildInput(request) : groundingBatch(p.draft!, request, p.batch, p.pass).input,
    max_output_tokens: draft ? GENERATION_LIMITS.maxOutputTokens : PIPELINE_LIMITS.reviewTokens,
    text: { format: { type: "json_schema" as const, name: draft ? "social_content_generation" : "content_grounding_batch",
      strict: true, schema: draft ? generationOutputSchema(request.selectedTypes) : batchReviewSchema() } }
  };
}
export function planProviderStage(p: GenerationPipeline, request: GenerationInput): ProviderStage {
  const payload = pipelinePayload(p, request), inputBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (inputBytes > PIPELINE_LIMITS.inputBytes) throw new GroundingError();
  const reservedMicroUsd = Math.ceil(((inputBytes + 4096) * 1.75 + payload.max_output_tokens * 14) * 1.25);
  if (p.metrics.filter(m => m.payloadHash).length >= PIPELINE_LIMITS.calls || p.reservedMicroUsd + reservedMicroUsd > PIPELINE_LIMITS.maxReservedMicroUsd) {
    throw new Error("pipeline_budget_exhausted");
  }
  return { key: pipelineKey(p), kind: p.phase as ProviderStage["kind"], payload,
    hash: pipelineHash(payload), reservedMicroUsd, inputBytes };
}
export function applyDraft(p: GenerationPipeline, receipt: ProviderReceipt, request: GenerationInput) {
  if (receipt.status !== "completed") throw new GenerationOutputError();
  const draft = parseGenerationOutput(receipt.output_text, request);
  groundingUnits(draft); // Fail closed on excessive coverage before any reviews.
  p.draft = draft;
  p.phase = "review";
}
export function finishReviewBatch(p: GenerationPipeline, decisions: GroundingDecision[], request: GenerationInput) {
  if (!p.draft) throw new GroundingError();
  const batch = groundingBatch(p.draft, request, p.batch, p.pass);
  if (decisions.length !== batch.units.length || decisions.some(d => p.decisions.some(old => old.id === d.id))) throw new GroundingError();
  p.decisions.push(...decisions);
  if (++p.batch === batch.count) {
    const units = groundingUnits(p.draft);
    if (p.decisions.length !== units.length || units.some(u => !p.decisions.some(d => d.id === u.id))) throw new GroundingError();
    const violations = p.decisions.some(d => d.kind === "unsupported");
    if (violations && p.pass === 1) throw new GroundingError("unresolved_claims");
    p.phase = violations ? "correction" : "save";
  }
}
export function correctPipeline(p: GenerationPipeline, request: GenerationInput) {
  if (p.phase !== "correction" || p.pass !== 0 || !p.draft) throw new GroundingError();
  const corrected = repairGrounding(p.draft, groundingUnits(p.draft), { decisions: p.decisions }, request);
  groundingUnits(corrected);
  p.draft = corrected;
  p.pass = 1; p.batch = 0; p.decisions = []; p.phase = "revalidation";
}
