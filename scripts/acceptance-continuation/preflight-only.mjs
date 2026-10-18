// Read-only calculator. No provider, credentials, database, deployment or ledger
// operations. Closed campaign execution remains closed.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reserveMicroGbp,validatePayload} from "./runtime.mjs";
import {loadTs} from "../../tests/image-test-helpers.mjs";
const base=new URL("../../docs/benchmarks/acceptance-continuation-rc717-2026-10-18/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,base),"utf8"));
const cache=new Map(),contract=loadTs("lib/generation-contract.ts",{},cache),batching=loadTs("lib/grounding-batches.ts",{},cache);
const pipeline=loadTs("lib/generation-pipeline.ts",{},cache),draft=read("raw-draft.json"),audit=read("execution.json"),request=contract.normalizeGenerationRequest(read("brief.json"));
const first=batching.groundingBatch(draft,request,0,0);
assert.equal(first.all.length,307);assert.equal(batching.parseBatchReview(audit.jobs[0].evidence.outputText,first).decisions.length,48);
const initial=[];
for(let batch=1;batch<first.count;batch++){
 const p={...pipeline.newGenerationPipeline(),phase:"review",draft,batch};
 const payload=JSON.stringify(pipeline.pipelinePayload(p,request)),check=validatePayload(payload);
 initial.push({batch,bytes:check.bytes,reserveMicroGbp:check.reserve});
}
const futureCalls=initial.length+7,perCall=reserveMicroGbp(56000,4800),retained=Math.round(audit.reservedGbp*1e6);
assert.equal(futureCalls,13);assert.equal(retained,605550);
assert.ok(futureCalls*perCall<=2470000);assert.ok(retained+futureCalls*perCall<=3080000);
console.log(JSON.stringify({mode:"proposal_only_not_execution_authorization",paidCalls:0,draftUnits:307,formats:14,
 capturedDecisionsReusable:48,initialReviewCalls:6,possibleFreshReviewCalls:7,maximumNewCalls:13,priorCalls:audit.providerCalls,
 maximumCombinedCalls:audit.providerCalls+futureCalls,initialPayloads:initial,payloadByteCap:56000,inputTokenBound:60096,outputTokenCap:4800,
 inputUsdPerMillion:1.75,outputUsdPerMillion:14,cachedDiscountAssumed:false,gbpPerUsdBound:1.10,
 perCallReservationMicroGbp:perCall,maximumNewReservationGbp:futureCalls*perCall/1e6,priorReservationGbp:retained/1e6,
 maximumCombinedReservationGbp:(retained+futureCalls*perCall)/1e6,proposedNewAuthorizationGbp:2.47,combinedCeilingGbp:3.08,
 restrictions:["Fresh restricted ledger linked to BOTH immutable prior spending records; never reset or reopen old campaigns.",
 "No generation and no repeat of the captured first review. Revalidate saved evidence before reuse.",
 "Corrected payloads are unknown: each must independently fit 56000 bytes and at most 336 units before dispatch, with no truncation.",
 "Reverify model pricing and currency before an approved run. Reserve before dispatch; uncertain/failed attempts consume their full reservation; no automatic retries.",
 "Existing key only inside protected Preview, isolated restricted role, no customer data, authenticated operator, automatic disable and cleanup."]},null,2));
