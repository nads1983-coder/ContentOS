// Offline fixture adapter only. Semantic judgments below are scripted regression
// decisions, not a new blind model evaluation and never used by application code.
import { readFileSync } from "node:fs";
import { contract, grounding, mechanicalCertificate } from "./grounding-capture-helpers.mjs";
const directory = new URL("../docs/benchmarks/staged-delivery-2026-10-18/", import.meta.url);
export const readCapture = name => JSON.parse(readFileSync(new URL(name, directory), "utf8"));
export const live = readCapture("execution.json");
export const request = contract.normalizeGenerationRequest(readCapture("brief.json"));
export const draft = contract.parseGenerationOutput(live.jobs[0].evidence.outputText, request);
export const findings = readCapture("independent-assessment.json").formats.flatMap(f => f.materialFailures);
const context = grounding.buildGroundingContext(request);
const originalUnits = grounding.groundingUnits(draft);
const originalReview = JSON.parse(live.jobs[1].evidence.outputText);
const corrections = new Map(originalReview.decisions.filter(d => d.kind === "unsupported").map(d => [d.id, d.replacement]));
for (const [id, replacement] of Object.entries({
  u79: "The distinction is between what is held and how it is presented.",
  u82: "A stock record and a display note describe different aspects of an item.",
  u83: "A stock record describes what is held.",
  u90: originalUnits.find(u => u.id === "u90").text.replace(/^Title idea: /, ""),
  u99: "1) A stock record describes what is held; a display note describes how an item is presented.",
  u160: "Slide 7: Different purposes.",
  u161: "Support: This comparison concerns what is held and how it is presented.",
  u170: "",
  u172: "This comparison starts with what is held and how it is presented.",
  u224: "One describes what is held; the other describes how it is presented.",
  u254: "A stock record describes what is held; a display note describes how an item is presented.",
  u259: "A display note describes how an item is presented."
})) corrections.set(id, replacement);
export const repairs = [...corrections].map(([id, replacement]) => {
  const unit = originalUnits.find(u => u.id === id);
  return { id, path: unit.path, original: unit.text, replacement,
    origin: originalReview.decisions.some(d => d.id === id && d.kind === "unsupported") ? "captured-review" : "scripted-offline-regression" };
});
export function currentPack(payload) {
  const result = structuredClone(draft);
  for (const [path, text] of JSON.parse(payload.input).wholePack) {
    const keys = path.split("."), key = keys.pop();
    keys.reduce((v, k) => v[k], result)[key] = text;
  }
  return result;
}
export function classificationResponse(payload, options = {}) {
  const validator = options.validator ?? grounding;
  if (payload.text.format.name === "social_content_generation") return {
    status: "completed", output_text: live.jobs[0].evidence.outputText, usage: live.jobs[0].evidence.usage
  };
  const data = JSON.parse(payload.input);
  if (data.pass === "initial_review" && data.units[0].id === "u0" && !options.alterFirst) {
    const review = JSON.parse(live.jobs[1].evidence.outputText);
    // The new policy requires semantic classification for hashtags. Retain the
    // captured four corrected certificates and all unsupported decisions; only
    // these topical tag decisions are explicitly scripted for the offline run.
    if (validator.reviewEligibility) {
      const units = validator.groundingUnits(draft);
      review.decisions = review.decisions.map(d => {
        const unit = units.find(u => u.id === d.id);
        return d.kind === "structural" && unit.text.includes("#") ? mechanicalCertificate(unit, context, validator) : d;
      });
    }
    return {status:"completed",output_text:JSON.stringify(review),usage:live.jobs[1].evidence.usage};
  }
  const result = currentPack(payload), units = validator.groundingUnits(result);
  const decisions = data.units.map(wire => {
    const unit = units.find(u => u.id === wire.id);
    const repair = repairs.find(r => r.path === unit.path && r.original === unit.text);
    if (repair) return { id: unit.id, kind: "unsupported", sourceIds: [],
      reason: validator.deterministicIssues(unit, context)[0] ?? "missing_evidence", replacement: repair.replacement };
    return mechanicalCertificate(unit, context, validator);
  });
  if (options.change) options.change(decisions, data, units);
  return { status: "completed", output_text: JSON.stringify({ decisions }), usage: { input_tokens: 100, output_tokens: 200 } };
}
