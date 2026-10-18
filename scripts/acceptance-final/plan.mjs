import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import ts from "typescript";
import {recoverOrigin as recoverOriginal} from "../acceptance-continuation/plan.mjs";
import {CANDIDATE,PROJECT,ROLE,sha,demand,canonicalHash,loadModules,validatePayload,REVIEW_BYTES,DRAFT_BYTES,reserveMicroGbp} from "./runtime.mjs";
export const ORIGINAL_SCHEMA="contentos_acceptance_rc717_20261018";
export function recoverOrigin(){
 const first=recoverOriginal(),dir="/tmp/contentos-continuation-rc717";
 const previous=JSON.parse(readFileSync(`${dir}/plan.json`,"utf8")),audit=JSON.parse(readFileSync(`${dir}/evidence.json`,"utf8"));
 const {planHash,...material}=previous,c=audit.campaign[0],j=audit.jobs[0];
 demand(sha(JSON.stringify(material))===planHash&&planHash==="ffc85d49c9afe9e64e6e51d10dbefa2cab57c49ba4c44b0f1c0527134fcdd7e6","previous_manifest");
 demand(previous.origin.planHash===first.origin.planHash&&!c.enabled&&c.plan_hash===planHash&&c.reserved===605550&&
  audit.jobs.length===1&&j.id==="1:review:0:0"&&j.state==="succeeded"&&j.evidence.status==="completed"&&
  j.reserved===186377&&sha(j.body)===j.payload_hash&&sha(j.evidence.outputText)===j.evidence.responseHash,"previous_outcome");
 const publicAudit=JSON.parse(readFileSync("docs/benchmarks/acceptance-continuation-rc717-2026-10-18/execution.json","utf8"));
 demand(publicAudit.jobs[0].evidence.responseHash===j.evidence.responseHash,"published_review_changed");
 return {...first,previous,audit2:audit,reviewJob:j,origin:{...first.origin,reserved:605550,calls:2,
  originalReserved:419173,costUsd:first.origin.costUsd+j.evidence.costUsd,
  previous:{schema:"contentos_continuation_rc717_20261018",planHash,account:previous.account,
   campaignHash:canonicalHash(c),jobHash:canonicalHash(j),profileHash:canonicalHash(audit.profile),responseHash:j.evidence.responseHash}}};
}
export function buildPlan(expires,now=Date.now()){
 const prior=recoverOrigin(),modules={},sourceHashes={};
 for(const path of Object.keys(prior.old.modules)){
  const source=execFileSync("git",["show",`${CANDIDATE}:${path}`],{encoding:"utf8"});sourceHashes[path]=sha(source);let pure=source;
  if(path==="lib/stripe-rest.ts"){
   const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
   const nodes=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&["normalizePlanId","normalizeSubscriptionStatus","planHasActiveEntitlement","hasActiveEntitlement"].includes(n.name?.text));
   demand(nodes.length===4,"missing_entitlement_helpers");pure=nodes.map(n=>n.getText(tree)).join("\n");
  }
  modules[path]=ts.transpileModule(pure,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 }
 const load=loadModules(modules),pipe=load("lib/generation-pipeline.ts"),stages=load("lib/generation-stages.ts"),request=prior.old.request;
 const account=`staged-validation-final-${randomUUID()}`,timestamp=new Date(now).toISOString();
 // New isolated acceptance attempt only. Original checkpoints and paid metrics remain immutable.
 let profile={...structuredClone(prior.audit.profile),id:account,email:`${account}@example.invalid`,staged_validation_plan:"pending"};
 profile.generation_reservations_json=[{...structuredClone(prior.checkpoint),createdAt:timestamp}];
 const admission=stages.beginGenerationStage(profile,account,request.requestId,request,"1:review:0:0",new Date(now));
 demand(admission.result.status==="dispatch","captured_review_not_dispatched");
 // The approved parser fix removes exactly u47's false-positive diagnostic. No
 // source, unit, instruction, certificate or other payload change is permitted.
 const before=JSON.parse(prior.reviewJob.body),input=JSON.parse(before.input);
 const unit=input.units?.find(u=>u.id==="u47");
 demand(unit?.text==="The range includes 12 catalogue patterns (4 Arc, 8 Bond). "&&JSON.stringify(unit.findings)==='["missing_evidence"]',"unexpected_capture_annotation");
 unit.findings=[];before.input=JSON.stringify(input);
 demand(JSON.stringify(before)===JSON.stringify(admission.result.stage.payload),"captured_review_context_changed");
 const revalidatedPayloadHash=admission.result.stage.hash,oldMetric=prior.audit2.profile.generation_reservations_json[0].pipeline.metrics.at(-1);
 admission.data.generation_reservations_json[0].pipeline.reservedMicroUsd+=oldMetric.reservedMicroUsd-admission.result.stage.reservedMicroUsd;
 admission.data.generation_reservations_json[0].pipeline.metrics[1]={...oldMetric,status:"running",revalidatedPayloadHash};
 admission.result.stage.hash=prior.reviewJob.payload_hash;
 const e=prior.reviewJob.evidence;
 const applied=stages.checkpointGenerationStage(admission.data,account,request.requestId,admission.result.fingerprint,admission.result.stage,request,
  {status:e.status,output_text:e.outputText,usage:e.usage},e.durationMs,new Date(now));
 profile=applied.data;const checkpoint=profile.generation_reservations_json[0];
 demand(applied.result.status==="pending"&&checkpoint.pipeline.batch===1&&checkpoint.pipeline.decisions.length===48&&!checkpoint.pipeline.failure,"captured_review_refused");
 demand(canonicalHash(checkpoint.pipeline.draft)===canonicalHash(prior.checkpoint.pipeline.draft),"draft_changed");
 const bodies=Array.from({length:6},(_,i)=>JSON.stringify(pipe.pipelinePayload({...checkpoint.pipeline,batch:i+1},request))),bounds=bodies.map(validatePayload);
 const worstCaseMicroGbp=605550+13*reserveMicroGbp(REVIEW_BYTES,4800);
 demand(worstCaseMicroGbp<=3080000&&worstCaseMicroGbp-605550<=2470000,"preflight_budget");
 expires=Math.min(expires,now+pipe.PIPELINE_LIMITS.lifetimeMs);
 const material={project:PROJECT,environment:"preview",role:ROLE,candidate:CANDIDATE,cap:3080000,newCap:2470000,maxCalls:15,maxNewCalls:13,expires,
  account,request,requestHash:prior.old.requestHash,briefHash:prior.old.briefHash,modules,moduleHashes:Object.fromEntries(Object.entries(modules).map(([p,s])=>[p,sha(s)])),sourceHashes,
  pricing:{...prior.old.pricing,checkedAt:new Date(now).toISOString()},origin:prior.origin,checkpoint,seedProfile:profile,
  restoredCheckpointHash:canonicalHash(checkpoint),restoredAt:timestamp,reusedReview:prior.reviewJob.evidence,
  limits:{draftBytes:DRAFT_BYTES,reviewBytes:REVIEW_BYTES},
  preflight:{worstCaseMicroGbp,initialReviewBytes:bounds.map(b=>b.bytes),initialReviewReserved:bounds.reduce((s,b)=>s+b.reserve,0),originalUnits:307,initialBatches:6,maximumFreshBatches:7,checkpointDeadline:expires}};
 return {...material,planHash:sha(JSON.stringify(material))};
}
