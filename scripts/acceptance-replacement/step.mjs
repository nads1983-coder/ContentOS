import {verify} from "node:crypto";
import {demand,loadModules,validatePayload,responseEvidence,providerCall,canonicalHash} from "./runtime.mjs";
export function verifyOperation(signed,publicKey,plan,now=Date.now()){
 demand(typeof signed?.operation==="string"&&signed.operation.length<2000&&typeof signed.signature==="string"&&
  verify(null,Buffer.from(signed.operation),publicKey,Buffer.from(signed.signature,"base64")),"operator_signature");
 const op=JSON.parse(signed.operation);
 demand(op.planHash===plan.planHash&&op.expires>now&&op.expires<=plan.expires&&op.expires<=now+180000&&
  ["preflight","step"].includes(op.mode),"operator_binding");
 if(op.mode==="step")demand(/^1:(review|correction|revalidation|save):[01]:[0-6]$/.test(op.key),"operator_stage");
 return op;
}
export async function step(plan,op,{ledger,apiKey,transport=providerCall}){
 const load=loadModules(plan.modules),stages=load("lib/generation-stages.ts"),pipe=load("lib/generation-pipeline.ts"),request=plan.request;
 try{
  const inspection=await ledger.inspect();
  if(inspection.outcome?.status==="delivered")return {status:"delivered",duplicate:true};
  demand(inspection.enabled&&inspection.reserved>=792508&&inspection.reserved<=3072508&&
   inspection.jobs.length<=12&&inspection.jobs.every(j=>j.state==="succeeded"),"ledger_not_safe");
  const saved=await ledger.snapshot();
  demand(saved.id===plan.account,"account_binding");
  const pipeline=saved.generation_reservations_json[0].pipeline;
  if(op.mode==="preflight"){
   demand(inspection.jobs.length===0&&inspection.reserved===792508&&canonicalHash(saved.generation_reservations_json[0])===plan.restoredCheckpointHash,"checkpoint_mismatch");
   let refused=false;try{await ledger.mutate(d=>({data:{...d,id:"synthetic-other-account"},result:null}));}catch{refused=true;}
   demand(refused&&(await ledger.snapshot()).id===plan.account,"account_binding");
   return {status:"ready",nextStage:pipe.pipelineKey(pipeline),reviewed:96,total:307,reserved:inspection.reserved};
  }
  demand(!pipeline.failure,"validation_failed");
  const admission=await ledger.mutate(d=>stages.beginGenerationStage(d,plan.account,request.requestId,request,op.key));
  if(admission.status==="replay"){
   const final=await ledger.snapshot();
   demand(final.generation_history_json?.length===1&&final.usage_events_json?.length===1&&admission.result.sections.length===14&&
    canonicalHash(final.generation_history_json[0].payload)===canonicalHash(admission.result),"final_save_mismatch");
   const duplicate=await ledger.mutate(d=>stages.beginGenerationStage(d,plan.account,request.requestId,request,op.key));
   demand(duplicate.status==="replay"&&canonicalHash(duplicate.result)===canonicalHash(admission.result),"final_replay_mismatch");
   await ledger.outcome({status:"delivered",result:admission.result,calls:inspection.jobs.length,recoveryVerified:true,
    pipelineAudit:final.generation_reservations_json[0].pipelineAudit});
   return {status:"delivered",history:1,usage:1};
  }
  if(admission.status==="progress"){
   demand(admission.progress.status==="pending"&&!admission.progress.running,"pipeline_stopped");
   return {status:"progress",nextStage:admission.progress.nextStage};
  }
  const stage=admission.stage,body=JSON.stringify(stage.payload),bound=validatePayload(body);
  demand(/^1:(review:0:[2-6]|revalidation:1:[0-6])$/.test(stage.key)&&stage.key===op.key&&
   stage.hash===bound.hash&&stage.reservedMicroUsd===bound.applicationReserve,"stage_binding");
  demand(await ledger.reserve(stage.key,body),"dispatch_denied");
  const started=performance.now();let receipt;
  try{receipt=responseEvidence(await transport(body,apiKey),body,apiKey,performance.now()-started);}
  catch{await ledger.finish(stage.key,"unknown",{failure:"provider_uncertain"});throw Error("provider_uncertain");}
  await ledger.finish(stage.key,receipt.status==="completed"?"succeeded":"failed",receipt.evidence);
  const progress=await ledger.mutate(d=>stages.checkpointGenerationStage(d,plan.account,request.requestId,admission.fingerprint,stage,request,receipt,performance.now()-started));
  demand(progress.status==="pending"&&progress.totalUnits<=336,"validation_failed");
  const recovery=await ledger.mutate(d=>stages.beginGenerationStage(d,plan.account,request.requestId,request,null));
  demand(recovery.status==="progress"&&recovery.progress.nextStage===progress.nextStage,"checkpoint_recovery_failed");
  return {status:"checkpointed",nextStage:progress.nextStage,reviewed:progress.reviewedUnits,total:progress.totalUnits};
 }catch(error){
  const allowed=["ledger_not_safe","account_binding","checkpoint_mismatch","validation_failed","final_save_mismatch","final_replay_mismatch","pipeline_stopped","stage_binding","dispatch_denied","provider_uncertain","checkpoint_recovery_failed","payload_size"];
  const reason=allowed.includes(error?.message)?error.message:"internal_or_persistence_failure";
  try{await ledger.outcome({status:"blocked",reason});}finally{await ledger.disable();}
  return {status:"blocked",reason};
 }
}
