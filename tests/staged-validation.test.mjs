import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {buildPlan} from "../scripts/staged-validation/plan.mjs";
import {execute,validateManifest,validatePayload,validateRuntime,providerCall,responseEvidence,PROJECT,ROLE,sha,loadModules} from "../scripts/staged-validation/runtime.mjs";
import {harness as routeHarness} from "./generation-test-helpers.mjs";
import {captured,captureResponse} from "./grounding-capture-helpers.mjs";
const plan=buildPlan(Date.now()+3600000),pack=captured[0];
const frozenGrounding=loadModules(plan.modules)("lib/factual-grounding.ts");
test("consumed campaign refuses prepare/execute before credential or database access",()=>{
 for(const mode of ["prepare","execute"]){const r=spawnSync(process.execPath,["scripts/staged-validation/operator.mjs",mode],{encoding:"utf8",env:{PATH:process.env.PATH,HOME:process.env.HOME}});
 assert.equal(r.status,1);assert.match(r.stderr,/staged_validation_campaign_closed/);assert.match(r.stderr,/"providerCalls":0/);}
});
export const asResponse = r => ({...r,model:"gpt-5.2",service_tier:"default",usage:{...r.usage,total_tokens:r.usage.input_tokens+r.usage.output_tokens}});
function harness(options={}) {
 const p={...plan,request:{...pack.request,requestId:plan.request.requestId}};
 let data={id:p.account,email:`${p.account}@example.invalid`,plan:"pro_studio",subscription_status:"active",staged_validation_plan:p.planHash},enabled=true,reserved=0,outcome;
 const jobs=[],calls=[];
 const ledger={
  inspect:async()=>({enabled,reserved,jobs}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const v=fn(structuredClone(data));data=structuredClone(v.data);return v.result;},
  reserve:async(k,b)=>{const v=validatePayload(b);if(!enabled||jobs.some(j=>j.key===k||j.state!=="succeeded")||jobs.length>=23||reserved+v.reserve>4000000)return false;reserved+=v.reserve;jobs.push({key:k,state:"reserved",reserve:v.reserve});return true;},
  finish:async(k,s,e)=>{const j=jobs.find(j=>j.key===k);j.state=s;j.evidence=e;if(s!=="succeeded")enabled=false;},
  outcome:async e=>{outcome=e;enabled=false;},disable:async()=>{enabled=false;}
 };
 return {p,ledger,calls,jobs,get data(){return data;},get reserved(){return reserved;},get outcome(){return outcome;},
 transport:async b=>{calls.push(b);assert.equal(jobs.at(-1).state,"reserved");if(options.fail)throw Error("secret-like error must never escape");
   const r=asResponse(captureResponse(pack,JSON.parse(b),frozenGrounding));if(options.unknownUsage)delete r.usage;return r;}};
}
test("signed manifest binds one brief, all formats, candidate, expiry and GBP4/23 calls",()=>{
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};
 assert.equal(validateManifest(signed,publicKey).request.selectedTypes.length,14);
 assert.throws(()=>validateManifest({...signed,manifest:manifest.replace('"cap":4000000','"cap":5000000')},publicKey));
 assert.throws(()=>validateManifest(signed,publicKey,plan.expires+1));
});
test("runtime requires existing credential, exact protected Preview target and restricted isolated role",()=>{
 const env={VERCEL_ENV:"preview",VERCEL_PROJECT_ID:PROJECT,OPENAI_API_KEY:"sk-synthetic-not-a-real-key-000",BENCHMARK_DATABASE_URL:`postgres://${ROLE}:synthetic@ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=verify-full`};
 assert.ok(validateRuntime(env));
 for(const change of [{VERCEL_ENV:"production"},{VERCEL_PROJECT_ID:"other"},{OPENAI_API_KEY:""},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL.replace(ROLE,"contentos_owner")}])assert.throws(()=>validateRuntime({...env,...change}));
});
test("real staged transitions complete all 14 captured formats, recover checkpoint and replay final save without calls",async()=>{
 const h=harness(),result=await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});
 assert.equal(result.status,"delivered");assert.equal(result.calls,6);assert.equal(result.recoveryVerified,true);
 assert.equal(result.pipelineAudit.reviewedUnits,228);assert.equal(h.data.usage_events_json.length,1);assert.equal(h.data.generation_history_json.length,1);
 assert.equal((await h.ledger.inspect()).enabled,false);assert.ok(h.reserved<4000000);
});
test("transport uncertainty and missing usage stop once, retain full reservation and preserve old draft",async()=>{
 for(const option of [{fail:true},{unknownUsage:true}]){
  const h=harness(option),result=await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});
  assert.equal(result.reason,"provider_uncertain");assert.equal(h.calls.length,1);assert.equal(h.jobs[0].state,"unknown");assert.ok(h.reserved>0);assert.equal(h.data.generation_history_json,undefined);
 }
});
test("restarting consumed ledger cannot cause another paid request",async()=>{
 const h=harness();await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});
 const n=h.calls.length,r=await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});assert.equal(r.reason,"ledger_not_pristine");assert.equal(h.calls.length,n);
});
test("an unsupported claim stops this campaign before buying correction or further reviews",async()=>{
 const h=harness(),original=h.transport;
 const transport=async b=>{const r=await original(b);if(JSON.parse(b).text.format.name!=="social_content_generation"){
   const review=JSON.parse(r.output_text);review.decisions[0]={...review.decisions[0],kind:"unsupported",sourceIds:[],reason:"missing_evidence",replacement:"A hypothetical illustration."};r.output_text=JSON.stringify(review);
 }return r;};
 const result=await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport});assert.equal(result.reason,"unsupported_claim_detected");
 assert.equal(h.calls.length,2);assert.equal(h.data.generation_history_json,undefined);assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
});
test("unpriced payload, tier, output cap and excessive bytes never reach transport",async()=>{
 const h=harness();await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});const p=JSON.parse(h.calls[0]);
 for(const change of [{model:"other"},{service_tier:"flex"},{max_output_tokens:null},{tools:[]},{input:"x".repeat(160001)}])assert.throws(()=>validatePayload(JSON.stringify({...p,...change})));
 const v=validatePayload(h.calls[0]);assert.equal(v.hash,sha(h.calls[0]));assert.ok(v.reserve>0);
});
test("provider transport is a single fixed request with timeout, no redirect or retry",async()=>{
 const h=harness();await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});let calls=0;
 await assert.rejects(providerCall(h.calls[0],"mock",async(url,init)=>{calls++;assert.equal(url,"https://api.openai.com/v1/responses");assert.equal(init.redirect,"error");assert.ok(init.signal);return new Response("failure",{status:500});}));assert.equal(calls,1);
});
test("response usage must fit the prepaid token bounds and known tier/model",async()=>{
 const h=harness();await execute(h.p,{ledger:h.ledger,apiKey:"mock",transport:h.transport});const b=h.calls[0],r=asResponse(captureResponse(pack,JSON.parse(b)));
 for(const change of [{service_tier:"priority"},{model:"other"},{usage:{input_tokens:999999,output_tokens:1,total_tokens:1000000}},{output_text:"mock"}])assert.throws(()=>responseEvidence({...r,...change},b,"mock",1));
});

