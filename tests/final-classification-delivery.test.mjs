import test from "node:test";
import assert from "node:assert/strict";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {draft,request,hash,seedCapturedDraft,finalClassificationResponse} from "./final-classification-capture-helpers.mjs";
test("both real captured reviews plus explicit mocks complete all 307 units, correction and exactly-once delivery",async()=>{
 const h=harness(),req={...request,requestId:requestId(611)},before=hash(draft),coverage={},unsupported=[];
 h.data=seedCapturedDraft(h.data,req,h.now);
 h.provider=payload=>{const input=JSON.parse(payload.input),response=finalClassificationResponse(payload);
  (coverage[input.pass]??=[]).push(...input.units.map(u=>u.id));
  if(input.pass==="initial_review")unsupported.push(...JSON.parse(response.output_text).decisions.filter(d=>d.kind==="unsupported").map(d=>d.id));
  return response;};
 const done=await h.finish(req);assert.equal(done.response.status,200,JSON.stringify(done.body));
 assert.equal(done.body.sections.length,14);assert.equal(h.calls.length,14);
 for(const pass of ["initial_review","fresh_final_revalidation"]){assert.equal(coverage[pass].length,307);assert.equal(new Set(coverage[pass]).size,307);}
 for(const id of ["u32","u44","u50","u51","u58","u87"])assert.ok(unsupported.includes(id));
 const metrics=h.data.generation_reservations_json[0].pipelineAudit.metrics;
 assert.equal(metrics.filter(m=>m.kind==="correction").length,1);assert.equal(metrics.filter(m=>m.kind==="revalidation").length,7);
 assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
 assert.match(done.body.sections[2].body,/Arc: removable outer cover with a zip, machine wash at 30/);
 assert.match(done.body.sections[4].body,/range designed to keep the decision practical/);
 const again=await h.post(req);assert.equal(again.response.status,200);assert.equal(h.calls.length,14);
 assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);assert.equal(hash(draft),before);
});
test("unresolved claim in fresh review of the corrected pack blocks final save",async()=>{
 const h=harness(),req={...request,requestId:requestId(612)};h.data=seedCapturedDraft(h.data,req,h.now);
 h.provider=payload=>{const response=finalClassificationResponse(payload),input=JSON.parse(payload.input);
  if(input.pass==="fresh_final_revalidation"&&input.units[0].id==="u0"){
   const raw=JSON.parse(response.output_text);Object.assign(raw.decisions[0],{kind:"unsupported",reason:"missing_evidence",sourceIds:[],replacement:"Neutral topic"});
   response.output_text=JSON.stringify(raw);
  }return response;};
 const done=await h.finish(req);assert.notEqual(done.response.status,200);assert.equal(done.body.code,"grounding_failed");
 assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 assert.ok(h.data.generation_reservations_json[0].pipeline.draft);assert.equal(h.calls.length,14);
});
