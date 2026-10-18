// Read-only proposal calculator. No credentials, provider calls, database writes,
// deployment or ledger creation. Historical operators remain closed.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {recoverOrigin} from "./plan.mjs";
import {sha,canonicalHash,validatePayload,reserveMicroGbp} from "./runtime.mjs";
import {loadTs} from "../../tests/image-test-helpers.mjs";
import {harness,requestId} from "../../tests/generation-test-helpers.mjs";
import {draft,request,seedCapturedDraft,finalClassificationResponse} from "../../tests/final-classification-capture-helpers.mjs";

globalThis.fetch=()=>{throw Error("Network forbidden in offline preflight");};
const candidate="31ff29b8afa4aeccf76c737018372b6472f2ae55";
const prior=recoverOrigin(); // Verifies the original generation and first review, including their manifests and source hashes.
const records=[
 ["/tmp/contentos-live-acceptance-rc717","a3facde6aa412bd8177518a331c8c0f2351c53f8b5a3ca0d15311e4a99f068ae",419173],
 ["/tmp/contentos-continuation-rc717","a3ed54c5f7af21d3c2e10d396fb37780f2f55050ee5fb2de794d087a0d9c960d",605550],
 ["/tmp/contentos-final-a7cd","f14867d4b70a1e95dedb38d9c7dc78232b7a7d4f99772cb633f8b470e608c1dd",792508]
];
const histories=records.map(([dir,expected,cumulative])=>{
 const raw=readFileSync(`${dir}/evidence.json`),audit=JSON.parse(raw),plan=JSON.parse(readFileSync(`${dir}/plan.json`));
 assert.equal(sha(raw),expected);
 const {planHash,...material}=plan;
 assert.equal(sha(JSON.stringify(material)),planHash);
 assert.equal(audit.campaign[0].plan_hash,planHash);
 assert.equal(audit.campaign[0].enabled,false);
 assert.equal(audit.campaign[0].reserved,cumulative);
 assert.equal(audit.jobs.length,1);
 const job=audit.jobs[0];
 assert.equal(job.state,"succeeded");assert.equal(job.evidence.status,"completed");
 assert.equal(sha(job.body),job.payload_hash);assert.equal(sha(job.evidence.outputText),job.evidence.responseHash);
 return {audit,plan,job,fileHash:expected};
});
const latest=histories[2],published=JSON.parse(readFileSync("docs/benchmarks/acceptance-final-a7cd-2026-10-18/execution.json"));
assert.equal(latest.plan.origin.reserved,605550);
assert.equal(latest.plan.origin.previous.planHash,prior.previous.planHash);
assert.equal(latest.plan.origin.previous.jobHash,canonicalHash(prior.reviewJob));
assert.equal(latest.job.evidence.responseHash,published.jobs[0].evidence.responseHash);
assert.equal(latest.job.id,"1:review:0:1");
assert.equal(histories.reduce((s,h)=>s+h.job.reserved,0),792508);

const cache=new Map(),pipeline=loadTs("lib/generation-pipeline.ts",{},cache),batching=loadTs("lib/grounding-batches.ts",{},cache);
for(const path of Object.keys(latest.plan.sourceHashes)){
 assert.equal(sha(readFileSync(path)),sha(execFileSync("git",["show",`${candidate}:${path}`])),`Candidate changed: ${path}`);
}
assert.equal(canonicalHash(draft.sections),canonicalHash(prior.checkpoint.pipeline.draft.sections));
assert.equal(request.source,prior.old.request.source);
const {requestId: historicalRequestId,...originalContentRequest}=prior.old.request;
assert.equal(typeof historicalRequestId,"string");
assert.deepEqual(request,originalContentRequest); // Offline fixture rebases only the synthetic request identity.
const certificates=[];
for(let i=0;i<2;i++){
 const batch=batching.groundingBatch(draft,request,i,0),job=histories[i+1].job;
 const old=JSON.parse(JSON.parse(job.body).input),current=JSON.parse(batch.input);
 assert.deepEqual(current.wholePack,old.wholePack);
 assert.deepEqual(current.units.map(({id,path,text})=>({id,path,text})),old.units.map(({id,path,text})=>({id,path,text})));
 assert.deepEqual(current.sources.map(({categories,...s})=>s),old.sources.map(({categories,...s})=>s));
 certificates.push(...batching.parseBatchReview(job.evidence.outputText,batch).decisions);
}
assert.equal(certificates.length,96);
assert.deepEqual(certificates.filter(d=>d.kind==="unsupported").map(d=>d.id),["u32","u44","u50","u51","u58","u87"]);
const initial=[];
for(let batch=2;batch<7;batch++){
 const p={...pipeline.newGenerationPipeline(),phase:"review",draft,batch};
 const body=JSON.stringify(pipeline.pipelinePayload(p,request)),v=validatePayload(body),input=JSON.parse(JSON.parse(body).input);
 initial.push({batch,key:`1:review:0:${batch}`,units:input.units.length,first:input.units[0].id,last:input.units.at(-1).id,
  bytes:v.bytes,payloadHash:v.hash,inputTokenBound:v.inputLimit,reservationMicroGbp:v.reserve});
}
assert.equal(initial.reduce((s,p)=>s+p.units,0),211);
const perCall=reserveMicroGbp(56000,4800),exactInitial=initial.reduce((s,p)=>s+p.reservationMicroGbp,0);
const worstNew=exactInitial+7*perCall,uniformNew=12*perCall;
assert.equal(perCall,189605);assert.ok(792508+uniformNew<=3080000);

