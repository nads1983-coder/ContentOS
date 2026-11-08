import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './image-test-helpers.mjs';
const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse, GenerationGroundingError } = loadTs('lib/generation-contract.ts');
const { buildInstructions } = loadTs('lib/prompts.ts');
const { buildHashtagPolicy } = loadTs('lib/hashtag-policy.ts');
const source = "I'm thinking about changing careers, but I'm worried about starting again after 12 years in the same job.";
const section = (type, body, items=[]) => ({id:type,type,platform:type,title:'A reflection',body,items,cta:''});
const run = (input, type, body, items=[]) => parse(JSON.stringify({title:'A reflection',summary:'A thought to share.',sections:[section(type,body,items)]}), normalize({source:input,selectedTypes:[type],tone:'friendly',ctaMode:'none'}));
test('career example filters fragments and duplicate concepts on social platforms', () => {
 for (const type of ['linkedin','instagram','facebook']) {
  const r=run(source,type,'A career change can feel daunting.', ['#12Years','#StartingAgainAfter','#ChangingCareers','#AgainAfter','#SameJob','#againafter','#startingagainafter']);
  const tags=r.sections[0].items;
  assert.doesNotMatch(tags.join(' '),/#12Years|#StartingAgainAfter|#AgainAfter|#SameJob/i);
  assert.ok(tags.some(t=>/careerchange|changingcareers|careertransition/i.test(t)));
  assert.equal(tags.filter(t=>/careerchange|changingcareers|careertransition/i.test(t)).length,1);
 }
});
test('everyday topics use grounded concepts and explicit no hashtags wins', () => {
 for(const [input,tag] of [['Building confidence.','#BuildingConfidence'],['Promoting a small business.','#SmallBusiness'],['Sharing a professional achievement.','#ProfessionalAchievement'],['Announcing a product.','#ProductAnnouncement']]) {
  for(const type of ['linkedin','instagram','facebook']) {
   const policy=buildHashtagPolicy(normalize({source:input,selectedTypes:[type]}));
   assert.ok(policy.suggestions(type).includes(tag));
   assert.equal(buildHashtagPolicy(normalize({source:input+' No hashtags.',selectedTypes:[type]})).enabled,false);
  }
 }
 const plain=run('The office is closed on Monday.','facebook','The office is closed on Monday.');
 assert.doesNotMatch(JSON.stringify(plain),/#(?:Giveaway|Sale|Award)/i);
});
test('prompt asks for varied grounded hooks and endings without extra calls', () => {
 const instructions=buildInstructions();
 assert.match(instructions,/do not force a question or drama/i);
 assert.match(instructions,/generic engagement bait/i);
 assert.match(instructions,/do not join arbitrary words/i);
 assert.match(instructions,/Never invent business origins/i);
 assert.throws(()=>run(source,'linkedin','I worked as a teacher before changing careers.'),GenerationGroundingError);
});
