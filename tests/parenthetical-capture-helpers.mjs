// Offline fixtures only. No provider calls; semantic decisions after the captured
// first batch are explicit mechanical mocks, not live factual-review evidence.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {loadTs} from "./image-test-helpers.mjs";
import {contract,grounding,mechanicalCertificate} from "./grounding-capture-helpers.mjs";
const dir=new URL("../docs/benchmarks/acceptance-continuation-rc717-2026-10-18/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,dir),"utf8"));
export const audit=read("execution.json"),draft=read("raw-draft.json"),request=contract.normalizeGenerationRequest(read("brief.json"));
export const originalReview=audit.jobs[0].evidence.outputText;
const original=JSON.parse(readFileSync(new URL("../docs/benchmarks/live-acceptance-rc717-2026-10-18/execution.json",import.meta.url),"utf8")).jobs[0];
const context=grounding.buildGroundingContext(request);
// Explicit OFFLINE corrections for additional conservative guard rejections in
// the unreplayed portion. These are not attributed to the captured live review.
export const mockRepairs={
 u51:"#softfurnishing #wovenfabric #homerefresh #designdetails #texturedesign #homeaccessories #stitching",
 u117:"6/ Each envelope contains two loose fabric swatches, one Arc fabric and one Bond fabric. ",
 u121:"Short video script: Arc and Bond, different care instructions",
 u128:"Arc and Bond: cushion covers with different care instructions. ",
 u200:"Repurpose pack: Arc and Bond",
 u256:"Beat 1: Arc and Bond: cushion covers with different care instructions. "
};
const originalUnits=grounding.groundingUnits(draft);
const reservations=loadTs("lib/generation-reservation.ts"),pipeline=loadTs("lib/generation-pipeline.ts");
export const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function seedCapturedDraft(profile,req,now=new Date()) {
 const admitted=reservations.reserveGenerationInProfile(profile,profile.id,req.requestId,req,now,true);
 const p=pipeline.newGenerationPipeline();
 p.phase="review";p.draft=structuredClone(draft);
 p.reservedMicroUsd=Math.ceil(((original.payloadBytes+4096)*1.75+original.payload.max_output_tokens*14)*1.25);
 p.metrics=[{key:"1:draft:0:0",kind:"draft",status:"complete",startedAt:original.reservedAt,finishedAt:original.completedAt,
  durationMs:original.evidence.durationMs,inputBytes:original.payloadBytes,payloadHash:original.payloadHash,
  inputTokens:original.evidence.usage.input_tokens,outputTokens:original.evidence.usage.output_tokens,
  inputTokenLimit:original.payloadBytes+4096,outputTokenLimit:original.payload.max_output_tokens,reservedMicroUsd:p.reservedMicroUsd}];
 admitted.data.generation_reservations_json.at(-1).pipeline=p;
 return admitted.data;
}
export function parentheticalResponse(payload) {
 assert.equal(payload.text.format.name,"content_grounding_batch","Draft generation is forbidden in this replay");
 const data=JSON.parse(payload.input);
 if(data.pass==="initial_review"&&data.units[0].id==="u0")return{status:"completed",output_text:originalReview,usage:audit.jobs[0].evidence.usage};
 const pack=structuredClone(draft);
 for(const[path,value]of data.wholePack){const keys=path.split("."),key=keys.pop();keys.reduce((v,k)=>v[k],pack)[key]=value;}
 const units=grounding.groundingUnits(pack);
 return{status:"completed",output_text:JSON.stringify({decisions:data.units.map(wire=>{
  const unit=units.find(u=>u.id===wire.id);
  const originalUnit=originalUnits.find(u=>u.path===unit.path&&u.text===unit.text);
  if(originalUnit&&mockRepairs[originalUnit.id])return{id:unit.id,kind:"unsupported",sourceIds:[],reason:"missing_evidence",replacement:mockRepairs[originalUnit.id]};
  if(unit.text.includes("Slide 7: Samples, clearly defined |"))return{id:unit.id,kind:"supported",sourceIds:["s20","s21"],reason:"none",replacement:null};
  return mechanicalCertificate(unit,context);
 })}),usage:{input_tokens:100,output_tokens:200}};
}
