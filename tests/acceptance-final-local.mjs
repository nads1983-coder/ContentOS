import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {buildPlan} from "../scripts/acceptance-final/plan.mjs";
import {validatePayload,validateManifest,loadModules,execute,canonicalHash} from "../scripts/acceptance-final/runtime.mjs";
const plan=buildPlan(Date.now()+3600000),load=loadModules(plan.modules),pipe=load("lib/generation-pipeline.ts");
test("fresh authorization carries both immutable audits and revalidates original 48 decisions",()=>{
 assert.equal(plan.preflight.worstCaseMicroGbp,3070415);assert.equal(plan.origin.reserved,605550);assert.equal(plan.origin.calls,2);
 assert.equal(plan.checkpoint.pipeline.decisions.length,48);assert.equal(plan.checkpoint.pipeline.decisions.filter(d=>d.kind==="unsupported").length,2);
 assert.equal(plan.checkpoint.pipeline.batch,1);assert.equal(plan.request.selectedTypes.length,14);
 assert.equal(plan.preflight.initialReviewBytes.length,6);assert.ok(plan.preflight.initialReviewBytes.every(n=>n<=56000));
 assert.equal(canonicalHash(plan.checkpoint),plan.restoredCheckpointHash);
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};
 assert.equal(validateManifest(signed,publicKey).newCap,2470000);assert.throws(()=>validateManifest(signed,publicKey,plan.expires+1));
});
test("transport rejects generation and oversized review while preserving full remaining payloads",()=>{
 assert.throws(()=>validatePayload(JSON.stringify(pipe.pipelinePayload(pipe.newGenerationPipeline(),plan.request))),/generation_forbidden/);
 for(let batch=1;batch<7;batch++)assert.doesNotThrow(()=>validatePayload(JSON.stringify(pipe.pipelinePayload({...plan.checkpoint.pipeline,batch},plan.request))));
 assert.throws(()=>validatePayload(" ".repeat(56001)),/payload_size/);
});
test("actual continuation starts at second batch; uncertainty retains spend and cannot redispatch",async()=>{
 let data={...structuredClone(plan.seedProfile),staged_validation_plan:plan.planHash},enabled=true,reserved=605550,calls=0;
 const jobs=[],ledger={inspect:async()=>({enabled,reserved,jobs,originPlanHash:plan.origin.planHash,originCheckpointHash:plan.origin.checkpointHash}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const v=fn(structuredClone(data));data=v.data;return v.result;},reserve:async(key,body)=>{assert.equal(key,"1:review:0:1");reserved+=validatePayload(body).reserve;jobs.push({key,state:"reserved"});return true;},
  finish:async(key,state)=>{jobs[0].state=state;},outcome:async()=>{enabled=false;},disable:async()=>{enabled=false;}};
 const transport=async()=>{calls++;throw Error("synthetic uncertainty");};
 const result=await execute(plan,{ledger,transport,apiKey:"synthetic"});assert.equal(result.reason,"provider_uncertain");assert.equal(calls,1);
 assert.equal(reserved,605550+validatePayload(JSON.stringify(pipe.pipelinePayload(plan.checkpoint.pipeline,plan.request))).reserve);
 assert.equal(jobs[0].state,"unknown");assert.equal(data.generation_history_json,undefined);assert.equal(data.usage_events_json,undefined);
 await execute(plan,{ledger,transport,apiKey:"synthetic"});assert.equal(calls,1);
});
