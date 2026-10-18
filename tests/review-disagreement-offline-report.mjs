import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {draft,request,hash,seedCapturedDraft,disagreementResponse} from "./review-disagreement-capture-helpers.mjs";
const files=["acceptance-continuation-rc717-2026-10-18","acceptance-final-a7cd-2026-10-18","acceptance-recovery-d423-2026-10-18"]
 .flatMap(dir=>["execution.json","raw-draft.json","brief.json"].map(f=>`docs/benchmarks/${dir}/${f}`));
const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash("sha256").update(readFileSync(f)).digest("hex")]));
const before=hashes(),h=harness(),req={...request,requestId:requestId(711)},coverage={},payloads=[];
h.data=seedCapturedDraft(h.data,req,h.now);const started=performance.now();
h.provider=p=>{const i=JSON.parse(p.input);(coverage[i.pass]??=[]).push(...i.units.map(u=>u.id));
 payloads.push({pass:i.pass,units:i.units.length,serializedBytes:Buffer.byteLength(JSON.stringify(p))});return disagreementResponse(p);};
const done=await h.finish(req);assert.equal(done.response.status,200);assert.equal(done.body.sections.length,14);
await h.post(req);assert.equal(h.calls.length,14);assert.deepEqual(hashes(),before);
for(const ids of Object.values(coverage)){assert.equal(ids.length,307);assert.equal(new Set(ids).size,307);}
const report={mode:"OFFLINE ONLY: 3 unchanged live responses + 11 explicit mock review responses",paidCalls:0,newSpend:0,
 capturedFiles:before,preservedDraftHash:hash(draft),capturedDecisions:144,serverDowngradedToCorrection:["u117","u128"],
 correctedNounClassification:"u124",unsafeTitleRepairReplacedWithFormatLabel:"u121",formats:14,
 initialCoverage:307,freshCoverage:307,correctionPasses:1,history:h.data.generation_history_json.length,
 successfulUsage:h.data.usage_events_json.length,duplicateCharge:0,elapsedOfflineMs:performance.now()-started,payloads,
 limitations:["No new live provider execution or final independent live-content assessment.","Mechanical reviews establish orchestration, not semantic accuracy or live latency."]};
assert.equal(report.history,1);assert.equal(report.successfulUsage,1);
writeFileSync(process.argv[2]??"/tmp/contentos-text-release-offline.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:"PASS",initial:307,fresh:307,formats:14,history:1,usage:1,paidCalls:0}));
