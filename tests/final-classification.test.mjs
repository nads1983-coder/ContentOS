import test from "node:test";
import assert from "node:assert/strict";
import {grounding,batches} from "./grounding-capture-helpers.mjs";
import {draft,request,originalReview} from "./parenthetical-capture-helpers.mjs";
import {readFileSync} from "node:fs";
const second=JSON.parse(readFileSync(new URL("../docs/benchmarks/acceptance-final-a7cd-2026-10-18/execution.json",import.meta.url),"utf8")).jobs[0].evidence.outputText;
const context=grounding.buildGroundingContext(request);
function review(unit,kind="creative",ctx=context){return grounding.parseGroundingReview(JSON.stringify({decisions:[{id:unit.id,kind,references:[],reason:"none",replacement:null}]}),[unit],ctx);}
function firstItem(pack){return grounding.groundingUnits(pack).find(u=>u.path==="sections.1.items.0");}
test("both exact captured responses yield 96 certificates with all six unsupported decisions preserved",()=>{
 const a=batches.parseBatchReview(originalReview,batches.groundingBatch(draft,request,0,0));
 const b=batches.parseBatchReview(second,batches.groundingBatch(draft,request,1,0));
 assert.equal(a.decisions.length,48);assert.equal(b.decisions.length,48);
 assert.deepEqual([...a.decisions,...b.decisions].filter(d=>d.kind==="unsupported").map(d=>d.id),["u32","u44","u50","u51","u58","u87"]);
 assert.equal(b.decisions.find(d=>d.id==="u49").kind,"creative");assert.equal(b.decisions.find(d=>d.id==="u68").kind,"subjective");
});
test("hashtag-set labels require actual sequential items and never certify the tags themselves",()=>{
 for(const type of ["instagram","tiktok"]){const p=structuredClone(draft);p.sections[1].type=type;
  const u=firstItem(p);assert.deepEqual(u.annotations,[[0,"Hashtags set 1: ".length]]);assert.doesNotThrow(()=>review(u));
  assert.throws(()=>review(u,"structural"));
 }
 for(const mutate of [p=>p.sections[1].items[1]=p.sections[1].items[1].replace("set 2:","set 4:"),
  p=>p.sections[1].items[1]=p.sections[1].items[1].replace("set 2:","set 1:"),p=>p.sections[1].items.pop(),
  p=>p.sections[1].items[2]="Hashtags set 3: ",p=>p.sections[1].type="linkedin",
  p=>p.sections[1].items[0]=p.sections[1].items[0].replace("set 1:","set 1.5:"),
  p=>p.sections[1].items[0]=p.sections[1].items[0].replace("set 1:","set 1/3:")]){
  const p=structuredClone(draft);mutate(p);const u=firstItem(p);assert.equal(u.annotations,undefined);assert.throws(()=>review(u));
 }
 const forged={...firstItem(draft),annotations:[[0,firstItem(draft).text.length]]};assert.throws(()=>review(forged));
});
test("substantive quantities, offers, CTA and claim-bearing hashtags remain checked after valid label",()=>{
 for(const text of ["999 customers #fabric", "GBP999 offer #fabric", "#GuaranteedResults", "#CertifiedFabric", "#BuyNow", "Our class covers pricing #fabric"]){
  const p=structuredClone(draft);p.sections[1].items[0]="Hashtags set 1: "+text;const u=firstItem(p);
  assert.ok(u.annotations);assert.throws(()=>review(u),text);assert.throws(()=>review(u,"subjective"),text);
 }
});
test("physical cover nouns do not hide curriculum verbs, factual quantities or promised benefits",()=>{
 for(const text of ["Choosing a cushion cover starts with care, not colour.","A duvet cover feels cosy.","An outer cover with a quiet look."]){
  const unit={id:"u",path:"body",start:0,end:text.length,text};assert.deepEqual(grounding.claimCategories(text),[]);assert.doesNotThrow(()=>review(unit,"subjective"));
 }
 for(const text of ["Our course covers cushion care.","The cushion-cover class covers pricing.","A cushion cover starts with care; our workshop teaches pricing.",
  "A cushion cover includes certified training.","A cushion cover starts with care and guarantees results.","A cushion cover costs GBP999.","Our course covers 8 modules.","A cushion covers 8 modules.",
  "Our workshop on cushion covers starts with care.","The training about outer covers begins with washing."]){
  const unit={id:"u",path:"body",start:0,end:text.length,text};assert.throws(()=>review(unit,"creative"),text);assert.throws(()=>review(unit,"subjective"),text);
 }
 assert.ok(grounding.claimCategories("Our workshop covers care.").includes("curriculum"));
});
