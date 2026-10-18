import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {buildPlan} from "../scripts/final-delivery/plan.mjs";
import {execute,validateManifest,validatePayload,validateRuntime,PROJECT,ROLE,loadModules} from "../scripts/final-delivery/runtime.mjs";
import {classificationResponse,request} from "./classification-capture-helpers.mjs";
import {bindDatabaseActions} from "../scripts/final-delivery/cleanup.mjs";
import {cleanupCampaign} from "../scripts/grounding-benchmark/cleanup.mjs";
import {changedFields} from "../scripts/final-delivery/evidence.mjs";
const plan=buildPlan(Date.now()+3600000);
test("consumed final campaign refuses preparation or execution before database/credential access",()=>{
 for(const mode of ["prepare","execute"]){const r=spawnSync(process.execPath,["scripts/final-delivery/operator.mjs",mode],{encoding:"utf8",env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  assert.equal(r.status,1);assert.match(r.stderr,/final_delivery_campaign_closed/);assert.match(r.stderr,/"providerCalls":0/);}
});
test("correction evidence compares whole fields once despite multiple unit spans sharing a path",()=>{
 const pack={sections:[{body:"First sentence. Second sentence."}]},units=[{path:"sections.0.body",text:"First sentence."},{path:"sections.0.body",text:"Second sentence."}];
 assert.deepEqual(changedFields(pack,structuredClone(pack),units),[]);
 assert.deepEqual(changedFields(pack,{sections:[{body:"First sentence. Corrected sentence."}]},units),[{path:"sections.0.body",original:pack.sections[0].body,replacement:"First sentence. Corrected sentence."}]);
});
function harness(fail=false) {
 const p={...plan,request:{...request,requestId:plan.request.requestId}};
 let data={id:p.account,plan:"pro_studio",subscription_status:"active",staged_validation_plan:p.planHash},enabled=true,reserved=0;
 const jobs=[];
 const ledger={inspect:async()=>({enabled,reserved,jobs}),snapshot:async()=>structuredClone(data),
  mutate:async fn=>{const v=fn(structuredClone(data));data=structuredClone(v.data);return v.result;},
  reserve:async(k,b)=>{const v=validatePayload(b);if(!enabled||jobs.length>=13||reserved+v.reserve>2700000||jobs.some(j=>j.key===k||j.state!=="succeeded"))return false;
   jobs.push({key:k,state:"reserved"});reserved+=v.reserve;return true;},
  finish:async(k,s,e)=>Object.assign(jobs.find(j=>j.key===k),{state:s,evidence:e}),outcome:async()=>{enabled=false;},disable:async()=>{enabled=false;}};
 const transport=async b=>{assert.equal(jobs.at(-1).state,"reserved");if(fail)throw Error("synthetic failure");const r=classificationResponse(JSON.parse(b));
  return {...r,model:"gpt-5.2",service_tier:"default",usage:{...r.usage,total_tokens:r.usage.input_tokens+r.usage.output_tokens}};};
 return {p,ledger,transport,jobs,get data(){return data;},get reserved(){return reserved;}};
}
test("fresh authorization binds candidate, all formats, GBP2.70 and thirteen requests",()=>{
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};
 assert.equal(validateManifest(signed,publicKey).cap,2700000);assert.equal(plan.maxCalls,13);assert.equal(plan.request.selectedTypes.length,14);
 assert.throws(()=>validateManifest({...signed,manifest:manifest.replace('"cap":2700000','"cap":4000000')},publicKey));
 assert.throws(()=>validateManifest(signed,publicKey,plan.expires+1));
});
test("exact payload caps leave worst-case thirteen calls below the authorized ceiling",()=>{
 const stages=loadModules(plan.modules)("lib/generation-stages.ts");
 const a=stages.beginGenerationStage({id:plan.account,plan:"pro_studio",subscription_status:"active"},plan.account,plan.request.requestId,plan.request,null);
 const p=a.result.stage.payload;
 for(const [tokens,cap] of [[24000,20000],[4800,40000]]){
  const base={...p,max_output_tokens:tokens,input:""},bytes=Buffer.byteLength(JSON.stringify(base));
  const body=JSON.stringify({...base,input:"x".repeat(cap-bytes)}),v=validatePayload(body);
  assert.equal(v.bytes,cap);assert.equal(v.reserve,tokens===24000?472710:180460);
  assert.throws(()=>validatePayload(JSON.stringify({...base,input:"x".repeat(cap-bytes+1)})),/payload_size/);
 }
 assert.equal(472710+12*180460,2638230);assert.ok(2638230<2700000);
});
test("captured unsupported claims permit one local repair and full fresh revalidation before exact-once save",async()=>{
 const h=harness(),r=await execute(h.p,{ledger:h.ledger,transport:h.transport,apiKey:"synthetic-secret"});
 assert.equal(r.status,"delivered");assert.equal(r.calls,13);assert.equal(r.recoveryVerified,true);
 assert.equal(r.pipelineAudit.reviewedUnits,280);assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
 assert.equal(h.jobs.filter(j=>j.key.includes(":review:")).length,6);assert.equal(h.jobs.filter(j=>j.key.includes(":revalidation:")).length,6);
 assert.ok(h.reserved<2700000);assert.equal((await h.ledger.inspect()).enabled,false);
});
test("uncertain provider outcome retains full reservation and never retries or delivers",async()=>{
 const h=harness(true),r=await execute(h.p,{ledger:h.ledger,transport:h.transport,apiKey:"synthetic-secret"});
 assert.equal(r.reason,"provider_uncertain");assert.equal(h.jobs.length,1);assert.equal(h.jobs[0].state,"unknown");assert.ok(h.reserved>0);
 assert.equal(h.data.generation_history_json,undefined);await execute(h.p,{ledger:h.ledger,transport:h.transport,apiKey:"synthetic-secret"});assert.equal(h.jobs.length,1);
});
test("production environments and owner credentials cannot execute",()=>{
 const env={VERCEL_ENV:"preview",VERCEL_PROJECT_ID:PROJECT,OPENAI_API_KEY:"sk-synthetic-not-a-real-key-000",BENCHMARK_DATABASE_URL:`postgres://${ROLE}:synthetic@ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=verify-full`};
 assert.ok(validateRuntime(env));for(const change of [{VERCEL_ENV:"production"},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL.replace(ROLE,"contentos_owner")}])assert.throws(()=>validateRuntime({...env,...change}));
});
test("database outage or mismatched identity cannot block verified Preview removal or permit database mutations",async()=>{
 for(const client of [undefined,{query:async()=>{throw Error("offline");}},{query:async()=>({rows:[{plan_hash:"wrong"}]})}]){
  let mutations=0,deleted=false;
  const deployment={id:"dpl_synthetic",projectId:PROJECT,target:"preview",meta:{benchmarkPlanHash:plan.planHash}};
  const result=await cleanupCampaign({projectId:PROJECT,planHash:plan.planHash,attempted:true,knownDeployments:[deployment],
   databaseSteps:bindDatabaseActions(client,"synthetic_schema",plan.planHash,{disable:()=>{mutations++;}}),
   exportAudit:async()=>{throw Error("offline");},listDeployments:async()=>({deployments:[deployment],next:null}),
   getDeployment:async()=>deleted?null:deployment,deleteDeployment:async()=>{deleted=true;},rememberDeployment:async()=>{}});
  assert.equal(mutations,0);assert.equal(deleted,true);assert.equal(result.safeToEraseRecovery,false);
  assert.deepEqual(result.deletedDeploymentIds,[deployment.id]);
 }
});
test("live second batch reproduces seventeen certificate mismatches and stops without final save",async()=>{
 const evidence=JSON.parse(readFileSync(new URL("../docs/benchmarks/final-delivery-2026-10-18/execution.json",import.meta.url),"utf8"));
 const request=JSON.parse(readFileSync(new URL("../docs/benchmarks/final-delivery-2026-10-18/brief.json",import.meta.url),"utf8"));
 const h=harness();h.p.request={...request,requestId:h.p.request.requestId};let calls=0;
 const transport=async body=>{
  const job=evidence.jobs[calls++];assert.ok(job,"must not buy another call");
  const payload=JSON.parse(body);assert.equal(payload.input,job.payload.input);
  return {status:job.evidence.status,output_text:job.evidence.outputText,model:job.evidence.model,service_tier:job.evidence.serviceTier,usage:job.evidence.usage};
 };
 const r=await execute(h.p,{ledger:h.ledger,apiKey:"synthetic-secret",transport});
 assert.equal(r.reason,"validation_failed");assert.equal(calls,3);assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 const p=h.data.generation_reservations_json[0].pipeline;assert.equal(p.decisions.length,48);assert.ok(p.draft);assert.equal(p.pass,0);
 const load=loadModules(plan.modules),batching=load("lib/grounding-batches.ts"),batch=batching.groundingBatch(p.draft,h.p.request,1,0);
 const review=JSON.parse(evidence.jobs[2].evidence.outputText),rejected=[];
 for(const d of review.decisions){try{batching.parseBatchReview(JSON.stringify({decisions:[d]}),{...batch,units:[batch.units.find(u=>u.id===d.id)]});}catch{rejected.push(d.id);}}
 assert.deepEqual(rejected,["u58","u65","u74",...Array.from({length:12},(_,i)=>`u${79+i}`),"u91","u94"]);
 assert.equal(p.metrics.at(-1).status,"failed");
 // Characterize a known release blocker, not a safety pass: the frozen candidate
 // accepts an added every-page quantifier despite only notebook-level evidence.
 const initial=batching.groundingBatch(p.draft,h.p.request,0,0),first=JSON.parse(evidence.jobs[1].evidence.outputText).decisions;
 assert.match(initial.units.find(u=>u.id==="u5").text,/on every page/);
 assert.equal(first.find(d=>d.id==="u5").kind,"supported");
 assert.doesNotThrow(()=>batching.parseBatchReview(evidence.jobs[1].evidence.outputText,initial));
 assert.doesNotMatch(h.p.request.source,/on every page|on each page/);
 assert.match(review.decisions.find(d=>d.id==="u51").replacement,/page with three printed headings/);
});
