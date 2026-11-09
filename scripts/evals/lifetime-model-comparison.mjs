// Separately funded, manual evaluation only. Never imported by application routes.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { loadTs } from '../../tests/image-test-helpers.mjs';
import { assertTokenCount, callBound, limits, rates } from './lifetime-candidate-config.mjs';
process.loadEnvFile('.env.local');
if (process.env.CONTENTOS_SEPARATE_EVAL_APPROVED !== '1' || !process.env.OPENAI_API_KEY) throw new Error('Separately funded evaluation approval required');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 45000, logLevel: 'off' });
const { normalizeGenerationRequest, parseGenerationOutput } = loadTs('lib/generation-contract.ts');
const { buildStudioInput, productionOutputSchema } = loadTs('lib/production-generation.ts');
const { buildInstructions } = loadTs('lib/prompts.ts');
const { contentTypes } = loadTs('lib/content-config.ts');
const cases = [
  { id: 'milestone', source: 'Northbank Paper has reached 1,000 newsletter subscribers. Announce an upcoming giveaway, but prize, dates and eligibility have not been decided.', selectedTypes: ['instagram'], ctaMode: 'none' },
  { id: 'practical', source: 'A small design studio shares three planning steps: collect references, sketch alternatives, and review the draft before publishing.', selectedTypes: ['linkedin','twitter'] },
  { id: 'limited-claim', source: 'A volunteer group is piloting a monthly repair cafe. The first session is planned for Saturday; attendance and outcomes are not yet known.', selectedTypes: ['tiktok','facebook','youtubeShorts'] },
  { id: 'all-formats', source: 'Elm Studio runs a beginner drawing workshop on 14 December at 2pm in York. Tickets cost £12. Bring a pencil and sketchbook. The workshop covers observation, outlines, and shading. Booking is by email to hello@example.invalid. No other benefits or results are claimed.', selectedTypes: contentTypes.map(t=>t.id) },
  { id: 'repurpose', source: 'Fern Repairs shares a three-step bicycle check: inspect tyres, test brakes, then check lights before a journey. This is a checklist, not a repair service offer.', selectedTypes: ['repurposePack','carousel','shortVideoScript'] },
  { id: 'newsletter', source: 'A local library will host a free poetry reading on 18 December at 6pm. Capacity is 30 people. Booking opens on 1 December. No authors have been announced.', selectedTypes: ['emailNewsletter','xThread','hooks','ctas','platformHashtags'] },
  { id: 'unicode', source: 'Café Étoile is offering café con leche and croissants on Saturday. The menu includes a £5 breakfast option. No delivery service or discount is offered.', selectedTypes: ['instagram','platformHashtags'] },
  { id: 'long-brief', source: ('Our editorial checklist: verify facts, retain qualifications, use plain language, and review before publication.\n').repeat(60), selectedTypes: ['linkedin','emailNewsletter'], length:'detailed' }
].map(c=>({...c,automaticSettings:[]}));
for(const item of cases)normalizeGenerationRequest(item);
const report={date:new Date().toISOString(),limits,maximumEvaluationReserveGBP:2,results:[],cases,
  note:'Synthetic briefs through unchanged production instructions/schema/parser. One attempt per sample, two independent repetitions. Token counting must succeed before generation. No invoice or blind human panel.'};
const destination='docs/pr22-financial-evaluation-2026-11-09.json';
let reserve=0;
function save(){writeFileSync(destination,JSON.stringify({...report,reservedUpperBoundGBP:reserve},null,2)+'\n');}
for(const model of Object.keys(rates)) {
  let inaccessible=false;
  for(let repeat=1;repeat<=2 && !inaccessible;repeat++) for(const item of cases) {
    const request=normalizeGenerationRequest(item);
    const core={model,instructions:buildInstructions(),input:buildStudioInput(request),truncation:'disabled',
      ...(model==='gpt-4.1-mini'?{}:{reasoning:{effort:'none'}}),
      text:{format:{type:'json_schema',name:'social_content_generation',strict:true,schema:productionOutputSchema}}};
    const row={model,case:item.id,repeat,promptSha256:createHash('sha256').update(JSON.stringify(core)).digest('hex')};
    const start=Date.now();
    try {
      row.stage='token_count';
      const count=await client.responses.inputTokens.count(core);
      row.inputTokens=count.input_tokens; assertTokenCount(row.inputTokens);
      if(reserve+callBound(model)>2)throw new Error('Evaluation reserve exhausted');
      reserve+=callBound(model);save();
      row.stage='generation';
      const response=await client.responses.create({...core,max_output_tokens:limits.outputTokens,store:false,service_tier:'default'});
      row.status=response.status;row.usage=response.usage;row.output=response.output_text;
      row.inputBoundMatched=response.usage?.input_tokens<=limits.inputTokens;
      try {row.sections=parseGenerationOutput(response.output_text,request).sections;row.validation='passed';}
      catch(e){row.validation='failed';row.validationReason=e instanceof Error?e.message:'Parser rejected';}
    }catch(e){row.status='request_failed';row.errorClass=e?.constructor?.name;row.httpStatus=e?.status;
      if([401,403,404].includes(e?.status))inaccessible=true;
    }
    row.durationMs=Date.now()-start;report.results.push(row);save();
    console.log(`${model} ${item.id} ${repeat}: ${row.status} ${row.validation??row.errorClass??''}`);
    if(inaccessible)break;
  }
}
save();
