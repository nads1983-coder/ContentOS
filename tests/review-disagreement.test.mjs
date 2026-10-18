import test from "node:test";
import assert from "node:assert/strict";
import {grounding,batches} from "./grounding-capture-helpers.mjs";
import {draft,request,thirdReview,hash,seedCapturedDraft,disagreementResponse} from "./review-disagreement-capture-helpers.mjs";
import {harness,requestId} from "./generation-test-helpers.mjs";
const batch=()=>batches.groundingBatch(draft,request,2,0);

test("captured third response processes all 48 units without approving the two disputed factual claims",()=>{
 const before=hash(thirdReview),r=batches.parseBatchReview(thirdReview,batch());
 assert.equal(r.decisions.length,48);
 assert.deepEqual(r.decisions.filter(d=>d.kind==="unsupported").map(d=>d.id),["u98","u117","u121","u128"]);
 assert.equal(r.decisions.find(d=>d.id==="u124").kind,"creative");
 assert.match(r.decisions.find(d=>d.id==="u117").replacement,/^6\/ .*including postage within the fictional country/);
 assert.equal(r.decisions.find(d=>d.id==="u128").replacement,batch().context.sources.find(s=>s.id==="s7").text);
 assert.equal(hash(thirdReview),before);
});
test("same disputed final certificates still fail; no second automatic correction",()=>{
 assert.throws(()=>batches.parseBatchReview(thirdReview,batches.groundingBatch(draft,request,2,1)));
});
test("malformed evidence, forged labels and incomplete coverage cannot enter safe correction",()=>{
 for(const change of [r=>r.decisions[21].sourceIds=["invented"],r=>r.decisions[21].sourceIds=[],
  r=>r.decisions[21].replacement="unrequested rewrite",r=>r.decisions.pop(),r=>r.decisions[0]=r.decisions[1]]){
  const r=JSON.parse(thirdReview);change(r);assert.throws(()=>batches.parseBatchReview(JSON.stringify(r),batch()));
 }
 const b=batch();b.units[21].annotations=[[0,b.units[21].text.length]];
 assert.equal(batches.parseBatchReview(thirdReview,b).decisions.find(d=>d.id==="u117").kind,"unsupported");
 assert.throws(()=>batches.parseBatchReview(thirdReview,{...b,pass:1}));
});
test("initial fallback cannot use truncated quotes, conflicting brand evidence or prohibited CTA",()=>{
 const u={id:"u",path:"body",text:"Our workshop guarantees 90% more income.",start:0,end:45};
 for(const source of [{id:"s",origin:"brand",field:"offer",text:"Our workshop covers planning.",categories:[]},
  {id:"s",origin:"brief",field:"source",text:"Buy now.",categories:[]}]){
  const c={sources:[source],noCta:true,instructions:[]},d={id:"u",kind:"supported",reason:"none",replacement:null,references:[{sourceId:"s",quote:source.text}]};
  assert.throws(()=>grounding.parseGroundingReview(JSON.stringify({decisions:[d]}),[u],c,true));
 }
 const source={id:"s",origin:"brief",field:"source",text:"Our workshop covers planning, not pricing.",categories:[]};
 assert.throws(()=>grounding.parseGroundingReview(JSON.stringify({decisions:[{id:"u",kind:"supported",reason:"none",replacement:null,references:[{sourceId:"s",quote:"Our workshop covers planning"}]}]}),[u],{sources:[source],noCta:true,instructions:[]},true));
});
test("compound physical nouns do not exempt curriculum, numerical or capability claims",()=>{
 for(const text of ["Before you pick a cushion cover pattern, pick your care routine.","A duvet cover design feels cosy."]){
  assert.deepEqual(grounding.claimCategories(text),[]);
 }
 for(const text of ["Our course covers patterns.","Our workshop on cushion cover patterns teaches pricing.","A cushion cover pattern guarantees results.","Cushion cover ranges include 10 free lessons."]){
  assert.ok(grounding.claimCategories(text).length>0,text);
 }
});
test("three unchanged live captures plus explicit mocks deliver 14 formats with exhaustive fresh review and one charge",async()=>{
 const h=harness(),req={...request,requestId:requestId(701)},coverage={};h.data=seedCapturedDraft(h.data,req,h.now);
 h.provider=p=>{const i=JSON.parse(p.input);(coverage[i.pass]??=[]).push(...i.units.map(u=>u.id));return disagreementResponse(p);};
 const done=await h.finish(req);assert.equal(done.response.status,200,JSON.stringify(done.body));
 assert.equal(done.body.sections.length,14);
 for(const ids of Object.values(coverage)){assert.equal(ids.length,307);assert.equal(new Set(ids).size,307);}
 assert.equal(h.data.generation_reservations_json[0].pipelineAudit.metrics.filter(m=>m.kind==="correction").length,1);
 assert.equal(h.calls.length,14);await h.post(req);assert.equal(h.calls.length,14);
 assert.equal(h.data.generation_history_json.length,1);assert.equal(h.data.usage_events_json.length,1);
 assert.equal(done.body.sections[7].title,"Short Video Script");
});
test("fresh review of a corrected pack cannot use initial fallback to approve an invented guarantee",async()=>{
 const h=harness(),req={...request,requestId:requestId(702)};h.data=seedCapturedDraft(h.data,req,h.now);
 h.provider=p=>{const r=disagreementResponse(p),i=JSON.parse(p.input);
  if(i.pass==="fresh_final_revalidation"&&i.units[0].id==="u0"){
   const raw=JSON.parse(r.output_text);raw.decisions[0]={...raw.decisions[0],kind:"unsupported",reason:"guarantee",replacement:"Our product guarantees results."};
   return {...r,output_text:JSON.stringify(raw)};
  }return r;};
 const done=await h.finish(req);assert.notEqual(done.response.status,200);
 assert.equal(done.body.code,"grounding_failed");assert.equal(h.data.generation_history_json,undefined);
 assert.equal(h.data.usage_events_json,undefined);assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
});
