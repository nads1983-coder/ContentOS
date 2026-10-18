import {writeFileSync} from "node:fs";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {captured,captureResponse,grounding} from "./grounding-capture-helpers.mjs";
import * as classification from "./classification-capture-helpers.mjs";
import * as scope from "./scope-capture-helpers.mjs";
import {evaluateIndependentScope} from "./independent-scope-evaluation.mjs";
const packs=[...captured.map(p=>({...p,respond:x=>captureResponse(p,x)})),
 {id:"ShelfNotes",...classification,result:classification.draft,respond:classification.classificationResponse},
 {id:"Fieldline",...scope,result:scope.draft,respond:scope.scopeResponse}];
const results=[];
for(const pack of packs){
 const h=harness(),req={...pack.request,requestId:requestId()},metrics=[];
 const coverage={initial_review:new Set(),fresh_final_revalidation:new Set()};
 h.provider=p=>{
  const data=p.text.format.name==="social_content_generation"?null:JSON.parse(p.input);
  if(data)for(const u of data.units)coverage[data.pass].add(u.id);
  metrics.push({phase:data?.pass??"draft",units:data?.units.length??0,payloadBytes:Buffer.byteLength(JSON.stringify(p))});
  return pack.respond(p);
 };
 const start=performance.now(),done=await h.finish(req),elapsed=performance.now()-start;
 const r=h.data.generation_reservations_json[0];
 results.push({id:pack.id,status:done.response.status,code:done.body.code??null,originalUnits:grounding.groundingUnits(pack.result).length,
  finalUnits:done.response.status===200?grounding.groundingUnits(done.body).length:null,
  initialReviewed:coverage.initial_review.size,freshReviewed:coverage.fresh_final_revalidation.size,
  formatsDelivered:done.body.sections?.length??0,mockCalls:h.calls.length,offlineExecutionMs:elapsed,
  maxPayloadBytes:Math.max(...metrics.map(m=>m.payloadBytes)),metrics,
  conservativeApplicationReserveMicroUsd:r.pipelineAudit?.reservedMicroUsd??r.pipeline?.reservedMicroUsd,
  historyEntries:h.data.generation_history_json?.length??0,usageEvents:h.data.usage_events_json?.length??0});
}
const report={recordedAt:new Date().toISOString(),paidCalls:0,actualApiSpend:0,results,independent:evaluateIndependentScope(),
 limitations:["Provider responses and semantic corrections are scripted fixtures; no live-model reliability or latency is established.","Historical captures and original assessments are unchanged. Structural recertification and corrected pack judgments are test-only.","Offline runtime measures local execution, not live service latency. Reservations are bounds using existing application tariff, not actual cost or a new spending authorization."]};
const target=process.argv.find(a=>a.startsWith("--report="))?.slice(9);
if(target)writeFileSync(target,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(results.some(r=>r.status!==200))process.exitCode=1;