const liveDirectory=new URL("../docs/benchmarks/staged-delivery-2026-10-18/",import.meta.url);
const live=JSON.parse(readFileSync(new URL("execution.json",liveDirectory),"utf8"));
const liveRequest=JSON.parse(readFileSync(new URL("brief.json",liveDirectory),"utf8"));
test("captured first batch now checkpoints; replaying it as a different batch still refuses unchecked delivery",async()=>{
 const h=routeHarness(),request={...liveRequest,requestId:plan.request.requestId};
 h.provider=async payload=>{const e=live.jobs[payload.text.format.name==="social_content_generation"?0:1].evidence;return {status:e.status,output_text:e.outputText,usage:e.usage};};
 const result=await h.finish(request);assert.equal(result.response.status,502);assert.equal(result.body.code,"grounding_failed");
 assert.equal(h.calls.length,3);assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 assert.equal(h.data.generation_reservations_json[0].pipeline.decisions.length,48);
 assert.ok(h.data.generation_reservations_json[0].pipeline.draft);assert.equal((await h.post(request)).response.status,409);assert.equal(h.calls.length,3);
});
test("captured 48-decision review has four reproducible certificate rejections, not a timeout or malformed response",()=>{
 const load=loadModules(plan.modules),contract=load("lib/generation-contract.ts"),batching=load("lib/grounding-batches.ts");
 const request=contract.normalizeGenerationRequest(liveRequest),draft=contract.parseGenerationOutput(live.jobs[0].evidence.outputText,request);
 const batch=batching.groundingBatch(draft,request,0,0),review=JSON.parse(live.jobs[1].evidence.outputText),rejected=[];
 assert.equal(review.decisions.length,48);assert.equal(review.decisions.filter(d=>d.kind==="unsupported").length,7);
 for(const d of review.decisions){try{batching.parseBatchReview(JSON.stringify({decisions:[d]}),{...batch,units:[batch.units.find(u=>u.id===d.id)]});}catch{rejected.push(d.id);}}
 assert.deepEqual(rejected,["u4","u17","u31","u46"]);assert.throws(()=>batching.parseBatchReview(live.jobs[1].evidence.outputText,batch));
});
