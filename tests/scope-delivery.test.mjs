import test from "node:test";
import assert from "node:assert/strict";
import {harness,requestId} from "./generation-test-helpers.mjs";
import {grounding as g,batches} from "./grounding-capture-helpers.mjs";
import {request,draft,findings,repairs,live,scopeResponse} from "./scope-capture-helpers.mjs";
const ctx=g.buildGroundingContext(request),units=g.groundingUnits(draft);
const approved=(u,kind)=>JSON.stringify({decisions:[{id:u.id,kind,references:ctx.sources.slice(0,12).map(s=>({sourceId:s.id,quote:s.text})),reason:"none",replacement:null}]});
test("all ten independently captured layout findings refuse counterfeit approval in every classification",()=>{
 assert.equal(findings.length,10);
 for(const f of findings){
  const affected=units.filter(u=>u.path===f.path&&(u.text.includes(f.quote)||f.quote.includes(u.text.trim())));
  assert.ok(affected.length,f.id);
  assert.ok(affected.some(u=>g.deterministicIssues(u,ctx).includes("missing_evidence")),f.id);
  for(const u of affected.filter(u=>g.deterministicIssues(u,ctx).length)){
   for(const kind of ["supported","creative","subjective","structural"])assert.throws(()=>g.parseGroundingReview(approved(u,kind),[u],ctx),g.GroundingError,`${f.id}/${kind}`);
   assert.ok(repairs.some(r=>r.id===u.id),u.id);
  }
 }
});
test("original captured false approvals and page-level replacements fail, without rewriting evidence",()=>{
 assert.throws(()=>batches.parseBatchReview(live.jobs[1].evidence.outputText,batches.groundingBatch(draft,request,0,0)),g.GroundingError);
 const review=JSON.parse(live.jobs[2].evidence.outputText),bad=review.decisions.find(d=>d.id==="u51");
 assert.match(bad.replacement,/A5 page with three printed headings/);
 const corrected=g.repairGrounding(draft,units,{decisions:repairs.map(r=>({id:r.id,kind:"unsupported",references:[],reason:"missing_evidence",replacement:r.replacement}))},request);
 const cleanUnits=g.groundingUnits(corrected);
 assert.ok(cleanUnits.every(u=>!g.deterministicIssues(u,ctx).length));
 const target=cleanUnits.find(u=>u.path==="sections.2.body"&&u.text.startsWith("Fieldline is an A5 notebook"));
 // The sole bad replacement must fail even after every other defect is removed.
 assert.throws(()=>g.repairGrounding(corrected,cleanUnits,{decisions:[{id:target.id,kind:"unsupported",references:[],reason:"missing_evidence",replacement:bad.replacement}]},request),g.GroundingError);
});
test("last captured pack completes exhaustive offline correction, fresh revalidation, recovery and one save",async()=>{
 const h=harness({profile:{plan:"founder",entitlement_source:"founder_offer",amount_paid:0,subscription_status:"active",savedDraft:"Retained prior draft"}}),req={...request,requestId:requestId()};
 const coverage={initial_review:new Set(),fresh_final_revalidation:new Set()};
 h.provider=payload=>{if(payload.text.format.name!=="social_content_generation"){
  const data=JSON.parse(payload.input);for(const u of data.units){assert.ok(!coverage[data.pass].has(u.id));coverage[data.pass].add(u.id);}
  assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);
 }return scopeResponse(payload);};
 const a=await h.post(req),b=await h.post(req,{stage:a.body.nextStage});assert.equal(b.body.reviewedUnits,48);
 const replay=await h.post(req,{stage:a.body.nextStage,instance:h.instance()});assert.equal(h.calls.length,2);
 const done=await h.finish(req,replay.body.nextStage);assert.equal(done.response.status,200,JSON.stringify(done.body));
 assert.equal(done.body.sections.length,14);assert.equal(coverage.initial_review.size,262);
 assert.equal(coverage.fresh_final_revalidation.size,g.groundingUnits(done.body).length);
 assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
 assert.equal(h.data.savedDraft,"Retained prior draft");assert.equal(h.data.entitlement_source,"founder_offer");
 for(const f of findings)assert.ok(!f.path.split(".").reduce((v,k)=>v[k],done.body).includes(f.quote),f.id);
 assert.ok(!JSON.stringify(done.body).includes("Optional imaginary square example for each heading"));
 assert.ok(done.body.sections.every(s=>s.cta===""));
 const calls=h.calls.length;await h.post(req);assert.equal(h.calls.length,calls);assert.equal(h.data.usage_events_json.length,1);
});
test("one unapproved final unit prevents the complete pack from saving or charging",async()=>{
 const h=harness();let changed=false;
 h.provider=p=>scopeResponse(p,{change(d,data){if(data.pass==="fresh_final_revalidation"&&!changed){changed=true;d[0]={id:d[0].id,kind:"unsupported",sourceIds:[],reason:"missing_evidence",replacement:"No further correction authorized."};}}});
 const done=await h.finish({...request,requestId:requestId()});assert.equal(done.response.status,502);assert.equal(done.body.code,"grounding_failed");
 assert.equal(h.data.generation_history_json,undefined);assert.equal(h.data.usage_events_json,undefined);assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
});
