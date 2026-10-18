// Synthetic reviewer decisions for offline orchestration only. Original provider
// responses are retained untouched; these are not predictions of live review.
import {readFileSync} from "node:fs";
import {contract,grounding,mechanicalCertificate} from "./grounding-capture-helpers.mjs";
const dir=new URL("../docs/benchmarks/final-delivery-2026-10-18/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,dir),"utf8"));
export const live=read("execution.json"), request=contract.normalizeGenerationRequest(read("brief.json"));
export const draft=read("raw-draft.json"), findings=read("independent-assessment.json").formats.flatMap(f=>f.materialFailures);
const context=grounding.buildGroundingContext(request), originalUnits=grounding.groundingUnits(draft);
const replacements={
 u2:"LinkedIn post: Notice the ordinary, leave room for later",
 u4:"Fieldline brings Notice, Sketch and Revisit to everyday observation.",
 u5:"Margin Tide's Fieldline notebook has an A5 paper format, a moss green cover and three printed section headings:",
 u11:"An optional idea for Notice: a detail from an imaginary square.",
 u13:"An optional idea for Sketch: a rough bench outline.",
 u15:"Revisit sounds like an invitation, not a deadline.",
 u16:"An optional imaginary example, arranged as notes:",
 u17:"1) Notice: chalk dust near the steps.",
 u18:"2) Sketch: a rough bench outline.",
 u19:"3) Revisit: left open.",
 u31:"Fieldline has an A5 paper format, a moss green cover and three printed section headings: Notice, Sketch, Revisit.",
 u32:"An optional imaginary example could use all three headings.",
 u42:"An unfinished page need not feel like a failure.",
 u43:"Notice, Sketch and Revisit sound like a gentle rhythm for notes.",
 u49:"Fieldline's headings: Notice, Sketch, Revisit.",
 u51:"Fieldline is an A5 notebook with three printed section headings: Notice. ",
 u55:"Optional imaginary example: a line for Notice, a scribble for Sketch, Revisit left open. ",
 u63:"Fieldline's three headings suggest a beginning without demanding a grand finale. ",
 u67:"Margin Tide's Fieldline notebook is intended for everyday observation and informal notes.",
 u68:"Its printed section headings are Notice, Sketch and Revisit. ",
 u73:"An informal record can feel enough.",
 u76:"Notice, Sketch, Revisit: Fieldline and the everyday",
 u77:"Fieldline by Margin Tide has an A5 paper format, a moss green cover and three printed section headings. ",
 u93:"A short thread exploring Fieldline's headings: Notice, Sketch and Revisit.",
 u114:"An unfinished page can still hold something worth keeping.",
 u124:"Fieldline has three printed section headings: Notice, Sketch, Revisit.",
 u126:"Fieldline: three printed section headings",
 u149:"Slide 2: The headings: Notice / Sketch / Revisit",
 u150:"Support: Fieldline has three printed section headings and is intended for everyday observation and informal notes.",
 u174:"Fieldline has an A5 paper format, a moss green cover and three printed section headings:",
 u178:"Those names suggest a gentler idea of a finished page.",
 u193:"LinkedIn: A chalk trace, a bench outline, a note left open.",
 u194:"Fieldline has an A5 paper format, a moss green cover and three printed section headings:",
 u201:"An optional imaginary example, arranged as notes:",
 u202:"1) Notice: chalk dust near the steps.",
 u203:"2) Sketch: a rough bench outline.",
 u204:"3) Revisit: left open.",
 u207:"Fieldline has an A5 paper format, a moss green cover and three printed section headings: Notice, Sketch, Revisit.",
 u210:"TikTok: Fieldline's headings: Notice, Sketch, Revisit.",
 u214:"Fieldline's three headings suggest a beginning without demanding a grand finale. ",
 u217:"Slide 2: The headings: Notice / Sketch / Revisit",
 u221:"Slide 6: Imaginary square: chalk dust, a rough bench outline, a note left open",
 u224:"Video: Hook: A fountain hiss, a passing bicycle, an unfinished note.",
 u226:"Beat: Fieldline has three printed section headings: Notice, Sketch, Revisit.",
 u227:"Beat: Optional imaginary example: fountain hiss for Notice, a rough bench outline for Sketch, Revisit left open.",
 u233:"Fieldline has an A5 paper format, a moss green cover and three printed section headings: Notice, Sketch, Revisit.",
 u243:"Unfinished notes, ordinary places: Fieldline leaves room for a small idea."
};
export const repairs=Object.entries(replacements).map(([id,replacement])=>{const u=originalUnits.find(u=>u.id===id);return{id,path:u.path,original:u.text,replacement};});
export function scopeResponse(payload,options={}){
 if(payload.text.format.name==="social_content_generation")return{status:"completed",output_text:live.jobs[0].evidence.outputText,usage:live.jobs[0].evidence.usage};
 const data=JSON.parse(payload.input),pack=structuredClone(draft);
 for(const[path,value]of data.wholePack){const keys=path.split("."),key=keys.pop();keys.reduce((v,k)=>v[k],pack)[key]=value;}
 const units=grounding.groundingUnits(pack);
 const decisions=data.units.map(wire=>{
  const u=units.find(u=>u.id===wire.id),repair=repairs.find(r=>r.path===u.path&&r.original===u.text);
  if(repair)return{id:u.id,kind:"unsupported",sourceIds:[],reason:"missing_evidence",replacement:repair.replacement};
  return mechanicalCertificate(u,context);
 });
 options.change?.(decisions,data,units);
 return{status:"completed",output_text:JSON.stringify({decisions}),usage:{input_tokens:100,output_tokens:200}};
}
