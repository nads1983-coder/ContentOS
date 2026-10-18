import {readFileSync} from "node:fs";
import {parentheticalResponse} from "./parenthetical-capture-helpers.mjs";
export {draft,request,hash,seedCapturedDraft} from "./parenthetical-capture-helpers.mjs";
export const secondAudit=JSON.parse(readFileSync(new URL("../docs/benchmarks/acceptance-final-a7cd-2026-10-18/execution.json",import.meta.url),"utf8"));
// Exactly two historical responses; remaining decisions are explicitly mocked.
export function finalClassificationResponse(payload){
 const input=JSON.parse(payload.input);
 if(input.pass==="initial_review"&&input.units[0].id==="u48"){
  const e=secondAudit.jobs[0].evidence;return{status:"completed",output_text:e.outputText,usage:e.usage};
 }
 return parentheticalResponse(payload);
}
