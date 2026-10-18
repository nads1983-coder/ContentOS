import { buildGroundingContext, deterministicIssues, groundingFields, groundingReviewInstructions,
  groundingReviewSchema, groundingUnits, GroundingError, parseGroundingReview, reviewEligibility, originalReviewSources } from "@/lib/factual-grounding";
import type { GenerationInput } from "@/lib/generation-contract";
import type { GenerationResult } from "@/types/content";

export const REVIEW_BATCH_SIZE = 48;

// Whole-pack context is not a lossy summary or a model-extracted fact whitelist.
// Every batch sees all source statements and every output field, including other formats.
export function groundingBatch(result: GenerationResult, request: GenerationInput, batch: number, pass: number) {
  const context = buildGroundingContext(request);
  const all = groundingUnits(result);
  const units = all.slice(batch * REVIEW_BATCH_SIZE, (batch + 1) * REVIEW_BATCH_SIZE);
  if (!Number.isSafeInteger(batch) || batch < 0 || !units.length) throw new GroundingError();
  const input = JSON.stringify({
    originalSources: originalReviewSources(request), sources: context.sources, constraints: { noCta: context.noCta, instructions: context.instructions },
    pass: pass === 0 ? "initial_review" : "fresh_final_revalidation",
    wholePack: groundingFields(result).filter(([, text]) => text),
    units: units.map(u => ({ id: u.id, path: u.path, text: u.text,
      ...(u.annotations ? { annotations: u.annotations } : {}), ...reviewEligibility(u, context), findings: deterministicIssues(u, context) }))
  });
  return { context, all, units, input, pass, count: Math.ceil(all.length / REVIEW_BATCH_SIZE) };
}

export const batchReviewInstructions = groundingReviewInstructions
  .replace("attach sourceId and exact contiguous quote for each necessary statement", "attach the minimal source IDs whose complete statements support each necessary assertion")
  .replace("Every referenced quote must actually support", "Every referenced source statement must actually support") + `
This is a bounded review batch. Return decisions ONLY for supplied units, exactly once each. wholePack contains ALL original output fields for cross-format and surrounding context. Evaluate every assertion in each assigned unit against that full context. Contradictions with another format must mark the assigned unit unsupported when its meaning is unresolved or not supported by the current brief. Do not assume that another batch checks your assigned units.
Use sourceIds instead of repeating quote text. The server expands each ID to its complete original source statement, retaining negation and qualifications, and runs the same evidence validation. These IDs are not permission to treat matching numbers or words as entailment. Do not cite irrelevant statements. No extraction stage may discard inconvenient evidence.`;

export function batchReviewSchema() {
  const schema = groundingReviewSchema();
  const item = schema.properties.decisions.items;
  const { references: _references, ...properties } = item.properties;
  return { ...schema, properties: { decisions: { ...schema.properties.decisions, maxItems: REVIEW_BATCH_SIZE,
    items: { ...item, required: ["id", "kind", "sourceIds", "reason", "replacement"], properties: {
      ...properties, sourceIds: { type: "array", maxItems: 12, items: { type: "string" } }
    } }
  } } };
}

export function parseBatchReview(text: string, batch: ReturnType<typeof groundingBatch>) {
  if (Buffer.byteLength(text, "utf8") > 80_000) throw new GroundingError();
  let raw;
  try { raw = JSON.parse(text); } catch { throw new GroundingError(); }
  if (!raw || !Array.isArray(raw.decisions) || Object.keys(raw).length !== 1) throw new GroundingError();
  const decisions = raw.decisions.map((d: Record<string, unknown>) => {
    if (!d || Object.keys(d).sort().join() !== "id,kind,reason,replacement,sourceIds" || !Array.isArray(d.sourceIds) ||
        d.sourceIds.length > 12 || new Set(d.sourceIds).size !== d.sourceIds.length) throw new GroundingError();
    const references = d.sourceIds.map(id => {
      const source = batch.context.sources.find(s => s.id === id);
      if (!source) throw new GroundingError();
      return { sourceId: source.id, quote: source.text };
    });
    return { id: d.id, kind: d.kind, reason: d.reason, replacement: d.replacement, references };
  });
  return parseGroundingReview(JSON.stringify({ decisions }), batch.units, batch.context, batch.pass === 0);
}
