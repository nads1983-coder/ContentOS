import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTs } from "./image-test-helpers.mjs";
const directory = resolve(import.meta.dirname, "../docs/benchmarks/grounding-2026-10-18");
const audit = JSON.parse(readFileSync(`${directory}/execution-audit.json`, "utf8"));
const inputs = JSON.parse(readFileSync(`${directory}/adapted-inputs.json`, "utf8"));
const cache = new Map();
export const contract = loadTs("lib/generation-contract.ts", {}, cache);
export const grounding = loadTs("lib/factual-grounding.ts", {}, cache);
export const batches = loadTs("lib/grounding-batches.ts", {}, cache);
export const captured = inputs.map(i => {
  const job = audit.jobs.find(j => j.id === `${i.id}:candidate:draft`);
  const request = contract.normalizeGenerationRequest(i.request);
  return { id: i.id, request, evidence: job.evidence, result: contract.parseGenerationOutput(job.evidence.outputText, request) };
});

// Mechanical TEST certificates for transport/checkpoint coverage, NOT semantic
// judgments or predictions of model output. The blind findings remain separate.
// Real production always obtains independent model decisions; this helper is tests-only.
export function mechanicalCertificate(unit, context) {
  for (const kind of ["structural", "creative", "subjective", "supported"]) {
    const groups = kind === "supported" ? [...context.sources.map(s => [s]), context.sources.slice(0, 12), context.sources.slice(-12)] : [[]];
    for (const sources of groups) {
      const decision = { id: unit.id, kind, references: sources.map(s => ({ sourceId: s.id, quote: s.text })), reason: "none", replacement: null };
      try {
        grounding.parseGroundingReview(JSON.stringify({ decisions: [decision] }), [unit], context);
        return { id: unit.id, kind, sourceIds: sources.map(s => s.id), reason: "none", replacement: null };
      } catch { /* Try another mechanical certificate; never alter a captured unit. */ }
    }
  }
  throw new Error(`No mechanical test certificate for ${unit.id}`);
}
export function captureResponse(pack, payload) {
  if (payload.text.format.name === "social_content_generation") return { status: "completed", output_text: pack.evidence.outputText, usage: pack.evidence.usage };
  const data = JSON.parse(payload.input);
  const units = grounding.groundingUnits(pack.result), context = grounding.buildGroundingContext(pack.request);
  return { status: "completed", output_text: JSON.stringify({ decisions: data.units.map(u => mechanicalCertificate(units.find(full => full.id === u.id), context)) }),
    usage: { input_tokens: 100, output_tokens: 200 } }; // Explicitly synthetic, never used for cost estimates.
}
