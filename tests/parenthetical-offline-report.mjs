import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {draft,request,hash,seedCapturedDraft,parentheticalResponse,mockRepairs} from "./parenthetical-capture-helpers.mjs";
const h=harness(),req={...request,requestId:requestId(309)},coverage={},stages=[];
h.data=seedCapturedDraft(h.data,req,h.now);
const start=performance.now();
h.provider=payload=>{
 const input=JSON.parse(payload.input),t=performance.now(),response=parentheticalResponse(payload);
 (coverage[input.pass]??=[]).push(...input.units.map(u=>u.id));
 stages.push({pass:input.pass,units:input.units.length,inputBytes:Buffer.byteLength(JSON.stringify(payload)),offlineMockMs:performance.now()-t});
 return response;
};
const done=await h.finish(req);
assert.equal(done.response.status,200);assert.equal(done.body.sections.length,14);
for(const units of Object.values(coverage)){assert.equal(units.length,307);assert.equal(new Set(units).size,307);}
const replay=await h.post(req);assert.equal(replay.response.status,200);assert.equal(h.calls.length,14);
assert.equal(h.data.usage_events_json.length,1);assert.equal(h.data.generation_history_json.length,1);
const dir="docs/benchmarks/acceptance-continuation-rc717-2026-10-18/";
const hashes=Object.fromEntries(["execution.json","raw-draft.json","brief.json","origin-integrity.json"].map(name=>
 [name,createHash("sha256").update(readFileSync(dir+name)).digest("hex")]));
const report={recordedAt:new Date().toISOString(),mode:"OFFLINE: captured first review plus explicitly mocked subsequent reviews",
 paidCalls:0,newSpendGbp:0,draftGenerationCalls:0,originalFileHashes:hashes,draftHash:hash(draft),formats:14,
 originalCertificates:48,originalCertificatesAccepted:48,capturedUnsupportedUnits:["u32","u44"],additionalOfflineRepairUnits:Object.keys(mockRepairs),
 initialReviewUnits:coverage.initial_review.length,freshRevalidationUnits:coverage.fresh_final_revalidation.length,
 replayedReviewReceipts:1,mockedReviewReceipts:13,correctionStages:1,historyEntries:1,successfulUsageEvents:1,
 duplicateSaveAddedEntries:0,offlineElapsedMs:performance.now()-start,stages,
 limitations:["Mechanical semantic decisions demonstrate orchestration only, not live AI reliability or final editorial acceptance.",
 "Synthetic reservation timestamps are rebased for offline fixtures. Closed live campaigns and their spending ledgers are not reopened.",
 "The original two unsupported decisions plus six additional conservative guard rejections are corrected in this offline scenario; a live reviewer may return different judgments."]};
writeFileSync(process.argv[2]??"/tmp/contentos-parenthetical-offline.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:"PASS",initialUnits:307,freshUnits:307,historyEntries:1,usageEvents:1,paidCalls:0}));
