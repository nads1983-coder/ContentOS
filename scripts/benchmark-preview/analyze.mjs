// Offline only: synthetic evidence, never credentials or customer data.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomInt } from "node:crypto";
import { buildBenchmarkPlan, formatMetrics } from "../benchmark-content.mjs";

const directory="/tmp/contentos-benchmark-operator-20261018";
const evidence=JSON.parse(readFileSync(`${directory}/evidence.json`,"utf8"));
const plan=buildBenchmarkPlan();
if(evidence.campaign.length!==1 || evidence.campaign[0].plan_hash!==plan.planHash || evidence.campaign[0].enabled || evidence.jobs.length!==6 || evidence.jobs.some(j=>j.state!=="succeeded")) throw new Error("Incomplete or changed benchmark; do not claim paired results");
const results=plan.jobs.map(job=>{
  const stored=evidence.jobs.find(j=>j.id===job.id);
  if(stored.payload_hash!==job.payloadHash)throw new Error("Payload changed");
  const e=stored.evidence;
  return {id:job.id,brief:job.brief,variant:job.variant,payloadHash:job.payloadHash,usage:e.usage,latencyMs:e.latencyMs,costUsd:e.costUsd,costGbpAtReferenceRate:e.costGbpAtReferenceRate,metrics:formatMetrics(e.outputText,job.request,plan.validateOutput)};
});
const aggregates=["baseline","candidate"].map(variant=>{
  const jobs=results.filter(j=>j.variant===variant),latency=jobs.map(j=>j.latencyMs).sort((a,b)=>a-b);
  return {variant,successfulProviderResponses:jobs.length,validCandidateContract:jobs.filter(j=>j.metrics.candidateContractValid).length,formatsReturned:jobs.reduce((s,j)=>s+j.metrics.sectionCount,0),medianLatencyMs:latency[1],minLatencyMs:latency[0],maxLatencyMs:latency.at(-1),costUsd:jobs.reduce((s,j)=>s+j.costUsd,0),estimatedCostGbp:jobs.reduce((s,j)=>s+j.costGbpAtReferenceRate,0)};
});
const summary={planHash:plan.planHash,provenance:plan.provenance,reservedGbpMicros:evidence.campaign[0].reserved_gbp_micros,aggregates,results};
writeFileSync(`${directory}/metrics.json`,JSON.stringify(summary,null,2),{mode:0o600});
mkdirSync(`${directory}/blind`,{mode:0o700});
const mapping={};
for(const brief of ["pilot","launch","sparse"]) {
  const variants=randomInt(2)?["baseline","candidate"]:["candidate","baseline"];
  const jobs=variants.map(v=>plan.jobs.find(j=>j.id===`${brief}:${v}`));
  const pair={brief,request:jobs[0].request,A:JSON.parse(evidence.jobs.find(j=>j.id===jobs[0].id).evidence.outputText),B:JSON.parse(evidence.jobs.find(j=>j.id===jobs[1].id).evidence.outputText)};
  writeFileSync(`${directory}/blind/${brief}.json`,JSON.stringify(pair,null,2),{mode:0o600});
  mapping[brief]={A:variants[0],B:variants[1]};
}
writeFileSync(`${directory}/blind-mapping.json`,JSON.stringify(mapping),{mode:0o600});
console.log(JSON.stringify({aggregates,totalCostUsd:results.reduce((s,j)=>s+j.costUsd,0),estimatedTotalGbp:results.reduce((s,j)=>s+j.costGbpAtReferenceRate,0),reservedGbpMicros:summary.reservedGbpMicros,metricsPath:`${directory}/metrics.json`,blindDirectory:`${directory}/blind`},null,2));
