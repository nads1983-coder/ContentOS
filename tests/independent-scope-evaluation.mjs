// Offline adversarial certificates, not model calls or claims of semantic proof.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { grounding as g, contract } from "./grounding-capture-helpers.mjs";
const bytes = readFileSync(new URL("./fixtures/independent-grounding-scope.json", import.meta.url));
const fixture = JSON.parse(bytes);
export function evaluateIndependentScope() {
 const cases = fixture.cases.map(c => {
  const request = contract.normalizeGenerationRequest({source:c.source, selectedTypes:["linkedin"], ctaMode:c.ctaMode, ...c.brandContext});
  const context = g.buildGroundingContext(request);
  const units = c.units ?? g.groundingUnits({title:"Draft", summary:"Overview", sections:[{type:"linkedin", title:"Draft", platform:"LinkedIn", body:c.output, items:[], cta:""}]}).filter(u=>u.path==="sections.0.body");
  if(c.sourceStatements) context.sources = c.sourceStatements;
  const references = (c.evidence ?? []).map(e => {
   const s=context.sources.find(s => s.origin===(e.origin==="source"?"brief":"brand") && s.text.includes(e.quote));
   if(!s) throw new Error(`Fixture reference cannot be resolved: ${c.id}`);
   return {sourceId:s.id,quote:e.quote};
  });
  const review=c.review ?? {decisions:units.map(u=>({id:u.id,kind:c.kind,references,reason:"none",replacement:null}))};
  let actual="allow";
  try{g.parseGroundingReview(JSON.stringify(review),units,context);}catch(e){if(!(e instanceof g.GroundingError))throw e;actual="reject";}
  return {id:c.id,category:c.category,layer:c.evaluationLayer??"semantic",expected:c.expected,actual,match:actual===c.expected};
 });
 return {fixtureSha256:createHash("sha256").update(bytes).digest("hex"),mode:"offline adversarial review-certificate validation; no live model",cases,
  semantic:{total:cases.filter(c=>c.layer==="semantic").length,falsePositives:cases.filter(c=>c.layer==="semantic"&&c.expected==="allow"&&c.actual==="reject").map(c=>c.id),falseNegatives:cases.filter(c=>c.layer==="semantic"&&c.expected==="reject"&&c.actual==="allow").map(c=>c.id)},
  structural:{total:cases.filter(c=>c.layer!=="semantic").length,failures:cases.filter(c=>c.layer!=="semantic"&&!c.match).map(c=>c.id)}};
}
if(process.argv[1]?.endsWith("independent-scope-evaluation.mjs")){
 const report=evaluateIndependentScope();const output=process.argv.find(a=>a.startsWith("--report="))?.slice(9);
 if(output)writeFileSync(output,JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify(report,null,2));
}
