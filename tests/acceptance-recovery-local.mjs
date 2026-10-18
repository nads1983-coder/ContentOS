import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {buildPlan} from "../scripts/acceptance-recovery/plan.mjs";
import {validatePayload,validateManifest,loadModules,execute,canonicalHash} from "../scripts/acceptance-recovery/runtime.mjs";
import {step,verifyOperation} from "../scripts/acceptance-recovery/step.mjs";
import {finalClassificationResponse} from "./final-classification-capture-helpers.mjs";
const plan=buildPlan(Date.now()+3600000),load=loadModules(plan.modules),pipe=load("lib/generation-pipeline.ts");
test("fresh authorization carries three immutable audits and revalidates original 96 decisions",()=>{
 assert.equal(plan.preflight.worstCaseMicroGbp,3067768);assert.equal(plan.origin.reserved,792508);assert.equal(plan.origin.calls,3);
 assert.equal(plan.checkpoint.pipeline.decisions.length,96);assert.equal(plan.checkpoint.pipeline.decisions.filter(d=>d.kind==="unsupported").length,6);
 assert.equal(plan.checkpoint.pipeline.batch,2);assert.equal(plan.request.selectedTypes.length,14);
 assert.equal(plan.preflight.initialReviewBytes.length,5);assert.ok(plan.preflight.initialReviewBytes.every(n=>n<=56000));
 assert.equal(canonicalHash(plan.checkpoint),plan.restoredCheckpointHash);
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};
 assert.equal(validateManifest(signed,publicKey).newCap,2280000);assert.throws(()=>validateManifest(signed,publicKey,plan.expires+1));
});
test("replacement operation signatures bind phase, campaign and deadline",()=>{
 const {publicKey,privateKey}=generateKeyPairSync("ed25519");
 const operation=JSON.stringify({mode:"step",key:"1:review:0:2",planHash:plan.planHash,expires:Date.now()+60000});
 const signed={operation,signature:sign(null,Buffer.from(operation),privateKey).toString("base64")};
 assert.equal(verifyOperation(signed,publicKey,plan).key,"1:review:0:2");
 assert.throws(()=>verifyOperation({...signed,operation:operation.replace("step","preflight")},publicKey,plan));
 assert.throws(()=>verifyOperation(signed,publicKey,{...plan,planHash:"0".repeat(64)}));
 assert.throws(()=>verifyOperation(signed,publicKey,plan,Date.now()+120000));
});
test("replacement steps require preflight then persist once after all twelve explicit mock reviews",async()=>{
 let data={...structuredClone(plan.seedProfile),staged_validation_plan:plan.planHash},enabled=true,reserved=792508,outcome,calls=0;
 const jobs=[],ledger={inspect:async()=>({enabled,reserved,jobs,outcome}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const v=fn(structuredClone(data));assert.equal(v.data.id,plan.account);data=v.data;return v.result;},
  reserve:async(key,body)=>{if(jobs.some(j=>j.key===key))return false;reserved+=validatePayload(body).reserve;jobs.push({key,state:"reserved"});return true;},
  finish:async(key,state)=>{jobs.find(j=>j.key===key).state=state;},outcome:async e=>{outcome=e;enabled=false;},disable:async()=>{enabled=false;}};
 const transport=async body=>{calls++;const r=finalClassificationResponse(JSON.parse(body));return{...r,model:"gpt-5.2",service_tier:"default",usage:{...r.usage,total_tokens:r.usage.input_tokens+r.usage.output_tokens}};};
 let r=await step(plan,{mode:"preflight"},{ledger,transport,apiKey:"synthetic"});assert.equal(r.status,"ready");assert.equal(calls,0);
 for(let i=0;i<20&&r.status!=="delivered";i++){r=await step(plan,{mode:"step",key:r.nextStage},{ledger,transport,apiKey:"synthetic"});assert.notEqual(r.status,"blocked");}
 assert.equal(r.status,"delivered");assert.equal(calls,12);assert.equal(data.generation_history_json.length,1);assert.equal(data.usage_events_json.length,1);
 assert.equal(outcome.pipelineAudit.reviewedUnits,307);assert.ok(reserved<=3072508);
 const duplicate=await step(plan,{mode:"step",key:"1:save:1:0"},{ledger,transport,apiKey:"synthetic"});assert.equal(duplicate.status,"delivered");assert.equal(calls,12);
});
test("transport rejects generation and oversized review while preserving full remaining payloads",()=>{
 assert.throws(()=>validatePayload(JSON.stringify(pipe.pipelinePayload(pipe.newGenerationPipeline(),plan.request))),/generation_forbidden/);
 for(let batch=2;batch<7;batch++)assert.doesNotThrow(()=>validatePayload(JSON.stringify(pipe.pipelinePayload({...plan.checkpoint.pipeline,batch},plan.request))));
 assert.throws(()=>validatePayload(" ".repeat(56001)),/payload_size/);
});
test("actual continuation starts at third batch; uncertainty retains spend and cannot redispatch",async()=>{
 let data={...structuredClone(plan.seedProfile),staged_validation_plan:plan.planHash},enabled=true,reserved=792508,calls=0;
 const jobs=[],ledger={inspect:async()=>({enabled,reserved,jobs,originPlanHash:plan.origin.planHash,originCheckpointHash:plan.origin.checkpointHash}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const v=fn(structuredClone(data));data=v.data;return v.result;},reserve:async(key,body)=>{assert.equal(key,"1:review:0:2");reserved+=validatePayload(body).reserve;jobs.push({key,state:"reserved"});return true;},
  finish:async(key,state)=>{jobs[0].state=state;},outcome:async()=>{enabled=false;},disable:async()=>{enabled=false;}};
 const transport=async()=>{calls++;throw Error("synthetic uncertainty");};
 const result=await execute(plan,{ledger,transport,apiKey:"synthetic"});assert.equal(result.reason,"provider_uncertain");assert.equal(calls,1);
 assert.equal(reserved,792508+validatePayload(JSON.stringify(pipe.pipelinePayload(plan.checkpoint.pipeline,plan.request))).reserve);
 assert.equal(jobs[0].state,"unknown");assert.equal(data.generation_history_json,undefined);assert.equal(data.usage_events_json,undefined);
 await execute(plan,{ledger,transport,apiKey:"synthetic"});assert.equal(calls,1);
});
