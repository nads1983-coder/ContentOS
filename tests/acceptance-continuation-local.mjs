import test from "node:test";
// Opt-in operator preflight: requires the preserved private audit and a live checkpoint deadline.
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {buildPlan} from "../scripts/acceptance-continuation/plan.mjs";
import {validatePayload,validateManifest,loadModules,execute,canonicalHash} from "../scripts/acceptance-continuation/runtime.mjs";
const plan=buildPlan(Date.now()+3600000),load=loadModules(plan.modules),pipe=load("lib/generation-pipeline.ts");
test("continuation binds exact verified checkpoint and all remaining payload bounds including original spend",()=>{
 assert.equal(plan.preflight.worstCaseMicroGbp,3073643);assert.ok(plan.preflight.worstCaseMicroGbp<=3080000);
 assert.equal(plan.origin.reserved,419173);assert.equal(plan.origin.calls,1);assert.equal(plan.request.selectedTypes.length,14);
 assert.equal(plan.preflight.initialReviewBytes.length,7);assert.ok(plan.preflight.initialReviewBytes.every(n=>n<=56000));
 assert.equal(canonicalHash(plan.checkpoint),plan.origin.checkpointHash);
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};
 assert.equal(validateManifest(signed,publicKey).cap,3080000);assert.throws(()=>validateManifest(signed,publicKey,plan.expires+1));
});
test("draft dispatch is forbidden even when correctly priced and signed application supports generation",()=>{
 assert.throws(()=>validatePayload(JSON.stringify(pipe.pipelinePayload(pipe.newGenerationPipeline(),plan.request))),/generation_forbidden/);
 for(let batch=0;batch<7;batch++)assert.doesNotThrow(()=>validatePayload(JSON.stringify(pipe.pipelinePayload({...plan.checkpoint.pipeline,batch},plan.request))));
});
test("actual candidate resumes at review without resetting draft; uncertainty stops with cumulative reservation retained",async()=>{
 let data={id:plan.account,plan:"pro_studio",subscription_status:"active",staged_validation_plan:plan.planHash,generation_reservations_json:[structuredClone(plan.checkpoint)]},enabled=true,reserved=419173,calls=0;
 const jobs=[],ledger={inspect:async()=>({enabled,reserved,jobs,originPlanHash:plan.origin.planHash,originCheckpointHash:plan.origin.checkpointHash}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const v=fn(structuredClone(data));data=v.data;return v.result;},reserve:async(key,body)=>{assert.equal(key,"1:review:0:0");reserved+=validatePayload(body).reserve;jobs.push({key,state:"reserved"});return true;},
  finish:async(key,state)=>{jobs[0].state=state;},outcome:async()=>{enabled=false;},disable:async()=>{enabled=false;}};
 const transport=async body=>{assert.equal(JSON.parse(body).max_output_tokens,4800);calls++;throw Error("isolated uncertain outcome");};
 const result=await execute(plan,{ledger,transport,apiKey:"synthetic"});assert.equal(result.reason,"provider_uncertain");assert.equal(calls,1);
 assert.equal(reserved,419173+validatePayload(JSON.stringify(pipe.pipelinePayload(plan.checkpoint.pipeline,plan.request))).reserve);
 assert.equal(jobs[0].state,"unknown");assert.equal(data.generation_reservations_json[0].pipeline.metrics[0].payloadHash,plan.checkpoint.pipeline.metrics[0].payloadHash);
 assert.equal(data.generation_history_json,undefined);assert.equal(data.usage_events_json,undefined);
 await execute(plan,{ledger,transport,apiKey:"synthetic"});assert.equal(calls,1);
});
