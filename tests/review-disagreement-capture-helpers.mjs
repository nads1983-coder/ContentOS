import {readFileSync} from "node:fs";
import {finalClassificationResponse} from "./final-classification-capture-helpers.mjs";
export {draft,request,hash,seedCapturedDraft} from "./final-classification-capture-helpers.mjs";
export const recoveryAudit=JSON.parse(readFileSync(new URL("../docs/benchmarks/acceptance-recovery-d423-2026-10-18/execution.json",import.meta.url),"utf8"));
export const thirdReview=recoveryAudit.jobs[0].evidence.outputText;
// Three unchanged live receipts; all other responses are explicitly offline mocks.
export function disagreementResponse(payload){
 const input=JSON.parse(payload.input);
 if(input.pass==="initial_review"&&input.units[0].id==="u96"){
  const e=recoveryAudit.jobs[0].evidence;return{status:"completed",output_text:e.outputText,usage:e.usage};
 }
 return finalClassificationResponse(payload);
}
