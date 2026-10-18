import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {buildPlan} from "../scripts/live-acceptance/plan.mjs";
import {validatePayload,validateManifest,validateRuntime,loadModules,execute,responseEvidence,PROJECT,ROLE,reserveMicroGbp,DRAFT_BYTES,REVIEW_BYTES} from "../scripts/live-acceptance/runtime.mjs";
import {classificationResponse,request as historical} from "./classification-capture-helpers.mjs";
const plan=buildPlan(Date.now()+3600000);
test("consumed live acceptance refuses preparation and execution before credentials or database access",()=>{
 for(const mode of ["prepare","execute"]){const r=spawnSync(process.execPath,["scripts/live-acceptance/operator.mjs",mode],{encoding:"utf8",env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  assert.equal(r.status,1);assert.match(r.stderr,/live_acceptance_campaign_closed/);}
});
test("RC and sealed source remain complete; budget envelope includes thirteen maximum-output calls",()=>{
 assert.equal(plan.candidate,"717b4dfb9f7fcd3257ac9c0750fbc9bcb74bffa8");
 assert.equal(plan.request.selectedTypes.length,14);assert.equal(plan.preflight.draftBytes,21656);
 assert.equal(plan.preflight.worstCaseMicroGbp,2698945);assert.ok(plan.preflight.worstCaseMicroGbp<2700000);
 assert.ok(plan.modules["lib/claim-scope.ts"]);assert.equal(loadModules(plan.modules)("lib/generation-pipeline.ts").PIPELINE_LIMITS.reviewPolicy,3);
});
test("maximum usage receipts use rational arithmetic without one-micro-pound false uncertainty",()=>{
 const pipeline=loadModules(plan.modules)("lib/generation-pipeline.ts"),p=pipeline.pipelinePayload(pipeline.newGenerationPipeline(),plan.request);
 const base={...p,input:""},bytes=Buffer.byteLength(JSON.stringify(base)),body=JSON.stringify({...base,input:"x".repeat(20024-bytes)}),v=validatePayload(body);
 assert.equal(v.reserve,416031);
 for(const cached of [0,12000])assert.doesNotThrow(()=>responseEvidence({status:"completed",output_text:"synthetic",model:"gpt-5.2",service_tier:"default",
  usage:{input_tokens:v.inputLimit,output_tokens:v.outputLimit,total_tokens:v.inputLimit+v.outputLimit,input_tokens_details:{cached_tokens:cached}}},body,"not-a-key",1));
});
test("signed authorization binds immutable spending policy and rejects altered/expired plans",()=>{
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};
 assert.equal(validateManifest(signed,publicKey).cap,2700000);
 assert.throws(()=>validateManifest({...signed,manifest:manifest.replace('"cap":2700000','"cap":4000000')},publicKey));
 assert.throws(()=>validateManifest(signed,publicKey,plan.expires+1));
});
test("GBP spending and unchanged candidate USD padding are separately checked; oversize is refused",()=>{
 const pipeline=loadModules(plan.modules)("lib/generation-pipeline.ts"),p=pipeline.pipelinePayload(pipeline.newGenerationPipeline(),plan.request);
 for(const[tokens,cap]of[[24000,DRAFT_BYTES],[4800,REVIEW_BYTES]]){
  const base={...p,input:"",max_output_tokens:tokens},n=Buffer.byteLength(JSON.stringify(base));
  const body=JSON.stringify({...base,input:"x".repeat(cap-n)}),v=validatePayload(body);
  assert.equal(v.bytes,cap);assert.equal(v.reserve,reserveMicroGbp(cap,tokens));
  assert.equal(v.applicationReserve,Math.ceil(((cap+4096)*1.75+tokens*14)*1.25));assert.notEqual(v.reserve,v.applicationReserve);
  assert.throws(()=>validatePayload(JSON.stringify({...base,input:"x".repeat(cap-n+1)})),/payload_size/);
 }
 assert.throws(()=>validatePayload(JSON.stringify({...p,model:"different"})),/unpriced/);
});
function harness(uncertain=false){
 const p={...plan,request:{...historical,requestId:plan.request.requestId}};
 let data={id:p.account,plan:"pro_studio",subscription_status:"active",staged_validation_plan:p.planHash},enabled=true,reserved=0;
 const jobs=[];
 const ledger={inspect:async()=>({enabled,reserved,jobs}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const value=fn(structuredClone(data));data=structuredClone(value.data);return value.result;},
  reserve:async(key,body)=>{const v=validatePayload(body);if(!enabled||jobs.length>=13||reserved+v.reserve>2700000||jobs.some(j=>j.key===key||j.state!=="succeeded"))return false;jobs.push({key,state:"reserved"});reserved+=v.reserve;return true;},
  finish:async(key,state,evidence)=>Object.assign(jobs.find(j=>j.key===key),{state,evidence}),outcome:async()=>{enabled=false;},disable:async()=>{enabled=false;}};
 const transport=async body=>{assert.equal(jobs.at(-1).state,"reserved");if(uncertain)throw Error("isolated uncertainty");
  const r=classificationResponse(JSON.parse(body));return {...r,model:"gpt-5.2",service_tier:"default",usage:{...r.usage,total_tokens:r.usage.input_tokens+r.usage.output_tokens}};};
 return {p,ledger,transport,jobs,get data(){return data;},get reserved(){return reserved;}};
}
test("real frozen transitions perform bounded correction, exhaustive fresh review, recovery and one save with fixture-only provider",async()=>{
 const h=harness(),r=await execute(h.p,{ledger:h.ledger,transport:h.transport,apiKey:"synthetic"});
 assert.equal(r.status,"delivered");assert.equal(r.calls,13);assert.equal(r.pipelineAudit.reviewedUnits,280);assert.equal(r.recoveryVerified,true);
 assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
 assert.equal(h.jobs.filter(j=>j.key.includes(":review:")).length,6);assert.equal(h.jobs.filter(j=>j.key.includes(":revalidation:")).length,6);assert.ok(h.reserved<2700000);
});
test("unknown provider result keeps reservation, blocks paid retry and never delivers",async()=>{
 const h=harness(true),r=await execute(h.p,{ledger:h.ledger,transport:h.transport,apiKey:"synthetic"});
 assert.equal(r.reason,"provider_uncertain");assert.equal(h.jobs.length,1);assert.equal(h.jobs[0].state,"unknown");assert.ok(h.reserved>0);assert.equal(h.data.generation_history_json,undefined);
 await execute(h.p,{ledger:h.ledger,transport:h.transport,apiKey:"synthetic"});assert.equal(h.jobs.length,1);
});
test("actual 307-unit capture stops at the authorized coverage boundary without a second dispatch",async()=>{
 const audit=JSON.parse(readFileSync(new URL("../docs/benchmarks/live-acceptance-rc717-2026-10-18/execution.json",import.meta.url),"utf8"));
 const h=harness();h.p.request=plan.request;let calls=0;
 const transport=async body=>{
  assert.equal(++calls,1);const j=audit.jobs[0];assert.equal(JSON.parse(body).input,j.payload.input);
  return {status:j.evidence.status,output_text:j.evidence.outputText,model:j.evidence.model,service_tier:j.evidence.serviceTier,usage:j.evidence.usage};
 };
 const r=await execute(h.p,{ledger:h.ledger,transport,apiKey:"synthetic"});
 assert.equal(r.reason,"coverage_budget");assert.equal(calls,1);assert.equal(h.reserved,419173);
 assert.equal(h.jobs[0].state,"succeeded");assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 const draft=h.data.generation_reservations_json[0].pipeline.draft,load=loadModules(plan.modules);
 assert.equal(draft.sections.length,14);assert.equal(load("lib/factual-grounding.ts").groundingUnits(draft).length,307);
 assert.equal(load("lib/grounding-batches.ts").groundingBatch(draft,plan.request,0,0).count,7);
});
test("only protected Preview runner identity and isolated host are accepted",()=>{
 const env={VERCEL_ENV:"preview",VERCEL_PROJECT_ID:PROJECT,OPENAI_API_KEY:"sk-synthetic-not-a-real-key-000",BENCHMARK_DATABASE_URL:`postgres://${ROLE}:synthetic@ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=verify-full`};
 assert.ok(validateRuntime(env));for(const change of[{VERCEL_ENV:"production"},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL.replace(ROLE,"contentos_owner")},{VERCEL_PROJECT_ID:"other"}])assert.throws(()=>validateRuntime({...env,...change}));
});
