import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {grounding as g,batches,contract} from "./grounding-capture-helpers.mjs";
const directory=new URL("../docs/benchmarks/final-delivery-2026-10-18/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,directory),"utf8"));
const request=contract.normalizeGenerationRequest(read("brief.json")),draft=read("raw-draft.json"),ctx=g.buildGroundingContext(request);
const units=g.groundingUnits(draft),original=JSON.parse(read("execution.json").jobs[2].evidence.outputText).decisions;
const mismatches=["u58","u65","u74",...Array.from({length:12},(_,i)=>`u${79+i}`),"u91","u94"];
function approve(u,kind,references=[]){return g.parseGroundingReview(JSON.stringify({decisions:[{id:u.id,kind,references,reason:"none",replacement:null}]}),[u],ctx);}
const refs=indices=>indices.map(i=>({sourceId:ctx.sources[i].id,quote:ctx.sources[i].text}));
test("all seventeen captured mismatches have an explicit safe classification, without treating content as metadata",()=>{
 for(const id of mismatches){const unit=units.find(u=>u.id===id),eligible=g.reviewEligibility(unit,ctx);
  assert.equal(original.find(d=>d.id===id).kind,"structural");
  if(["u58","u74"].includes(id)){assert.equal(eligible.structural,true);assert.doesNotThrow(()=>approve(unit,"structural"));}
  else{
   assert.equal(eligible.structural,false,id);assert.throws(()=>approve(unit,"structural"),g.GroundingError,id);
   const fact=["u79","u80","u81","u82","u88"].includes(id);
   assert.doesNotThrow(()=>approve(unit,fact?"supported":"creative",eligible.requiresSources?refs([0,1,3]):[]),id);
  }
 }
 const wire=JSON.parse(batches.groundingBatch(draft,request,1,0).input);
 for(const unit of wire.units){const actual=units.find(u=>u.id===unit.id);assert.equal(unit.structural,g.reviewEligibility(actual,ctx).structural);}
});
test("keyword evidence and semantic classification remain mandatory; a format label cannot hide claims",()=>{
 for(const mutate of [p=>{p.sections[5].items=[];},p=>{p.sections[5].body="A caption without a description.";}]){
  const p=structuredClone(draft);mutate(p);const unit=g.groundingUnits(p).find(u=>u.path==="sections.5.title");
  assert.equal(g.reviewEligibility(unit,ctx).structural,false);
 }
 for(const unit of units.filter(u=>/^sections\.5\.items\./.test(u.path))){assert.equal(g.reviewEligibility(unit,ctx).requiresSources,true);assert.throws(()=>approve(unit,"creative"),g.GroundingError);}
 for(const text of ["Guaranteed results", "A5 notebook costs GBP 20", "Our notebook reduces errors by 90%", "Waterproof notebook with lifetime guarantee"]){
  const pack=structuredClone(draft);pack.sections[5].items[0]=text;const unit=g.groundingUnits(pack).find(u=>u.path==="sections.5.items.0");
  for(const kind of ["structural","creative","subjective"])assert.throws(()=>approve(unit,kind,refs([0,1])),g.GroundingError,text);
 }
 for(const text of ["Facebook post: Guaranteed results", "X/Twitter: One post guarantees sales", "YouTube Shorts: Caption, description, tags, 90% growth"]){
  const pack=structuredClone(draft);pack.sections[4].title=text;const unit=g.groundingUnits(pack).find(u=>u.path==="sections.4.title");
  assert.equal(g.reviewEligibility(unit,ctx).structural,false);assert.throws(()=>approve(unit,"structural"),g.GroundingError);
 }
});
test("thread ordinals and totals require the actual whole sequence; serialized or mutated spans confer no exemption",()=>{
 const valid=units.find(u=>u.id==="u94");assert.deepEqual(g.deterministicIssues(valid,ctx),[]);assert.doesNotThrow(()=>approve(valid,"creative"));
 for(const mutate of [p=>{p.sections[6].items[0]=p.sections[6].items[0].replace("1/6","1/7");},p=>{p.sections[6].items.pop();},p=>{p.sections[6].items[1]=p.sections[6].items[0];}]){
  const p=structuredClone(draft);mutate(p);const unit=g.groundingUnits(p).find(u=>u.path==="sections.6.items.0");
  assert.ok(g.deterministicIssues(unit,ctx).length);assert.throws(()=>approve(unit,"creative"),g.GroundingError);
 }
 assert.throws(()=>approve({...valid,annotations:[[0,valid.text.length]]},"creative"),g.GroundingError);
 const changed=g.groundingUnits(draft).find(u=>u.id==="u94");changed.text="9/9 Guaranteed results.";
 assert.throws(()=>approve(changed,"structural"),g.GroundingError);
 const p=structuredClone(draft);p.sections[6].items[0]+=" Our product guarantees results.";
 const claim=g.groundingUnits(p).find(u=>u.path==="sections.6.items.0"&&u.text.includes("guarantees"));
 assert.throws(()=>approve(claim,"creative"),g.GroundingError);
});
test("multiline thread labels and full spoken beat sequence use actual positions without hiding prose",()=>{
 for(const newline of ["\n","\r\n"]){
  const p=structuredClone(draft);p.sections[6].items=p.sections[6].items.map(t=>t.replace(/^(\d+\/\d+)\s+/,`$1${newline}`));
  for(const u of g.groundingUnits(p).filter(u=>/^\d+\/\d+$/.test(u.text)))assert.doesNotThrow(()=>approve(u,"structural"));
 }
 const beats=units.filter(u=>/^Beat \d+ \(/.test(u.text));assert.equal(beats.length,5);
 for(const u of beats)assert.doesNotThrow(()=>approve(u,"structural"));
});
test("claim-bearing hashtags cannot borrow metadata status or unrelated source evidence",()=>{
 for(const text of ["#GuaranteedResults","#Guaranteed_Results","#CertifiedNotebook","#guaranteedresults","#GUARANTEEDRESULTS"]){
  const p=structuredClone(draft);p.sections[5].items[0]=text;
  const u=g.groundingUnits(p).find(u=>u.path==="sections.5.items.0");
  assert.equal(g.reviewEligibility(u,ctx).structural,false);
  for(const kind of ["structural","creative","subjective","supported"])assert.throws(()=>approve(u,kind,refs([0,1])),g.GroundingError,text);
 }
});
test("No CTA is enforced inside tags independent of case and spacing",()=>{
 for(const text of ["#BuyNow","#buynow","#BUY_NOW","#SignUp","#FollowUs","#Follow_Me"]){
  const p=structuredClone(draft);p.sections[5].items[0]=text;const u=g.groundingUnits(p).find(u=>u.path==="sections.5.items.0");
  assert.ok(g.deterministicIssues(u,ctx).includes("cta"));
  for(const kind of ["structural","creative","subjective","supported"])assert.throws(()=>approve(u,kind,refs([0,1])),g.GroundingError);
 }
 const p=structuredClone(draft);p.sections[5].items[0]="#unfamiliarcompound";const u=g.groundingUnits(p).find(u=>u.path==="sections.5.items.0");
 assert.equal(g.reviewEligibility(u,ctx).structural,false);
});
test("a cover used as the subject of an aesthetic predicate is not a curriculum verb",()=>{
 for(const text of ["A quiet blue cover can feel like a fresh start.","The cover looks inviting."]){
  const p=structuredClone(draft);p.sections[0].body=text;const u=g.groundingUnits(p).find(u=>u.path==="sections.0.body");
  assert.doesNotThrow(()=>approve(u,"subjective"));
 }
 for(const text of ["The workshop covers advanced binding techniques.","Our cover guarantees protection.","The cover looks inviting and doubles productivity."]){
  const p=structuredClone(draft);p.sections[0].body=text;const u=g.groundingUnits(p).find(u=>u.path==="sections.0.body");
  assert.throws(()=>approve(u,"subjective"),g.GroundingError);
 }
});
