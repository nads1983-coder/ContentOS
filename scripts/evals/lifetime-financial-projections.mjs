import {writeFileSync,readFileSync} from 'node:fs';
import {callBound,limits,packageProjection,rates} from './lifetime-candidate-config.mjs';
const models=Object.keys(rates).map(model=>({model,perAttempt:callBound(model),perDeliveredWithOneRetry:callBound(model)*2,
  lifetimeMonthly:[1,25,50,100].map(customers=>({customers,estimatedGBP:customers*50*callBound(model)*2})),
  packages:[[25,5],[50,9],[100,15]].map(([credits,price])=>({credits,priceGBP:price,...packageProjection(model,credits,price)})),
  // Incumbents intentionally retain GPT-5.2 routing. This is a demand illustration, not account census.
  mixedDemand:[25,50,100].map(customers=>({lifetimeCustomers:customers,incumbentTextCalls:480,
    // Current incumbent envelope allows 132096 input and 24000 output, zero automatic retries.
    existingRouteGBP:480*callBound('gpt-5.2',{inputTokens:132096,outputTokens:24000})+customers*50*callBound(model)*2,
    hypotheticalAllMigratedGBP:(480+customers*50)*callBound(model)*2}))}));
const evaluation=JSON.parse(readFileSync('docs/pr22-financial-evaluation-2026-11-09.json','utf8'));
const runs=evaluation.results.filter(r=>r.usage);
const input=runs.reduce((a,r)=>a+r.usage.input_tokens,0),output=runs.reduce((a,r)=>a+r.usage.output_tokens,0);
const report={date:'2026-11-09',currencyAssumption:'£1 per USD +20% contingency; standard service only; all input at cache-write rates where applicable; no cache discount',
  limits,productionChanged:false,invoiceAvailable:false,
  feeAssumption:'5.15% +20p (international cards with FX), rounded up; VAT scenario 20% inclusive; operating reserve 10% gross; other methods and disputes can exceed this',
  models,evaluation:{completed:runs.length,parserPassed:runs.filter(r=>r.validation==='passed').length,
    inputTokens:input,outputTokens:output,conservativeUsageEstimateGBP:(input*.25+output*1.2)/1e6*1.2,
    inputPreflightMatched:runs.every(r=>r.usage.input_tokens===r.inputTokens),
    maxOutputUsed:Math.max(...runs.map(r=>r.usage.output_tokens)),
    latencyMs:{min:Math.min(...runs.map(r=>r.durationMs)),max:Math.max(...runs.map(r=>r.durationMs))}},
  warning:'Model availability, quality, invoice costs, persistent per-credit retry accounting, production caps and lifetime funding have not passed release acceptance. Repeated user retries are not bounded per delivered credit today.'};
writeFileSync('docs/pr22-financial-projections-2026-11-09.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
