import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {loadModules,demand} from "./runtime.mjs";
import {changedFields} from "./evidence.mjs";
const privateDir="/tmp/contentos-closure-eef2",out="docs/benchmarks/acceptance-closure-eef2-2026-10-18";
const read=name=>JSON.parse(readFileSync(`${privateDir}/${name}`,"utf8"));
const optional=name=>{try{return read(name);}catch{return null;}};
const plan=read("plan.json"),audit=read("evidence.json"),cleanup=read("cleanup.json");
demand(cleanup.safeToEraseRecovery,"cleanup_not_complete");
const c=audit.campaign[0],reservation=audit.profile?.generation_reservations_json?.[0],p=reservation?.pipeline;
const loader=loadModules(plan.modules),contract=loader("lib/generation-contract.ts"),grounding=loader("lib/factual-grounding.ts"),batches=loader("lib/grounding-batches.ts");
const draftJob=audit.jobs.find(j=>j.id==="1:draft:0:0");
let draft=plan.checkpoint.pipeline.draft,parseFailure=false;
try{if(draftJob?.evidence?.outputText)draft=contract.parseGenerationOutput(draftJob.evidence.outputText,plan.request);}catch{parseFailure=true;}
const final=c.outcome?.status==="delivered"?c.outcome.result:null;
const corrected=final??(p?.pass===1?p.draft:null),units=draft?grounding.groundingUnits(draft):[];
const coverage=plan.reusedReviews.map((e,index)=>{
 const batch=batches.groundingBatch(draft,plan.request,index,0),reused=batches.parseBatchReview(e.outputText,batch).decisions;
 demand(reused.length===48,"invalid_reuse");
 return {stage:`1:review:0:${index}`,pass:0,reused:true,assignedUnits:48,returnedDecisions:48,acceptedDecisions:48,valid:true,
  unitIds:batch.units.map(u=>u.id),individualRejections:[],unsupported:reused.filter(d=>d.kind==="unsupported")};
});
for(const j of audit.jobs.filter(j=>/^1:(review|revalidation):/.test(j.id)&&j.state==="succeeded")){
 const [,_kind,pass,index]=j.id.split(":"),result=Number(pass)===0?draft:corrected;
 demand(result,"missing_reviewed_pack");
 const batch=batches.groundingBatch(result,plan.request,Number(index),Number(pass));
 const raw=JSON.parse(j.evidence.outputText),individualRejections=[];
 for(const d of raw.decisions??[]){const unit=batch.units.find(u=>u.id===d.id);
  try{batches.parseBatchReview(JSON.stringify({decisions:[d]}),{...batch,units:[unit]});}
  catch{individualRejections.push({id:d.id,path:unit?.path,text:unit?.text,decision:d,deterministicFlags:unit?grounding.deterministicIssues(unit,batch.context):[]});}}
 let valid=false,decisions=[];
 try{demand(JSON.parse(j.body).input===batch.input,"batch_input_mismatch");decisions=batches.parseBatchReview(j.evidence.outputText,batch).decisions;valid=true;}catch{/* Retain rejected certificates without presenting them as accepted. */}
 coverage.push({stage:j.id,pass:Number(pass),assignedUnits:batch.units.length,returnedDecisions:raw.decisions?.length??0,
  acceptedDecisions:valid?decisions.length:0,valid,unitIds:batch.units.map(u=>u.id),individualRejections,
  unsupported:(raw.decisions??[]).filter(d=>d.kind==="unsupported").map(d=>({id:d.id,path:batch.units.find(u=>u.id===d.id)?.path,reason:d.reason,replacement:d.replacement}))});
}
const jobs=audit.jobs.map(j=>({stage:j.id,state:j.state,reservedGbp:j.reserved/1e6,reservedAt:j.reserved_at,completedAt:j.completed_at,
 payloadHash:j.payload_hash,payloadBytes:Buffer.byteLength(j.body),payload:JSON.parse(j.body),evidence:j.evidence}));
const costUsd=plan.origin.costUsd+jobs.reduce((n,j)=>n+(j.evidence?.costUsd??0),0),finalUnits=corrected?grounding.groundingUnits(corrected):[];
const summary={candidate:plan.candidate,planHash:plan.planHash,briefHash:plan.briefHash,sourceHashes:plan.sourceHashes,
 outcome:c.outcome,origin:plan.origin,providerCalls:jobs.length+3,continuationCalls:jobs.length,reservedGbp:c.reserved/1e6,newReservedGbp:(c.reserved-792508)/1e6,knownCostUsd:costUsd,knownCostGbpReference:costUsd*plan.pricing.gbpPerUsdReference,
 actualCostComplete:jobs.every(j=>j.evidence?.costUsd!==undefined),maximumGbp:3.08,maximumNewGbp:2.28,maximumCalls:15,maximumNewCalls:12,parseFailure,
 totalDraftUnits:units.length,acceptedInitialUnits:coverage.filter(r=>r.pass===0).reduce((n,r)=>n+r.acceptedDecisions,0),
 finalUnits:finalUnits.length,acceptedFinalUnits:coverage.filter(r=>r.pass===1).reduce((n,r)=>n+r.acceptedDecisions,0),coverage,
 corrections:changedFields(draft,corrected,units),
 historyEntries:audit.profile?.generation_history_json?.length??0,usageEvents:audit.profile?.usage_events_json?.length??0,
 journalFailure:p?.failure??null,draftPreserved:!!p?.draft,pipelineAudit:reservation?.pipelineAudit??null,
 cleanup,deployment:optional("deployment-final.json"),protection:optional("http-protection.json"),pricing:plan.pricing,jobs,
 limits:["One synthetic brief, not a population quality or reliability estimate.","Exact candidate transitions and real isolated SQL persistence; not a live-provider browser/authenticated HTTP test.","Model certificates require separate independent final-content assessment."]};
const {requestId:_requestId,...request}=plan.request;
mkdirSync(out,{recursive:true});
for(const [name,value] of Object.entries({execution:summary,brief:request,...(draft?{"raw-draft":draft}:{}),...(final?{"validated-result":final}:{})}))
 writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2)+"\n");
console.log(JSON.stringify({exported:true,calls:jobs.length,status:c.outcome?.status,initialCoverage:summary.acceptedInitialUnits,finalCoverage:summary.acceptedFinalUnits,costUsd,reservedGbp:summary.reservedGbp}));
