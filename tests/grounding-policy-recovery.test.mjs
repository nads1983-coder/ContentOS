import test from "node:test";
import assert from "node:assert/strict";
import {harness,input,receipt} from "./generation-test-helpers.mjs";
test("in-flight certificates from an older review policy cannot complete or trigger a paid continuation",async()=>{
 const h=harness(),req=input(),first=await h.post(req);
 assert.equal(first.response.status,202);const stored=h.data.generation_reservations_json[0];
 assert.equal(stored.pipeline.reviewPolicy,3);assert.ok(stored.pipeline.draft);
 stored.pipeline.reviewPolicy=2;
 const before=structuredClone(h.data),calls=h.calls.length;
 const resumed=await h.post(req,{stage:first.body.nextStage});
 assert.equal(resumed.response.status,409);assert.equal(resumed.body.code,"review_policy_changed");
 assert.deepEqual(h.data,before);assert.equal(h.calls.length,calls);assert.equal(h.data.generation_history_json,undefined);
 assert.match(resumed.body.error,/draft is preserved/);
});
test("a response arriving after the review policy changes cannot checkpoint an old admission",async()=>{
 const h=harness(),req=h.load("lib/generation-contract.ts").normalizeGenerationRequest(input());
 const admitted=await h.repository.beginTextGenerationStage("user-test",req.requestId,req,null);
 assert.equal(admitted.status,"dispatch");
 delete h.data.generation_reservations_json[0].pipeline.reviewPolicy;
 const before=structuredClone(h.data);
 await assert.rejects(h.repository.checkpointTextGenerationStage("user-test",req.requestId,admitted.fingerprint,admitted.stage,req,receipt(),1));
 assert.deepEqual(h.data,before);assert.equal(h.data.generation_history_json,undefined);
});
