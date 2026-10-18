import test from "node:test";
import assert from "node:assert/strict";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {draft,request,hash,seedCapturedDraft,parentheticalResponse} from "./parenthetical-capture-helpers.mjs";

test("preserved 307-unit draft completes correction, exhaustive mock revalidation and exactly-once route delivery",async()=>{
 const h=harness(),req={...request,requestId:requestId(307)},before=hash(draft),coverage={};
 h.data=seedCapturedDraft(h.data,req,h.now);
 assert.equal(hash(h.data.generation_reservations_json[0].pipeline.draft),before);
 h.provider=payload=>{const data=JSON.parse(payload.input);(coverage[data.pass]??=[]).push(...data.units.map(u=>u.id));return parentheticalResponse(payload);};
 const done=await h.finish(req);
 assert.equal(done.response.status,200,JSON.stringify(done.body));
 assert.equal(done.body.sections.length,14);assert.equal(h.calls.length,14);
 assert.equal(coverage.initial_review.length,307);assert.equal(new Set(coverage.initial_review).size,307);
 assert.equal(coverage.fresh_final_revalidation.length,307);assert.equal(new Set(coverage.fresh_final_revalidation).size,307);
 const saved=h.data.generation_reservations_json[0];
 assert.equal(saved.pipelineAudit.metrics.filter(m=>m.kind==="correction").length,1);
 assert.equal(saved.pipelineAudit.metrics.filter(m=>m.kind==="revalidation").length,7);
 assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
 assert.match(done.body.sections[1].body,/designed as a small change of texture around an existing cushion/);
 assert.match(done.body.sections[1].body,/practical care distinction: removable outer cover vs fixed outer cover/);
 assert.match(done.body.sections[1].body,/12 catalogue patterns \(4 Arc, 8 Bond\)/);
 assert.equal(hash(draft),before);
 const again=await h.post(req);assert.equal(again.response.status,200);assert.equal(h.calls.length,14);
 assert.equal(h.data.usage_events_json.length,1);assert.equal(h.data.generation_history_json.length,1);
});

test("omitted fresh-review decision fails closed and preserves the draft without successful usage",async()=>{
 const h=harness(),req={...request,requestId:requestId(308)};
 h.data=seedCapturedDraft(h.data,req,h.now);
 h.provider=payload=>{
  const response=parentheticalResponse(payload),input=JSON.parse(payload.input);
  if(input.pass==="fresh_final_revalidation"){
   const parsed=JSON.parse(response.output_text);parsed.decisions.pop();response.output_text=JSON.stringify(parsed);
  }
  return response;
 };
 const done=await h.finish(req);
 assert.notEqual(done.response.status,200);assert.equal(done.body.code,"grounding_failed");
 assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
 assert.equal(h.calls.length,8);
});

test("a replacement with swapped quantities is rejected before fresh review or persistence",async()=>{
 const h=harness(),req={...request,requestId:requestId(310)};
 h.data=seedCapturedDraft(h.data,req,h.now);
 h.provider=payload=>{
  const response=parentheticalResponse(payload),input=JSON.parse(payload.input);
  if(input.pass==="initial_review"&&input.units[0].id==="u0"){
   const parsed=JSON.parse(response.output_text);
   const decision=parsed.decisions.find(d=>d.id==="u47");
   Object.assign(decision,{kind:"unsupported",reason:"missing_evidence",sourceIds:[],
    replacement:"The range includes 12 catalogue patterns (8 Arc, 4 Bond)."});
   response.output_text=JSON.stringify(parsed);
  }
  return response;
 };
 const done=await h.finish(req);
 assert.notEqual(done.response.status,200);assert.equal(done.body.code,"grounding_failed");
 assert.equal(h.calls.length,7);assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 assert.match(h.data.generation_reservations_json[0].pipeline.draft.sections[1].body,/12 catalogue patterns \(4 Arc, 8 Bond\)/);
});
