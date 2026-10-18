// Synthetic-only audit export. Never load state.json or any credential-bearing file.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomInt } from "node:crypto";
import { sha, loadModules } from "./runtime.mjs";

const dir = "/tmp/contentos-grounding-benchmark-20261018";
const plan = JSON.parse(readFileSync(`${dir}/plan.json`, "utf8"));
const evidence = JSON.parse(readFileSync(`${dir}/evidence.json`, "utf8"));
const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
const contract = loadModules(plan.modules.candidate)("lib/generation-contract.ts");
const mapping = {}, summaries = []; let blindAssets = 0;
mkdirSync(`${dir}/blind`, { mode: 0o700 });
for (const id of ["H1", "H2", "H3"]) {
  const order = randomInt(2) === 0 ? ["baseline", "candidate"] : ["candidate", "baseline"];
  const packs = {};
  for (const [i, variant] of order.entries()) {
    const pack = plan.packs.find(p => p.id === `${id}:${variant}`), outcome = evidence.outcomes.find(o => o.pack_id === pack.id)?.evidence;
    const jobs = evidence.jobs.filter(j => j.pack_id === pack.id), draft = jobs.find(j => j.stage === "draft");
    const label = i === 0 ? "A" : "B";
    let result = outcome?.status === "delivered" ? outcome.result : null;
    if (!result && draft?.evidence?.outputText) try { result = JSON.parse(draft.evidence.outputText); } catch { /* Record absent assets without fabricating them. */ }
    // Blinding strips provider and delivery labels. Blocked drafts are diagnostic only;
    // the private mapping records this and release metrics never count them as delivered.
    const sections = Array.isArray(result?.sections) ? result.sections : [];
    blindAssets += sections.length;
    packs[label] = { title: result?.title ?? "", summary: result?.summary ?? "", sections: sections.map(({ type, title, platform, body, items, cta }) => ({ type, title, platform, body, items, cta })) };
    mapping[`${id}:${label}`] = { variant, delivered: outcome?.status === "delivered", evaluated: outcome?.status === "delivered" ? "delivered_pack" : "withheld_raw_draft", outcome: outcome?.reason ?? (outcome ? null : "campaign_stopped_before_outcome") };
    let contractValid = true;
    try { contract.parseGenerationOutput(draft?.evidence?.outputText, pack.request); } catch { contractValid = false; }
    summaries.push({ pack: pack.id, deliveryStatus: outcome?.status ?? "not_delivered", reason: outcome?.reason ?? null, formats: sections.length,
      rawContractValid: contractValid, calls: jobs.filter(j => j.state !== "ready").length, successfulCalls: jobs.filter(j => j.state === "succeeded").length,
      uncertainCalls: jobs.filter(j => j.state === "unknown").length, providerMs: jobs.reduce((s, j) => s + (j.evidence?.latencyMs ?? 0), 0),
      costUsdKnown: jobs.reduce((s, j) => s + (j.evidence?.costUsd ?? 0), 0), reservedGbpMicros: jobs.reduce((s, j) => s + j.reserved_gbp_micros, 0),
      draftResponseHash: draft?.evidence?.outputText ? sha(draft.evidence.outputText) : null });
  }
  const request = plan.packs.find(p => p.id === `${id}:candidate`).request;
  write(`${dir}/blind/${id}.json`, { id, request, packs });
}
write(`${dir}/blind-mapping.json`, mapping);
const known = evidence.jobs.filter(j => j.evidence?.usage);
const metrics = { baseline: plan.baseline, candidate: plan.candidate, planHash: plan.planHash, sealedHash: plan.sealedHash,
  budgetGbp: 9, maxRequests: 12, reservedGbpMicros: evidence.campaign[0].reserved_gbp_micros,
  actualRequests: evidence.jobs.filter(j => j.state !== "ready").length,
  successfulRequests: evidence.jobs.filter(j => j.state === "succeeded").length,
  uncertainRequests: evidence.jobs.filter(j => j.state === "unknown").length,
  failedRequests: evidence.jobs.filter(j => j.state === "failed").length,
  knownCostUsd: known.reduce((s, j) => s + j.evidence.costUsd, 0),
  knownCostGbpReference: known.reduce((s, j) => s + j.evidence.costGbpReference, 0),
  uncertainReserveGbp: evidence.jobs.filter(j => ["unknown", "reserved"].includes(j.state)).reduce((s, j) => s + j.reserved_gbp_micros, 0) / 1000000,
  tokens: Object.fromEntries(["input_tokens", "output_tokens", "total_tokens", "cached_tokens"].map(k => [k, known.reduce((s, j) => s + j.evidence.usage[k], 0)])),
  deliveryCount: evidence.outcomes.filter(o => o.evidence.status === "delivered").length,
  blindAssets, expectedBlindAssets: 84, summaries };
write(`${dir}/metrics.json`, metrics);
console.log(JSON.stringify(metrics, null, 2));
