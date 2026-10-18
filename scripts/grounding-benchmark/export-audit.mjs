// Deliberate allowlist: only synthetic inputs/outputs, judgments and spend/cleanup evidence.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { sha, demand } from "./runtime.mjs";
const dir = "/tmp/contentos-grounding-benchmark-20261018";
const out = "docs/benchmarks/grounding-2026-10-18";
const json = path => JSON.parse(readFileSync(path, "utf8"));
const plan = json(`${dir}/plan.json`), evidence = json(`${dir}/evidence.json`);
mkdirSync(out, { recursive: true });
function save(name, text, expectedHash) {
  demand(!/postgres(?:ql)?:\/\/|sk-[A-Za-z0-9_-]{20,}|BEGIN (?:RSA )?PRIVATE KEY|Bearer\s+\S{20,}/i.test(text), "possible_secret_in_export");
  if (expectedHash) demand(sha(text) === expectedHash, "frozen_evidence_changed");
  writeFileSync(`${out}/${name}`, text);
}
const frozen = [
  ["blind-scores.json", "/tmp/contentos-grounding-blind-scores.json", "1988ba1c14d6c071d6e3af1297852206ed68cbbdef52e768f5e7bd1dfce20c59"],
  ["independent-factual-audit.json", "/tmp/contentos-grounding-independent-audit.json", "a48c5395cf3f58ebd187d746ded2631c301dcb46d83ce2320e5cab50fc3be574"],
  ["sealed-briefs.md", "/tmp/contentos-grounding-heldout.md", plan.sealedHash],
  ["adapted-inputs.json", "/tmp/contentos-grounding-heldout-inputs.json", "9185c65703bd5ad825bcf2f6997836c55ce6e1576c478eaf24a084fcbf6a35ac"]
];
for (const [name, path, expected] of frozen) save(name, readFileSync(path, "utf8"), expected);
for (const name of ["metrics.json", "blind-mapping.json", "cleanup.json", "offline-diagnostics.json", "format-flag-audit.json", "score-summary.json", "post-fix-replay.json"]) save(name, readFileSync(`${dir}/${name}`, "utf8"));
for (const id of ["H1", "H2", "H3"]) save(`blind-${id}.json`, readFileSync(`${dir}/blind/${id}.json`, "utf8"));
const audit = { schemaVersion: 1, syntheticOnly: true, baseline: plan.baseline, candidate: plan.candidate, planHash: plan.planHash,
  sourceHashes: plan.sourceHashes, moduleHashes: plan.moduleHashes, pricing: plan.pricing,
  campaign: evidence.campaign, jobs: evidence.jobs, outcomes: evidence.outcomes };
save("execution-audit.json", JSON.stringify(audit, null, 2));
console.log(JSON.stringify({ exported: out, frozenHashesVerified: true, credentialsIncluded: false, syntheticOnly: true }));
