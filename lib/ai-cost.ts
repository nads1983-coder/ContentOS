import { createHash } from "node:crypto";

export const COST_POLICY = {
  version: "2026-10-21-v3", expires: "2026-11-19T00:00:00Z",
  monthly: 30_000_000, textBytes: 128_000, imageBytes: 16_000
} as const;
export const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-flare-2026-09-08";
export class AICapacityError extends Error {
  readonly status = 503;
  constructor(public readonly code: string, message = "AI generation capacity is temporarily unavailable. Your saved content and unused credits are unchanged.") {
    super(message); this.name = "AICapacityError";
  }
}
export type CostQuote = { version: string; kind: "text" | "image"; model: string; hash: string; inputBound: number; outputBound: number; maximum: number };
function imageOutputRate(model: string): number {
  if (model === DEFAULT_IMAGE_MODEL || model === "gpt-image-2.5-flare") return 30;
  if (model === "gpt-image-1") return 40;
  if (model === "gpt-image-1.5") return 32;
  throw new AICapacityError("unreviewed_provider_payload");
}
// GBP 1 per USD plus 20% contingency. Integer micro-pounds, rounded upward.
export function conservativeGBP(microUSD: number) {
  if (!Number.isSafeInteger(microUSD) || microUSD < 0) throw new AICapacityError("invalid_cost");
  return Number((BigInt(microUSD) * BigInt(6) + BigInt(4)) / BigInt(5));
}
export function quoteAI(kind: CostQuote["kind"], payload: Record<string, unknown>, now = new Date()): CostQuote {
  if (now >= new Date(COST_POLICY.expires) || now < new Date("2026-10-19T00:00:00Z")) throw new AICapacityError("pricing_review_required");
  const serialized = JSON.stringify(payload), bytes = Buffer.byteLength(serialized);
  const model = String(payload.model);
  const inputBound = bytes + 4096;
  let outputBound: number, usd: number;
  if (kind === "text") {
    if (!["gpt-4.1", "gpt-4.1-2025-04-14"].includes(model) || bytes > COST_POLICY.textBytes ||
        payload.max_output_tokens !== 24000 || payload.tools || payload.previous_response_id || payload.background) throw new AICapacityError("unreviewed_provider_payload");
    outputBound = 24000; usd = inputBound * 2 + outputBound * 8;
  } else {
    // Stop new reservations at the published shutdown date; retain settlement of old calls.
    if (model === "gpt-image-1" && now >= new Date("2026-10-23T00:00:00Z")) throw new AICapacityError("pricing_review_required");
    const outputRate = imageOutputRate(model);
    const fields = ["model", "prompt", "n", "size", "quality", "output_format", "background", "moderation"];
    if (bytes > COST_POLICY.imageBytes || payload.n !== 1 || payload.quality !== "high" ||
        typeof payload.prompt !== "string" || !payload.prompt.trim() ||
        !["1024x1024", "1024x1536", "1536x1024"].includes(String(payload.size)) ||
        Object.keys(payload).some(key => !fields.includes(key)) ||
        (payload.output_format !== undefined && payload.output_format !== "png") ||
        (payload.background !== undefined && payload.background !== "opaque") ||
        (payload.moderation !== undefined && payload.moderation !== "auto")) throw new AICapacityError("unreviewed_provider_payload");
    // Legacy maximum 6,240; Flare's official calculator estimates 1,756 square /
    // 1,372 portrait or landscape. Retain the larger reserve as a safety margin.
    outputBound = 6250; usd = inputBound * 5 + outputBound * outputRate;
  }
  return { version: COST_POLICY.version, kind, model, hash: createHash("sha256").update(serialized).digest("hex"), inputBound, outputBound, maximum: conservativeGBP(usd) };
}
export function usageCost(quote: CostQuote, usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const input = u.input_tokens, output = u.output_tokens;
  if (typeof input !== "number" || typeof output !== "number" || !Number.isSafeInteger(input) || !Number.isSafeInteger(output) || input < 0 || output < 0) return null;
  if (input > quote.inputBound || output > quote.outputBound) throw new AICapacityError("provider_cost_bound_exceeded");
  // Images here have text-only input; do not silently accept billable image inputs.
  if (quote.kind === "image" && (u.input_tokens_details as { image_tokens?: number } | undefined)?.image_tokens) throw new AICapacityError("provider_cost_bound_exceeded");
  const cost = conservativeGBP(input * (quote.kind === "text" ? 2 : 5) + output * (quote.kind === "text" ? 8 : imageOutputRate(quote.model)));
  if (cost > quote.maximum) throw new AICapacityError("provider_cost_bound_exceeded");
  return cost;
}
