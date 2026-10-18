// Offline synthetic review only. The original evidence and reservations are never replaced.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildBenchmarkPlan, formatMetrics } from "../benchmark-content.mjs";
const directory="/tmp/contentos-benchmark-operator-20261018-followup";
const stored=JSON.parse(readFileSync(`${directory}/plan.json`,"utf8")),current=buildBenchmarkPlan();
const evidence=JSON.parse(readFileSync(`${directory}/evidence.json`,"utf8"));
if(stored.candidatePlanHash!==current.planHash || evidence.campaign[0].enabled || evidence.jobs.length!==9 || evidence.jobs.some(j=>j.state!=="succeeded") || evidence.campaign[0].reserved_gbp_micros>5000000)throw Error("Incomplete or changed followup");
mkdirSync(`${directory}/review`,{mode:0o700});
const results=stored.jobs.map(job=>{
  const record=evidence.jobs.find(j=>j.id===job.id);
  if(record.payload_hash!==job.payloadHash)throw Error("Changed payload");
  const e=record.evidence;
  writeFileSync(`${directory}/review/${job.brief}.json`,JSON.stringify({brief:job.brief,request:job.request,output:JSON.parse(e.outputText)},null,2),{mode:0o600});
  return {id:job.id,latencyMs:e.latencyMs,usage:e.usage,costUsd:e.costUsd,costGbpAtReferenceRate:e.costGbpAtReferenceRate,metrics:formatMetrics(e.outputText,job.request,current.validateOutput)};
});
const totalCostUsd=evidence.jobs.reduce((s,j)=>s+j.evidence.costUsd,0),followupCostUsd=results.reduce((s,j)=>s+j.costUsd,0);
const summary={candidatePlanHash:current.planHash,provenance:current.provenance,totalCostUsd,estimatedTotalGbp:totalCostUsd*0.7546,followupCostUsd,reservedGbpMicros:evidence.campaign[0].reserved_gbp_micros,results};
writeFileSync(`${directory}/metrics.json`,JSON.stringify(summary,null,2),{mode:0o600});
console.log(JSON.stringify({...summary,provenance:undefined,results:results.map(r=>({...r,metrics:{sectionCount:r.metrics.sectionCount,candidateContractValid:r.metrics.candidateContractValid}}))},null,2));
