import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { buildBenchmarkPlan } from "../scripts/benchmark-content.mjs";
import { PROJECT, ROLE, JOBS, FOLLOWUP_JOBS, RESERVATION, reservationForJob, validateManifest, validateRuntime, evidenceFromResponse, executePlan, providerCall } from "../scripts/benchmark-preview/runner.mjs";

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const source=buildBenchmarkPlan();
const plan={project:PROJECT,environment:"preview",role:ROLE,expires:Date.now()+3600000,planHash:source.planHash,jobs:source.jobs};
const signed=value=>{const manifest=JSON.stringify(value);return {manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};};
const response=()=>({status:"completed",service_tier:"default",output_text:'{"sections":[]}',usage:{input_tokens:100,output_tokens:200,total_tokens:300,input_tokens_details:{cached_tokens:50}}});
const env={VERCEL_ENV:"preview",VERCEL_PROJECT_ID:PROJECT,OPENAI_API_KEY:`sk-${"synthetic".repeat(8)}`,BENCHMARK_DATABASE_URL:`postgresql://${ROLE}:placeholder@ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=verify-full`};
function memoryLedger(p=plan) {
  let enabled=true,reserved=p.startingReservedGbpMicros??0;const jobs=[...(p.priorJobs??[]).map(j=>({...j,state:"succeeded",reservationGbpMicros:RESERVATION})),...p.jobs.map(j=>({id:j.id,payloadHash:j.payloadHash,state:"ready",reservationGbpMicros:reservationForJob(j)}))];
  return {get reserved(){return reserved;},get enabled(){return enabled;},jobs,
    async inspect(){return {enabled,unexpired:true,reservedGbpMicros:reserved,jobs};},
    async reserve(_h,id){const j=jobs.find(j=>j.id===id);if(!enabled||j.state!=="ready"||jobs.some(j=>j.state==="reserved")||reserved+j.reservationGbpMicros>5000000)return false;j.state="reserved";reserved+=j.reservationGbpMicros;return true;},
    async finish(_h,id,state,evidence){Object.assign(jobs.find(j=>j.id===id),{state,evidence});},
    async disable(){enabled=false;}
  };
}
test("signed operator manifest retains exact six prepared jobs and all 14 formats",()=>{
  const value=validateManifest(signed(plan),publicKey);assert.deepEqual(value.jobs.map(j=>j.id),JOBS);
  assert.ok(value.jobs.every(j=>j.request.selectedTypes.length===14));
  assert.equal(6*RESERVATION,3413760);
});

