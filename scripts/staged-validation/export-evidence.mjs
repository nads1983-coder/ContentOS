import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {loadModules,sha,demand} from "./runtime.mjs";
const privateDir="/tmp/contentos-staged-validation-20261018",out="docs/benchmarks/staged-delivery-2026-10-18";
const read=name=>JSON.parse(readFileSync(`${privateDir}/${name}`,"utf8"));
const plan=read("plan.json"),audit=read("evidence.json"),cleanup=read("cleanup.json"),deployment=read("deployment-final.json"),protection=read("http-protection.json");
demand(cleanup.safeToEraseRecovery,"cleanup_not_complete");
const c=audit.campaign[0],p=audit.profile?.generation_reservations_json?.[0]?.pipeline;
const loader=loadModules(plan.modules),contract=loader("lib/generation-contract.ts"),grounding=loader("lib/factual-grounding.ts"),batches=loader("lib/grounding-batches.ts");
const draftJob=audit.jobs.find(j=>j.id==="1:draft:0:0"),draft=draftJob?.evidence?.outputText;
let result,parseFailure=false;
try{if(draft)result=contract.parseGenerationOutput(draft,plan.request);}catch{parseFailure=true;}
const coverage=[],units=result?grounding.groundingUnits(result):[];
for(const job of audit.jobs.filter(j=>j.id.startsWith("1:review:")&&j.state==="succeeded")){
 const index=Number(job.id.split(":").at(-1)),batch=batches.groundingBatch(result,plan.request,index,0);
 const expected=JSON.parse(job.body).input;
 let valid=false,decisions=[],failure;
 const raw=JSON.parse(job.evidence.outputText),individualRejections=[];
 for(const d of raw.decisions??[]){
  const unit=batch.units.find(u=>u.id===d.id);
  try{batches.parseBatchReview(JSON.stringify({decisions:[d]}),{...batch,units:[unit]});}
  catch{individualRejections.push({id:d.id,text:unit?.text,path:unit?.path,decision:d,deterministicFlags:unit?grounding.deterministicIssues(unit,batch.context):[]});}
 }
 try{demand(expected===batch.input,"batch_input_mismatch");decisions=batches.parseBatchReview(job.evidence.outputText,batch).decisions;valid=true;}catch{failure="batch_validation_failed";}
 coverage.push({stage:job.id,assignedUnits:batch.units.length,modelReturnedDecisions:raw.decisions?.length??0,acceptedDecisions:valid?decisions.length:0,valid,failure,
  modelReportedUnsupported:(raw.decisions??[]).filter(d=>d.kind==="unsupported").map(d=>({id:d.id,text:batch.units.find(u=>u.id===d.id)?.text,reason:d.reason,replacement:d.replacement})),individualRejections,
  unsupported:decisions.filter(d=>d.kind==="unsupported").map(d=>({id:d.id,reason:d.reason})),unitIds:batch.units.map(u=>u.id)});
}
const {requestId:_requestId,...request}=plan.request;
const jobs=audit.jobs.map(j=>({stage:j.id,state:j.state,reservedGbp:j.reserved/1e6,reservedAt:j.reserved_at,completedAt:j.completed_at,
 payloadHash:j.payload_hash,payloadBytes:Buffer.byteLength(j.body),evidence:j.evidence}));
const knownCost=jobs.reduce((n,j)=>n+(j.evidence?.costUsd??0),0);
const summary={candidate:plan.candidate,planHash:plan.planHash,briefHash:plan.briefHash,requestHash:plan.requestHash,sourceHashes:plan.sourceHashes,
 outcome:c.outcome,providerCalls:jobs.length,reservedGbp:c.reserved/1e6,knownCostUsd:knownCost,knownCostGbpReference:knownCost*(.84385/1.1253),
 actualCostComplete:jobs.every(j=>j.evidence?.costUsd!==undefined),maximumGbp:4,maximumCalls:23,parseFailure,
 totalDraftUnits:units.length,acceptedReviewUnits:coverage.reduce((n,r)=>n+r.acceptedDecisions,0),coverage,
 historyEntries:audit.profile?.generation_history_json?.length??0,usageEvents:audit.profile?.usage_events_json?.length??0,
 journalFailure:p?.failure??null,draftPreserved:!!p?.draft,cleanup,deployment,protection,pricing:plan.pricing,jobs,
 limits:["One synthetic brief; not a population reliability or quality estimate.","Exact candidate stage transitions and real isolated profile persistence; not a live browser/authenticated application HTTP test.","Any unsupported review decision stops this campaign; no corrective paid retry is purchased."]};
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/execution.json`,JSON.stringify(summary,null,2)+"\n");
writeFileSync(`${out}/brief.json`,JSON.stringify(request,null,2)+"\n");
if(result)writeFileSync(`${out}/raw-draft.json`,JSON.stringify(result,null,2)+"\n");
if(c.outcome?.status==="delivered")writeFileSync(`${out}/validated-result.json`,JSON.stringify(c.outcome.result,null,2)+"\n");
console.log(JSON.stringify({exported:true,calls:jobs.length,status:c.outcome?.status,reviewed:summary.acceptedReviewUnits,total:units.length,
 costUsd:knownCost,reservedGbp:summary.reservedGbp,sourceHash:sha(JSON.stringify(request)),accountIdentifiersExported:false}));
