// Offline diagnostic replay of captured reviews; this module has no provider transport.
import { readFileSync, writeFileSync } from "node:fs";
import { loadModules, sha } from "./runtime.mjs";
const dir = "/tmp/contentos-grounding-benchmark-20261018";
const plan = JSON.parse(readFileSync(`${dir}/plan.json`, "utf8"));
const evidence = JSON.parse(readFileSync(`${dir}/evidence.json`, "utf8"));
const load = loadModules(plan.modules.candidate), contract = load("lib/generation-contract.ts"), grounding = load("lib/factual-grounding.ts");
const diagnostics = [];
for (const pack of plan.packs.filter(p => p.variant === "candidate")) {
  const draft = evidence.jobs.find(j => j.id === `${pack.id}:draft`);
  if (draft?.state !== "succeeded") { diagnostics.push({ pack: pack.id, reason: "missing_draft" }); continue; }
  let pass = 0;
  const diagnostic = { pack: pack.id, reviews: [] };
  try {
    const result = contract.parseGenerationOutput(draft.evidence.outputText, pack.request);
    const final = await grounding.groundGeneration(result, pack.request, async input => {
      const job = evidence.jobs.find(j => j.id === `${pack.id}:review${++pass}`);
      if (job?.state !== "succeeded") throw new Error("recorded_review_not_available");
      const body = JSON.stringify({ model: "gpt-5.2", store: false, service_tier: "default", instructions: grounding.groundingReviewInstructions, input,
        max_output_tokens: 16000, text: { format: { type: "json_schema", name: "content_grounding_review", strict: true, schema: grounding.groundingReviewSchema() } } });
      if (sha(body) !== job.payload_hash) throw new Error("replay_payload_mismatch");
      const data = JSON.parse(input), review = JSON.parse(job.evidence.outputText), context = grounding.buildGroundingContext(pack.request);
      const rejected = [], unsupported = [];
      for (const decision of review.decisions ?? []) {
        const unit = data.units.find(u => u.id === decision.id);
        if (!unit) { rejected.push({ id: decision.id, reason: "unknown_unit" }); continue; }
        if (decision.kind === "unsupported") unsupported.push({ unit, decision });
        try { grounding.parseGroundingReview(JSON.stringify({ decisions: [decision] }), [unit], context); }
        catch { rejected.push({ unit, decision }); }
      }
      diagnostic.reviews.push({ pass, payloadHashMatched: true, units: data.units.length, decisions: review.decisions?.length,
        missingUnits: data.units.filter(u => !review.decisions?.some(d => d.id === u.id)), rejectedCertificates: rejected,
        unsupportedDecisions: unsupported, context });
      return job.evidence.outputText;
    });
    diagnostic.replay = "delivered"; diagnostic.resultHash = sha(JSON.stringify(final));
  } catch (error) {
    diagnostic.replay = "blocked";
    diagnostic.reason = error instanceof grounding.GroundingError ? error.reason : error.message;
  }
  diagnostics.push(diagnostic);
}
writeFileSync(`${dir}/replay-diagnostics.json`, JSON.stringify(diagnostics, null, 2), { mode: 0o600 });
console.log(JSON.stringify(diagnostics.map(d => ({ pack: d.pack, replay: d.replay, reason: d.reason, reviews: d.reviews?.map(r => ({ pass: r.pass, units: r.units, decisions: r.decisions, rejectedCertificates: r.rejectedCertificates.length, unsupportedDecisions: r.unsupportedDecisions.length })) })), null, 2));
