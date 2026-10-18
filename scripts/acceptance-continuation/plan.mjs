import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {CANDIDATE,PROJECT,ROLE,sha,demand,canonicalHash,loadModules,validatePayload,REVIEW_BYTES,DRAFT_BYTES,reserveMicroGbp} from "./runtime.mjs";
export const ORIGINAL_SCHEMA="contentos_acceptance_rc717_20261018";
export const ORIGINAL_PRIVATE="/tmp/contentos-live-acceptance-rc717";
export function recoverOrigin(){
 const old=JSON.parse(readFileSync(`${ORIGINAL_PRIVATE}/plan.json`,"utf8")),audit=JSON.parse(readFileSync(`${ORIGINAL_PRIVATE}/evidence.json`,"utf8"));
 const {planHash,...material}=old;demand(sha(JSON.stringify(material))===planHash && old.candidate===CANDIDATE,"original_manifest");
 demand(planHash==="77592c50e7689326b3579574df793b3f7b0e0324e088c3131a826f857e390d2a","original_campaign");
 for(const [path,hash]of Object.entries(old.sourceHashes))demand(sha(execFileSync("git",["show",`${CANDIDATE}:${path}`],{encoding:"utf8"}))===hash,"candidate_source_mismatch");
 for(const [path,source]of Object.entries(old.modules))demand(sha(source)===old.moduleHashes[path],"module_mismatch");
 const c=audit.campaign[0],j=audit.jobs[0],checkpoint=audit.profile.generation_reservations_json[0],load=loadModules(old.modules);
 demand(!c.enabled&&c.plan_hash===planHash&&c.reserved===419173&&c.outcome.reason==="coverage_budget"&&audit.jobs.length===1&&
  j.id==="1:draft:0:0"&&j.state==="succeeded"&&j.reserved===419173&&j.evidence.status==="completed","original_outcome");
 demand(sha(j.body)===j.payload_hash&&sha(j.evidence.outputText)===j.evidence.responseHash&&
  checkpoint.pipeline.metrics[0].payloadHash===j.payload_hash&&checkpoint.pipeline.metrics[0].status==="complete"&&
  checkpoint.pipeline.phase==="review"&&checkpoint.pipeline.pass===0&&checkpoint.pipeline.batch===0&&
  checkpoint.pipeline.decisions.length===0&&!checkpoint.pipeline.failure&&checkpoint.pipeline.metrics.length===1,"checkpoint_integrity");
 const pipe=load("lib/generation-pipeline.ts");
 demand(JSON.stringify(pipe.pipelinePayload(pipe.newGenerationPipeline(),old.request))===j.body,"source_context_mismatch");
 const parsed=load("lib/generation-contract.ts").parseGenerationOutput(j.evidence.outputText,old.request);
 demand(canonicalHash(parsed.sections)===canonicalHash(checkpoint.pipeline.draft.sections)&&
  parsed.source===checkpoint.pipeline.draft.source&&parsed.summary===checkpoint.pipeline.draft.summary&&
  load("lib/factual-grounding.ts").groundingUnits(checkpoint.pipeline.draft).length===307,"draft_mismatch");
 const publicAudit=JSON.parse(readFileSync("docs/benchmarks/live-acceptance-rc717-2026-10-18/execution.json","utf8"));
 demand(publicAudit.planHash===planHash&&publicAudit.jobs[0].evidence.responseHash===j.evidence.responseHash,"published_evidence_mismatch");
 return {old,audit,checkpoint,origin:{schema:ORIGINAL_SCHEMA,planHash,reserved:419173,calls:1,
  checkpointHash:canonicalHash(checkpoint),profileHash:canonicalHash(audit.profile),jobHash:canonicalHash(j),
  campaignHash:canonicalHash(c),responseHash:j.evidence.responseHash,payloadHash:j.payload_hash,costUsd:j.evidence.costUsd}};
}
export function buildPlan(expires){
 const {old,checkpoint,origin}=recoverOrigin(),load=loadModules(old.modules),pipe=load("lib/generation-pipeline.ts");
 const reviewBodies=Array.from({length:7},(_,batch)=>JSON.stringify(pipe.pipelinePayload({...checkpoint.pipeline,batch},old.request)));
 const bounds=reviewBodies.map(validatePayload),worstCaseMicroGbp=419173+14*reserveMicroGbp(REVIEW_BYTES,4800);
 demand(worstCaseMicroGbp<=3080000,"preflight_budget");
 const checkpointDeadline=Date.parse(checkpoint.createdAt)+pipe.PIPELINE_LIMITS.lifetimeMs;
 expires=Math.min(expires,checkpointDeadline);
 const material={project:PROJECT,environment:"preview",role:ROLE,candidate:CANDIDATE,cap:3080000,maxCalls:15,expires,
  account:`staged-validation-cont-${randomUUID()}`,request:old.request,requestHash:old.requestHash,briefHash:old.briefHash,
  modules:old.modules,moduleHashes:old.moduleHashes,sourceHashes:old.sourceHashes,pricing:old.pricing,origin,checkpoint,
  limits:{draftBytes:DRAFT_BYTES,reviewBytes:REVIEW_BYTES},
  preflight:{worstCaseMicroGbp,initialReviewBytes:bounds.map(b=>b.bytes),initialReviewReserved:bounds.reduce((s,b)=>s+b.reserve,0),
   originalUnits:307,initialBatches:7,maximumFreshBatches:7,checkpointDeadline}};
 return {...material,planHash:sha(JSON.stringify(material))};
}