function followupPlan() {
  return {...plan,phase:"followup",startingReservedGbpMicros:3413760,priorJobs:plan.jobs.map(({id,payloadHash})=>({id,payloadHash})),jobs:plan.jobs.filter(j=>j.variant==="candidate").map(j=>{const job={...j,id:`${j.brief}:corrected`};return {...job,reserveGbpMicros:reservationForJob(job)};})};
}
test("followup authorization appends exactly three fixed jobs without resetting original spend",()=>{
  const p=followupPlan(),valid=validateManifest(signed(p),publicKey);
  assert.deepEqual(valid.jobs.map(j=>j.id),FOLLOWUP_JOBS);
  assert.ok(3413760+valid.jobs.reduce((s,j)=>s+reservationForJob(j),0)<=5000000);
  assert.throws(()=>validateManifest(signed({...p,startingReservedGbpMicros:0}),publicKey));
  const bad=structuredClone(p);bad.jobs[0].reserveGbpMicros=1;assert.throws(()=>validateManifest(signed(bad),publicKey));
});
test("followup exact-byte bounds cannot authorize a cumulative total above GBP5",()=>{
  const p=followupPlan();for(const j of p.jobs){const body=JSON.parse(j.body);body.input+="x".repeat(48000);j.body=JSON.stringify(body);j.payloadHash=createHash("sha256").update(j.body).digest("hex");j.reserveGbpMicros=reservationForJob(j);}
  assert.throws(()=>validateManifest(signed(p),publicKey));
});
test("followup preserves six completed identities and dispatches only three new attempts",async()=>{
  const p=followupPlan(),ledger=memoryLedger(p);let calls=0;
  const r=await executePlan(p,{ledger,apiKey:"synthetic",transport:async j=>{calls++;assert.equal(ledger.jobs.find(x=>x.id===j.id).state,"reserved");return response();}});
  assert.equal(calls,3);assert.equal(r.reservedGbpMicros,3413760+p.jobs.reduce((s,j)=>s+reservationForJob(j),0));assert.equal(ledger.jobs.filter(j=>j.state==="succeeded").length,9);assert.equal(ledger.enabled,false);
  await assert.rejects(executePlan(p,{ledger,apiKey:"synthetic",transport:()=>assert.fail("replayed")}));
});
test("followup refuses changed, uncertain or missing original audit before any dispatch",async()=>{
  for(const alter of [l=>l.jobs[0].state="unknown",l=>l.jobs[0].payloadHash="0".repeat(64),l=>l.jobs.pop(),l=>l.jobs.at(-1).reservationGbpMicros=1]){
    const p=followupPlan(),ledger=memoryLedger(p);alter(ledger);await assert.rejects(executePlan(p,{ledger,apiKey:"synthetic",transport:()=>assert.fail("unsafe dispatch")}));assert.equal(ledger.reserved,3413760);
  }
});
test("followup uncertain request remains charged and stops remaining work",async()=>{
  const p=followupPlan(),ledger=memoryLedger(p);let calls=0;
  await assert.rejects(executePlan(p,{ledger,apiKey:"synthetic",transport:async()=>{calls++;throw Error("uncertain");}}));
  assert.equal(calls,1);assert.equal(ledger.reserved,3413760+reservationForJob(p.jobs[0]));assert.equal(ledger.enabled,false);
});
test("followup response cannot exceed its tighter exact input bound",()=>{
  const job=followupPlan().jobs[0],r=response();r.usage.input_tokens=Buffer.byteLength(job.body)+4097;r.usage.total_tokens=r.usage.input_tokens+r.usage.output_tokens;
  assert.throws(()=>evidenceFromResponse(r,"synthetic",10,job));
});
test("changed manifest, missing authorization and expired authorization fail closed",()=>{
  const value=signed(plan);assert.throws(()=>validateManifest({...value,manifest:value.manifest.replace("preview","production")},publicKey));
  assert.throws(()=>validateManifest(signed({...plan,expires:Date.now()-1}),publicKey));
  assert.throws(()=>validateManifest(signed({...plan,expires:Date.now()+86400000}),publicKey));
  assert.throws(()=>validateManifest({...value,signature:""},publicKey));
});
test("signed but unpriced/extra/altered provider payloads cannot run",()=>{
  for(const patch of [{model:"other"},{service_tier:"priority"},{max_output_tokens:25000},{tools:[]},{store:true}]) {
    const p=structuredClone(plan);p.jobs[0].body=JSON.stringify({...JSON.parse(p.jobs[0].body),...patch});p.jobs[0].payloadHash=createHash("sha256").update(p.jobs[0].body).digest("hex");
    assert.throws(()=>validateManifest(signed(p),publicKey));
  }
});
test("runtime admits only existing project Preview and restricted isolated role",()=>{
  assert.ok(validateRuntime(env));
  for(const patch of [{VERCEL_ENV:"production"},{VERCEL_PROJECT_ID:"other"},{OPENAI_API_KEY:""},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL.replace(ROLE,"contentos_owner")},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL.replace("ep-proud-field-b291xbnc-pooler","production")},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL+"&host=production.invalid"},{BENCHMARK_DATABASE_URL:env.BENCHMARK_DATABASE_URL.replace("verify-full","disable")}]) assert.throws(()=>validateRuntime({...env,...patch}));
});
test("usage cost includes output and correctly discounts cached input without changing reservation",()=>{
  const e=evidenceFromResponse(response(),"not-a-key",100);assert.equal(e.costUsd,(50*1.75+50*0.175+200*14)/1000000);assert.equal(e.usage.cached_tokens,50);
  assert.equal(e.latencyMs,100);
});
test("incomplete, missing, unpriced or excessive usage is uncertain and cannot claim success",()=>{
  for(const patch of [{status:"incomplete"},{service_tier:"priority"},{usage:null},{usage:{input_tokens:1,output_tokens:25000,total_tokens:25001}},{usage:{input_tokens:1,output_tokens:2,total_tokens:4}}])assert.throws(()=>evidenceFromResponse({...response(),...patch},"key",1));
});
test("six calls reserve before dispatch and automatically close execution",async()=>{
  const ledger=memoryLedger();let calls=0;
  const result=await executePlan(plan,{ledger,apiKey:"synthetic",transport:async job=>{calls++;assert.equal(ledger.reserved,calls*RESERVATION);assert.equal(ledger.jobs.find(j=>j.id===job.id).state,"reserved");return response();}});
  assert.equal(result.succeeded,6);assert.equal(ledger.reserved,3413760);assert.equal(ledger.enabled,false);
  await assert.rejects(executePlan(plan,{ledger,apiKey:"synthetic",transport:()=>assert.fail("replayed")}));
});
test("uncertain provider outcome stops without refund/retry and closes campaign",async()=>{
  const ledger=memoryLedger();let calls=0;
  await assert.rejects(executePlan(plan,{ledger,apiKey:"synthetic",transport:async()=>{calls++;throw new Error("synthetic");}}));
  assert.equal(calls,1);assert.equal(ledger.reserved,RESERVATION);assert.equal(ledger.jobs[0].state,"unknown");assert.equal(ledger.enabled,false);
});
test("ambiguous admission commit never dispatches and is not refunded",async()=>{
  const ledger=memoryLedger(),reserve=ledger.reserve;ledger.reserve=async(...args)=>{await reserve(...args);throw new Error("lost acknowledgement");};
  await assert.rejects(executePlan(plan,{ledger,apiKey:"synthetic",transport:()=>assert.fail("must not dispatch")}));
  assert.equal(ledger.reserved,RESERVATION);assert.equal(ledger.enabled,false);
});
test("completion persistence failure leaves spent reservation and does not repeat provider",async()=>{
  const ledger=memoryLedger();let calls=0;ledger.finish=async()=>{throw new Error("synthetic database unavailable");};
  await assert.rejects(executePlan(plan,{ledger,apiKey:"synthetic",transport:async()=>{calls++;return response();}}));
  assert.equal(calls,1);assert.equal(ledger.jobs[0].state,"reserved");assert.equal(ledger.reserved,RESERVATION);assert.equal(ledger.enabled,false);
});
test("concurrent runner attempts cannot dispatch a logical job twice",async()=>{
  const ledger=memoryLedger();let calls=0;
  await Promise.allSettled([1,2].map(()=>executePlan(plan,{ledger,apiKey:"synthetic",transport:async()=>{calls++;await new Promise(r=>setTimeout(r,10));return response();}})));
  assert.equal(calls,1);assert.equal(ledger.reserved,RESERVATION);
});
test("transport uses fixed endpoint, one fetch, no redirects/retries and bounded output",async()=>{
  let calls=0;
  await assert.rejects(providerCall(plan.jobs[0],"synthetic",async(url,options)=>{calls++;assert.equal(url,"https://api.openai.com/v1/responses");assert.equal(options.redirect,"error");assert.equal(options.body,plan.jobs[0].body);return new Response("no",{status:500});}));
  assert.equal(calls,1);
});
