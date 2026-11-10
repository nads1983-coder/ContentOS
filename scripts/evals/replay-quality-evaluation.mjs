// Offline replay of persisted synthetic responses through current application guards.
import {readFileSync,writeFileSync} from 'node:fs';
import {loadTs} from '../../tests/image-test-helpers.mjs';
import {rates} from './lifetime-candidate-config.mjs';
const [input,output]=process.argv.slice(2); if(!input||!output)throw Error('Expected input and output paths');
const e=JSON.parse(readFileSync(input,'utf8'));
const {normalizeGenerationRequest,parseGenerationOutput}=loadTs('lib/generation-contract.ts');
const {reviewBusinessFacts}=loadTs('lib/business-facts.ts');
const rows=e.results.map(r=>{
 const req=normalizeGenerationRequest(e.cases.find(c=>c.id===r.case));const out={model:r.model,case:r.case,repeat:r.repeat,providerStatus:r.status,originalValidation:r.validation,inputTokens:r.usage?.input_tokens,outputTokens:r.usage?.output_tokens};
 if(r.status!=='completed'){out.validation='failed';out.reason=r.status==='request_failed'?'provider request failed':'provider response incomplete';return out;}
 try {const result=parseGenerationOutput(r.output,req);out.validation='passed';out.sections=result.sections.length;}
 catch(err){out.validation='failed';out.reason=err?.message;try{const raw=JSON.parse(r.output);out.claims=reviewBusinessFacts(raw,req).filter(x=>x.classification==='unsupported').map(x=>({field:x.field,category:x.category,text:x.text}));}catch{out.structure='invalid JSON';}}
 return out;
});
const models=[...new Set(rows.map(r=>r.model))].map(model=>{
 const results=e.results.filter(r=>r.model===model),filtered=rows.filter(r=>r.model===model),rr=rates[model];let inputTokens=0,outputTokens=0,cached=0,writes=0,estimatedUSD=0;
 for(const x of results){const u=x.usage;if(!u)continue;const c=u.input_tokens_details?.cached_tokens??0,w=u.input_tokens_details?.cache_write_tokens??0;if(c+w>u.input_tokens)throw Error('Invalid cached token accounting');inputTokens+=u.input_tokens;outputTokens+=u.output_tokens;cached+=c;writes+=w;estimatedUSD+=((u.input_tokens-c-w)*rr.input+c*({'gpt-6-luna':.01,'gpt-5.2':.175}[model])+w*rr.input*rr.cacheWrite+u.output_tokens*rr.output)/1e6;}
 return {model,attempts:filtered.length,providerCompleted:filtered.filter(r=>r.providerStatus==='completed').length,passed:filtered.filter(r=>r.validation==='passed').length,inputTokens,outputTokens,cachedInputTokens:cached,cacheWriteTokens:writes,estimatedUSD,estimatedGBPWithContingency:estimatedUSD*1.2,failed:filtered.filter(r=>r.validation==='failed').map(r=>({case:r.case,repeat:r.repeat,reason:r.reason,structure:r.structure,categories:[...new Set((r.claims??[]).map(c=>c.category))]}))};
});
writeFileSync(output,JSON.stringify({source:input,method:'Real synthetic outputs replayed offline against the final validator; not an invoice or blind quality review.',models,rows},null,2)+'\n');console.log(JSON.stringify(models));
