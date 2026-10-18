import assert from "node:assert/strict";
import test from "node:test";
import {harness,input,output} from "./generation-test-helpers.mjs";

test("paused and malformed server modes refuse direct generation before body, storage or paid work", async()=>{
 for(const textGenerationMode of ["paused","PAUSED","false",""]){
  const h=harness({textGenerationMode}),before=structuredClone(h.data);
  const r=await h.post(input(),{rawBody:"{"});
  assert.equal(r.response.status,503);assert.equal(r.body.code,"text_generation_paused");
  assert.equal(r.response.headers.get("cache-control"),"no-store");assert.equal(r.bodyRead,false);
  assert.equal(h.calls.length,0);assert.deepEqual(h.data,before);
 }
});
test("pause preserves authentication, origin and account-binding checks",async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{unsafe:true},403]]){
  const h=harness({...options,textGenerationMode:"paused"});
  assert.equal((await h.post()).response.status,status);assert.equal(h.calls.length,0);
 }
 const h=harness({textGenerationMode:"paused"});
 assert.equal((await h.post(input(),{account:"other-user"})).response.status,409);
});
test("pause preserves an interrupted draft and blocks resume without usage or another provider call",async()=>{
 const h=harness(),first=await h.post(),before=structuredClone(h.data);
 h.setTextGenerationMode("paused");
 const r=await h.post(input(),{stage:first.body.nextStage});
 assert.equal(r.body.code,"text_generation_paused");assert.deepEqual(h.data,before);
 assert.equal(h.calls.length,1);assert.equal(h.data.usage_events_json,undefined);
 assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
});
test("explicit enabled mode retains complete review and exactly-once delivery",async()=>{
 const h=harness({textGenerationMode:"enabled"});
 assert.equal((await h.finish()).response.status,200);
 assert.equal((await h.finish()).response.status,200);
 assert.equal(h.calls.length,2);assert.equal(h.data.usage_events_json.length,1);
});
test("pilot admission is authenticated-account scoped, empty or forged admission cannot spend",async()=>{
 for(const pilotAccounts of [undefined,"","other-user"]){
  const h=harness({textGenerationMode:"pilot",pilotAccounts}),before=structuredClone(h.data);
  assert.equal((await h.post()).body.code,"text_generation_paused");
  assert.equal(h.calls.length,0);assert.deepEqual(h.data,before);
 }
 const h=harness({textGenerationMode:"pilot",pilotAccounts:" user-test "});
 assert.equal((await h.finish()).response.status,200);
 assert.equal(h.data.usage_events_json.length,1);
 h.userId="other-user";
 assert.equal((await h.post(input(),{account:"user-test"})).body.code,"account_changed");
 assert.equal((await h.post()).body.code,"text_generation_paused");assert.equal(h.calls.length,2);
 assert.equal(h.rows.get("other-user").generation_reservations_json,undefined);
});
test("pilot refinement uses the same grounded stages and authenticated usage accounting",async()=>{
 const h=harness({textGenerationMode:"pilot",pilotAccounts:"user-test"});
 const result=await h.finish(input({refinement:{action:"shorten",section:output().sections[0]}}));
 assert.equal(result.response.status,200);assert.equal(result.body.sections.length,1);
 assert.equal(h.calls.length,2);assert.equal(h.data.usage_events_json.length,1);
 assert.ok(h.calls[0].input.includes("shorten"));
 assert.equal(h.data.generation_reservations_json[0].pipelineAudit.reviewedUnits>0,true);
});
