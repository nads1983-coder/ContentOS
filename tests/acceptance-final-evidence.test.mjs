// Immutable failed-run evidence replayed against the corrected current parser.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadTs} from "./image-test-helpers.mjs";
const base=new URL("../docs/benchmarks/acceptance-final-a7cd-2026-10-18/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(`${name}.json`,base),"utf8"));
const audit=read("execution"),draft=read("raw-draft"),cache=new Map();
const request=loadTs("lib/generation-contract.ts",{},cache).normalizeGenerationRequest(read("brief"));
const batches=loadTs("lib/grounding-batches.ts",{},cache),grounding=loadTs("lib/factual-grounding.ts",{},cache);
const raw=JSON.parse(audit.jobs[0].evidence.outputText),batch=batches.groundingBatch(draft,request,1,0);
test("captured new batch now accepts all 48 original certificates without changing historical failure evidence",()=>{
 assert.equal(raw.decisions.length,48);assert.equal(batches.parseBatchReview(audit.jobs[0].evidence.outputText,batch).decisions.length,48);
 const refused=[];
 for(const decision of raw.decisions){const unit=batch.units.find(u=>u.id===decision.id);
  try{batches.parseBatchReview(JSON.stringify({decisions:[decision]}),{...batch,units:[unit]});}catch{refused.push(decision.id);}}
 assert.deepEqual(refused,[]);
 assert.deepEqual(audit.coverage[1].individualRejections.map(d=>d.id),["u49","u68"]);
 for(const id of ["u49","u68"])assert.deepEqual(grounding.deterministicIssues(batch.units.find(u=>u.id===id),batch.context),[]);
});
test("legitimate ordinal and product-noun variants no longer require diagnostic edits",()=>{
 const changed=structuredClone(draft);
 changed.sections[1].items[0]=changed.sections[1].items[0].replace("Hashtags set 1: ","");
 changed.sections[3].body=changed.sections[3].body.replace("Choosing a cushion cover starts with care, not colour.","Choosing a textile starts with care, not colour.");
 const diagnostic=batches.groundingBatch(changed,request,1,0);
 for(const id of ["u49","u68"]){const unit=diagnostic.units.find(u=>u.id===id),decision=raw.decisions.find(d=>d.id===id);
  assert.doesNotThrow(()=>batches.parseBatchReview(JSON.stringify({decisions:[decision]}),{...diagnostic,units:[unit]}));}
 assert.deepEqual(grounding.claimCategories("Choosing a cushion cover starts with care, not colour."),[]);
 assert.deepEqual(grounding.claimCategories("Choosing a textile starts with care, not colour."),[]);
});
test("failed live batch did not correct, revalidate, deliver or charge successful usage; cleanup and reservations retained",()=>{
 assert.equal(audit.outcome.status,"blocked");assert.equal(audit.outcome.reason,"validation_failed");
 assert.equal(audit.continuationCalls,1);assert.equal(audit.providerCalls,3);
 assert.equal(audit.newReservedGbp,.186958);assert.equal(audit.reservedGbp,.792508);
 assert.equal(audit.acceptedInitialUnits,48);assert.equal(audit.acceptedFinalUnits,0);
 assert.equal(audit.historyEntries,0);assert.equal(audit.usageEvents,0);assert.deepEqual(audit.corrections,[]);
 assert.equal(audit.draftPreserved,true);assert.equal(audit.actualCostComplete,true);
 assert.equal(audit.cleanup.safeToEraseRecovery,true);assert.equal(audit.cleanup.deletedDeploymentIds.length,1);
 assert.ok(Object.values(audit.cleanup.database).every(Boolean));assert.equal(audit.protection.protected,true);
});
