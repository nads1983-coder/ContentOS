// Offline summary of recorded synthetic evaluations; never calls a provider.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {callBound,limits,packageProjection,rates} from './lifetime-candidate-config.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/evals/summarize-lifetime-evaluation.mjs INPUT_JSON OUTPUT_JSON');
const evidence=JSON.parse(readFileSync(input,'utf8'));
const models=[...new Set(evidence.results.map(row=>row.model))].map(model=>{
  const r=rates[model];assert.ok(r,'Unreviewed model');
  const rows=evidence.results.filter(row=>row.model===model),completed=rows.filter(row=>row.usage);
  let inputTokens=0,outputTokens=0,cacheWriteTokens=0,cachedTokens=0,estimatedUSD=0;
  for(const row of completed){const u=row.usage;const cached=u.input_tokens_details?.cached_tokens??0,write=u.input_tokens_details?.cache_write_tokens??0;
    assert.ok(cached+write<=u.input_tokens,'Invalid cache token accounting');
    inputTokens+=u.input_tokens;outputTokens+=u.output_tokens;cacheWriteTokens+=write;cachedTokens+=cached;
    estimatedUSD+=((u.input_tokens-cached-write)*r.input+cached*({"gpt-4.1-mini":0.1,"gpt-5.2":0.175,"gpt-5.6-luna":0.02,"gpt-6-luna":0.01}[model])+write*r.input*r.cacheWrite+u.output_tokens*r.output)/1e6;
  }
  const passed=completed.filter(row=>row.validation==='passed').length;
  return {model,samples:rows.length,completed:completed.length,parserPassed:passed,parserRejected:completed.length-passed,inputTokens,outputTokens,cacheWriteTokens,cachedTokens,
    estimatedUSD,estimatedGBPWithContingency:estimatedUSD*1.2,estimatedGBPPerAttempt:completed.length?estimatedUSD*1.2/completed.length:null,
    estimatedGBPPerAcceptedOutput:passed?estimatedUSD*1.2/passed:null,
    countedInputEqualsUsage:completed.every(row=>row.inputTokens===row.usage.input_tokens),
    maximumInputTokens:Math.max(0,...completed.map(row=>row.inputTokens)),maximumOutputTokens:Math.max(0,...completed.map(row=>row.usage.output_tokens)),
    meanLatencyMs:completed.length?completed.reduce((sum,row)=>sum+row.durationMs,0)/completed.length:null,
    caseResults:[...new Set(rows.map(row=>row.case))].map(id=>({id,passed:rows.filter(row=>row.case===id&&row.validation==='passed').length,samples:rows.filter(row=>row.case===id).length}))};
});
const projections=Object.keys(rates).map(model=>({model,perDeliveredCreditGBP:callBound(model)*limits.attempts,
  monthlyLifetimeGBP:[1,25,50,100].map(customers=>({customers,cost:customers*50*callBound(model)*limits.attempts})),
  packages:[[25,5],[50,9],[100,15]].map(([credits,price])=>({credits,priceGBP:price,...packageProjection(model,credits,price)}))}));
const summary={source:input,limits,models,projections,
  note:'Token counts are provider-reported; spending is a list-price estimate, not an invoice. GBP assumes £1/USD plus 20% contingency. Two independent repetitions are not a tested retry implementation. No production routing or entitlement change.',
  budgetGBP:30,protectedIncumbentReserveGBP:30,currentFundedNewPlaces:0,
  hypotheticalMixedDemand:{existingCalls:480,existingCodeDefaultMaximumGBP:480*callBound('gpt-5.2',{inputTokens:132096,outputTokens:24000}),lifetimeCustomers:25,lifetimeGPT6CandidateGBP:25*50*callBound('gpt-6-luna')*2}};
writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({models,projections},null,2));
