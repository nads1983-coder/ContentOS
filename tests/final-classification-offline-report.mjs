import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {draft,request,hash,seedCapturedDraft,finalClassificationResponse} from "./final-classification-capture-helpers.mjs";
const h=harness(),req={...request,requestId:requestId(309)},coverage={},stages=[];
h.data=seedCapturedDraft(h.data,req,h.now);
const start=performance.now();
h.provider=payload=>{
 const input=JSON.parse(payload.input),t=performance.now(),response=finalClassificationResponse(payload);
 (coverage[input.pass]??=[]).push(...input.units.map(u=>u.id));
 stages.push({pass:input.pass,units:input.units.length,inputBytes:Buffer.byteLength(JSON.stringify(payload)),offlineMockMs:performance.now()-t});
 return response;
};
const done=await h.finish(req);
assert.equal(done.response.status,200);assert.equal(done.body.sections.length,14);
for(const units of Object.values(coverage)){assert.equal(units.length,307);assert.equal(new Set(units).size,307);}
const replay=await h.post(req);assert.equal(replay.response.status,200);assert.equal(h.calls.length,14);
assert.equal(h.data.usage_events_json.length,1);assert.equal(h.data.generation_history_json.length,1);
const hashes=Object.fromEntries(["acceptance-continuation-rc717-2026-10-18","acceptance-final-a7cd-2026-10-18"].flatMap(dir=>
 ["execution.json","raw-draft.json","brief.json"].map(name=>
 [`${dir}/${name}`,createHash("sha256").update(readFileSync(`docs/benchmarks/${dir}/${name}`)).digest("hex")])));
const report={recordedAt:new Date().toISOString(),mode:"OFFLINE: two captured reviews plus explicitly mocked subsequent reviews",
 paidCalls:0,newSpendGbp:0,draftGenerationCalls:0,originalFileHashes:hashes,draftHash:hash(draft),formats:14,
 originalCertificates:96,originalCertificatesAccepted:96,capturedUnsupportedUnits:["u32","u44","u50","u51","u58","u87"],additionalOfflineRepairUnits:["u117","u121","u128","u200","u256"],
 initialReviewUnits:coverage.initial_review.length,freshRevalidationUnits:coverage.fresh_final_revalidation.length,
 replayedReviewReceipts:2,mockedReviewReceipts:12,correctionStages:1,historyEntries:1,successfulUsageEvents:1,
 duplicateSaveAddedEntries:0,offlineElapsedMs:performance.now()-start,stages,
 limitations:["Mechanical semantic decisions demonstrate orchestration only, not live AI reliability or final editorial acceptance.",
 "Synthetic reservation timestamps are rebased for offline fixtures. Closed live campaigns and their spending ledgers are not reopened.",
 "The original six unsupported decisions plus five additional conservative guard rejections are corrected in this offline scenario; a live reviewer may return different judgments."]};
writeFileSync(process.argv[2]??"/tmp/contentos-final-classification-offline.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:"PASS",initialUnits:307,freshUnits:307,historyEntries:1,usageEvents:1,paidCalls:0}));
