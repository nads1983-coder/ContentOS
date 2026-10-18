import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {loadTs} from "./image-test-helpers.mjs";
import {validatePayload,reserveMicroGbp} from "../scripts/acceptance-continuation/runtime.mjs";
const dir=new URL("../docs/benchmarks/acceptance-continuation-rc717-2026-10-18/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,dir),"utf8"));
const audit=read("execution.json"),draft=read("raw-draft.json"),cache=new Map();
const contract=loadTs("lib/generation-contract.ts",{},cache),grounding=loadTs("lib/factual-grounding.ts",{},cache),batching=loadTs("lib/grounding-batches.ts",{},cache);
const request=contract.normalizeGenerationRequest(read("brief.json")),batch=batching.groundingBatch(draft,request,0,0),receipt=audit.jobs[0].evidence.outputText;
test("captured continuation contains no draft call and accounts for the immutable prior reservation",()=>{
 assert.equal(audit.providerCalls,2);assert.equal(audit.continuationCalls,1);assert.equal(audit.jobs[0].stage,"1:review:0:0");
 assert.equal(audit.reservedGbp*1e6,419173+validatePayload(JSON.stringify(audit.jobs[0].payload)).reserve);
 assert.equal(419173+14*reserveMicroGbp(56000,4800),3073643);assert.equal(audit.historyEntries,0);assert.equal(audit.usageEvents,0);
 assert.throws(()=>validatePayload(JSON.stringify({...audit.jobs[0].payload,max_output_tokens:24000})),/generation_forbidden/);
});
test("unchanged captured 48-decision response passes after the parenthetical quantity fix",()=>{
 const previous=JSON.parse(audit.jobs[0].payload.input),current=JSON.parse(batch.input);
 assert.deepEqual(current.originalSources,previous.originalSources);
 // Original statements/provenance are immutable; only the two physical-product
 // noun phrases lose the erroneous curriculum category under the current fix.
 const expectedSources=structuredClone(previous.sources);
 for(const id of ["s6","s12"]){const source=expectedSources.find(s=>s.id===id);assert.deepEqual(source.categories,["curriculum"]);source.categories=[];}
 assert.deepEqual(current.sources,expectedSources);
 assert.deepEqual(current.wholePack,previous.wholePack);assert.equal(batch.all.length,307);assert.equal(batch.units.length,48);
 const raw=JSON.parse(receipt);assert.equal(raw.decisions.length,48);assert.equal(batching.parseBatchReview(receipt,batch).decisions.length,48);
 const rejected=raw.decisions.filter(d=>{try{batching.parseBatchReview(JSON.stringify({decisions:[d]}),{...batch,units:[batch.units.find(u=>u.id===d.id)]});return false;}catch{return true;}});
 assert.deepEqual(rejected,[]);assert.deepEqual(raw.decisions.find(d=>d.id==="u47").sourceIds,["s7"]);
 assert.deepEqual(raw.decisions.filter(d=>d.kind==="unsupported").map(d=>d.id),["u32","u44"]);
 assert.equal(batch.units.find(u=>u.id==="u47").text.trim(),"The range includes 12 catalogue patterns (4 Arc, 8 Bond).");
 assert.equal(batch.context.sources.find(s=>s.id==="s7").text,"The new range has twelve catalogue patterns: four patterns belong to the Arc zip-cover range and eight belong to the Bond fixed-cover range.");
 assert.deepEqual(grounding.deterministicIssues("The range includes 12 catalogue patterns.",batch.context),[]);
 assert.deepEqual(grounding.deterministicIssues("The range includes 12 catalogue patterns (4 Arc, 8 Bond).",batch.context),[]);
});
test("consumed continuation refuses new preparation and execution before accessing private state",()=>{
 for(const mode of ["prepare","execute"]){const r=spawnSync(process.execPath,["scripts/acceptance-continuation/operator.mjs",mode],{encoding:"utf8",env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  assert.equal(r.status,1);assert.match(r.stderr,/acceptance_continuation_closed/);}
});
