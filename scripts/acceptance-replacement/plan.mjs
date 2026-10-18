import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import ts from "typescript";
import {recoverOrigin as recoverPrevious} from "../acceptance-final/plan.mjs";
import {CANDIDATE,PROJECT,ROLE,sha,demand,canonicalHash,loadModules,validatePayload,REVIEW_BYTES,DRAFT_BYTES,reserveMicroGbp} from "./runtime.mjs";
export const ORIGINAL_SCHEMA="contentos_acceptance_rc717_20261018";
export function recoverOrigin(){
 const stoppedRaw=readFileSync("/tmp/contentos-closure-eef2/evidence.json"),stopped=JSON.parse(stoppedRaw);
 demand(sha(stoppedRaw)==="f12e396f0d686196a8834e821050c9186d62bc50e478c2a7a5eb24fc386a648d"&&
  stopped.jobs.length===0&&!stopped.campaign[0].enabled&&stopped.campaign[0].reserved===792508,"replacement_allowance_uncertain");
 const first=recoverPrevious(),dir="/tmp/contentos-final-a7cd";
 const raw=readFileSync(`${dir}/evidence.json`),audit3=JSON.parse(raw),last=JSON.parse(readFileSync(`${dir}/plan.json`));
 const {planHash,...material}=last,c=audit3.campaign[0],j=audit3.jobs[0];
 demand(sha(raw)==="f14867d4b70a1e95dedb38d9c7dc78232b7a7d4f99772cb633f8b470e608c1dd"&&sha(JSON.stringify(material))===planHash,"last_manifest");
 demand(last.origin.previous.planHash===first.previous.planHash&&!c.enabled&&c.plan_hash===planHash&&c.reserved===792508&&
  audit3.jobs.length===1&&j.id==="1:review:0:1"&&j.state==="succeeded"&&j.evidence.status==="completed"&&
  j.reserved===186958&&sha(j.body)===j.payload_hash&&sha(j.evidence.outputText)===j.evidence.responseHash,"last_outcome");
 const published=JSON.parse(readFileSync("docs/benchmarks/acceptance-final-a7cd-2026-10-18/execution.json"));
 demand(published.jobs[0].evidence.responseHash===j.evidence.responseHash,"published_review_changed");
 return {...first,last,audit3,lastJob:j,stopped,origin:{...first.origin,reserved:792508,calls:3,costUsd:first.origin.costUsd+j.evidence.costUsd,
  stopped:{schema:"contentos_closure_eef2_20261018",fileHash:sha(stoppedRaw),planHash:stopped.campaign[0].plan_hash,
   account:stopped.campaign[0].account_id,campaignHash:canonicalHash(stopped.campaign[0]),profileHash:canonicalHash(stopped.profile),calls:0},
  last:{schema:"contentos_final_a7cd_20261018",planHash,account:last.account,campaignHash:canonicalHash(c),jobHash:canonicalHash(j),
   profileHash:canonicalHash(audit3.profile),responseHash:j.evidence.responseHash}}};
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
 const account=`staged-validation-closure-${randomUUID()}`,timestamp=new Date(now).toISOString();
 let profile={...structuredClone(prior.audit.profile),id:account,email:`${account}@example.invalid`,staged_validation_plan:"pending"};
 profile.generation_reservations_json=[{...structuredClone(prior.checkpoint),createdAt:timestamp}];
 const reusedReviews=[];
 for(const [i,job,audit] of [[0,prior.reviewJob,prior.audit2],[1,prior.lastJob,prior.audit3]]){
  const admission=stages.beginGenerationStage(profile,account,request.requestId,request,`1:review:0:${i}`,new Date(now));
  demand(admission.result.status==="dispatch","captured_review_not_dispatched");
  const before=JSON.parse(job.body),input=JSON.parse(before.input);
  for(const id of ["s6","s12"]){const s=input.sources.find(s=>s.id===id);demand(JSON.stringify(s.categories)==='["curriculum"]',"unexpected_source_category");s.categories=[];}
  if(i===0){const u=input.units.find(u=>u.id==="u47");demand(JSON.stringify(u.findings)==='["missing_evidence"]',"unexpected_quantity_finding");u.findings=[];}
  else for(const id of ["u49","u50","u51"]){const u=input.units.find(u=>u.id===id);demand(!u.annotations,"unexpected_annotation");u.annotations=[[0,16]];if(id==="u51"){demand(JSON.stringify(u.findings)==='["missing_evidence"]',"unexpected_ordinal_finding");u.findings=[];}}
  before.input=JSON.stringify(input);
  // Compare canonical objects: newly inserted annotation property order is not semantic.
  const current=admission.result.stage.payload;
  demand(canonicalHash(input)===canonicalHash(JSON.parse(current.input))&&
   canonicalHash({...before,input:null})===canonicalHash({...current,input:null}),"captured_review_context_changed");
  const revalidatedPayloadHash=admission.result.stage.hash,oldMetric=audit.profile.generation_reservations_json[0].pipeline.metrics.at(-1);
  admission.data.generation_reservations_json[0].pipeline.reservedMicroUsd+=oldMetric.reservedMicroUsd-admission.result.stage.reservedMicroUsd;
  admission.data.generation_reservations_json[0].pipeline.metrics[i+1]={...oldMetric,status:"running",revalidatedPayloadHash};
  admission.result.stage.hash=job.payload_hash;
  const e=job.evidence,applied=stages.checkpointGenerationStage(admission.data,account,request.requestId,admission.result.fingerprint,admission.result.stage,request,
   {status:e.status,output_text:e.outputText,usage:e.usage},e.durationMs,new Date(now));
  profile=applied.data;
  demand(applied.result.status==="pending"&&!profile.generation_reservations_json[0].pipeline.failure,"captured_review_refused");
  reusedReviews.push({...e,revalidatedPayloadHash});
 }
 const checkpoint=profile.generation_reservations_json[0];
 demand(checkpoint.pipeline.batch===2&&checkpoint.pipeline.decisions.length===96&&checkpoint.pipeline.decisions.filter(d=>d.kind==="unsupported").length===6,"reuse_coverage");
 demand(canonicalHash(checkpoint.pipeline.draft)===canonicalHash(prior.checkpoint.pipeline.draft),"draft_changed");
 const bounds=Array.from({length:5},(_,i)=>validatePayload(JSON.stringify(pipe.pipelinePayload({...checkpoint.pipeline,batch:i+2},request))));
 const worstCaseMicroGbp=792508+12*reserveMicroGbp(REVIEW_BYTES,4800);
 demand(worstCaseMicroGbp<=3080000&&worstCaseMicroGbp-792508<=2280000,"preflight_budget");
 expires=Math.min(expires,now+pipe.PIPELINE_LIMITS.lifetimeMs);
 const material={project:PROJECT,environment:"preview",role:ROLE,candidate:CANDIDATE,cap:3080000,newCap:2280000,maxCalls:15,maxNewCalls:12,expires,
  account,request,requestHash:prior.old.requestHash,briefHash:prior.old.briefHash,modules,moduleHashes:Object.fromEntries(Object.entries(modules).map(([p,s])=>[p,sha(s)])),sourceHashes,
  pricing:{...prior.old.pricing,checkedAt:new Date(now).toISOString()},origin:prior.origin,checkpoint,seedProfile:profile,
  restoredCheckpointHash:canonicalHash(checkpoint),restoredAt:timestamp,reusedReviews,
  limits:{draftBytes:DRAFT_BYTES,reviewBytes:REVIEW_BYTES},
  preflight:{worstCaseMicroGbp,initialReviewBytes:bounds.map(b=>b.bytes),initialReviewReserved:bounds.reduce((s,b)=>s+b.reserve,0),originalUnits:307,initialBatches:5,maximumFreshBatches:7,checkpointDeadline:expires}};
 return {...material,planHash:sha(JSON.stringify(material))};
}