// The same complete application route workflow, not live semantic evidence.
const h=harness(),req={...request,requestId:requestId(310)},coverage={},fresh=[];
h.data=seedCapturedDraft(h.data,req,h.now);
h.provider=payload=>{
 const data=JSON.parse(payload.input),v=validatePayload(JSON.stringify(payload));
 (coverage[data.pass]??=[]).push(...data.units.map(u=>u.id));
 if(data.pass==="fresh_final_revalidation")fresh.push({batch:fresh.length,units:data.units.length,bytes:v.bytes,reservationMicroGbp:v.reserve});
 return finalClassificationResponse(payload);
};
const done=await h.finish(req);assert.equal(done.response.status,200);assert.equal(done.body.sections.length,14);
for(const ids of Object.values(coverage)){assert.equal(ids.length,307);assert.equal(new Set(ids).size,307);}
assert.equal(fresh.length,7);
const duplicate=await h.post(req);assert.equal(duplicate.response.status,200);assert.equal(h.calls.length,14);
assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
for(const [dir,hash] of records)assert.equal(sha(readFileSync(`${dir}/evidence.json`)),hash);

const report={mode:"READ_ONLY_PROPOSAL_NO_LIVE_AUTHORIZATION",candidate,paidCalls:0,newSpendGbp:0,
 historical:histories.map(h=>({fileHash:h.fileHash,planHash:h.plan.planHash,stage:h.job.id,reservationMicroGbp:h.job.reserved,
  cumulativeReservationMicroGbp:h.audit.campaign[0].reserved,costUsd:h.job.evidence.costUsd,closed:true,outcomeCertain:true})),
 historicalReservationMicroGbp:792508,historicalCalls:3,historicalCostUsd:histories.reduce((s,h)=>s+h.job.evidence.costUsd,0),
 certificatesReused:96,unsupportedRetained:6,formats:14,draftUnits:307,initialPayloads:initial,
 pricing:{verifiedDate:"2026-10-18",model:"gpt-5.2",serviceTier:"default",inputUsdPerMillion:1.75,outputUsdPerMillion:14,
  cachedDiscountAssumed:false,gbpPerUsdBound:1.10,ecbReferenceDate:"2026-10-16",referenceGbpPerUsd:.84385/1.1253},
 limits:{reviewBytes:56000,inputTokens:60096,outputTokens:4800,maximumFinalUnits:336,initialCalls:5,freshCalls:7,newCalls:12,combinedCalls:15},
 exactInitialReservationMicroGbp:exactInitial,freshMaximumReservationMicroGbp:7*perCall,
 hashBoundMaximumNewMicroGbp:worstNew,hashBoundMaximumCombinedMicroGbp:792508+worstNew,
 uniformMaximumNewMicroGbp:uniformNew,uniformMaximumCombinedMicroGbp:792508+uniformNew,
 proposedNewCeilingGbp:2.28,proposedCombinedCeilingGbp:3.08,
 offline:{initialCoverage:307,freshCoverage:307,freshPayloads:fresh,correctionPasses:1,historyEntries:1,usageEvents:1,
  duplicateExtraCharges:0,capturedResponses:2,mockedResponses:12,semanticReliabilityEstablished:false},
 limitations:["Fresh payloads shown are the explicit mock-correction scenario, not future live reviewer results. Each actual payload must fit the enforced cap without truncation.",
 "Reservation bound is list-price API usage at conservative FX, not a guaranteed invoice including unknown taxes/payment fees. Reconfirm effective billed conversion and any applicable surcharge fit 1.10 GBP/USD before dispatch.",
 "Private audit files were verified read-only; no live database/credential/deployment inspection was performed. Reconcile all three immutable database records before any future authorized execution.",
 "Existing operators are closed and bound to older campaigns. A separately approved execution requires a fresh manifest/ledger binding this candidate and both reusable certificates; never reopen the old campaign."]};
writeFileSync(process.argv[2]??"/tmp/contentos-final-approval-preflight.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:"PASS",paidCalls:0,exactInitial,maximumNew:worstNew,maximumCombined:792508+worstNew,
 uniformNew,uniformCombined:792508+uniformNew,initialPayloadBytes:initial.map(p=>p.bytes),freshPayloadBytes:fresh.map(p=>p.bytes),coverage:[307,307],saved:1,usage:1}));
