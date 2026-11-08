import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './image-test-helpers.mjs';
const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse } = loadTs('lib/generation-contract.ts');
const cases = [
 ["I'm proud of myself for finally starting my own business.", ['#OwnBusiness','#Proud','#Starting','#FinallyStarting','#Myself'], ['#Entrepreneurship','#StartingABusiness','#SmallBusinessJourney']],
 ["I'm thinking about changing careers after 12 years in the same job.", ['#12Years','#StartingAgainAfter','#AgainAfter','#SameJob'], ['#CareerChange']],
 ['I want to become a better leader by listening to my team.', ['#ListeningToMy'], ['#Leadership','#PeopleManagement']],
 ["I've been working on my confidence.", ['#BeenWorking','#MyConfidence'], ['#Confidence','#PersonalDevelopment']],
 ['Building a business takes patience and strong customer relationships.', ['#BusinessTakes','#StrongCustomer'], ['#BusinessGrowth','#CustomerRelationships']]
];
function run(source,items=[],type='linkedin') {
 const req=normalize({source,selectedTypes:[type],ctaMode:'none'});
 const raw={title:'A reflection',summary:'A thought to share.',sections:[{id:type,type,title:'A reflection',platform:type,body:'A thought to share.',items,cta:''}]};
 return parse(JSON.stringify(raw),req).sections[0].items;
}
test('ordinary briefs yield topic concepts rather than awkward source fragments',()=>{
 for(const [source,bad,wanted] of cases) for(const type of ['linkedin','instagram','facebook']) {
  const tags=run(source,bad,type);
  for(const tag of wanted) assert.ok(tags.includes(tag),`${source}: ${tags}`);
  for(const tag of bad) assert.ok(!tags.includes(tag),`${source}: ${tags}`);
  assert.ok(tags.length<=5); assert.equal(new Set(tags.map(t=>t.toLowerCase())).size,tags.length);
 }
});
test('unfamiliar subjects keep grounded model tags, but no tags are manufactured',()=>{
 assert.deepEqual(run('Write about restoring vintage radios.',[]),[]);
 assert.ok(run('Write about restoring vintage radios.',['#VintageRadios']).includes('#VintageRadios'));
 assert.deepEqual(run('Write about a niche hobby.',[]),[]);
});
test('explicit tags and no-hashtag instructions remain authoritative',()=>{
 assert.ok(run('Starting my own business. Use #Myself and #12Years.',[]).includes('#Myself'));
 assert.ok(run('Starting my own business. Use #Myself and #12Years.',[]).includes('#12Years'));
 assert.doesNotMatch(run('Starting my own business.',['#finallystarting','#ownbusiness','#myself','#UnrelatedBrand']).join(' '), /finallystarting|ownbusiness|myself|UnrelatedBrand/i);
 assert.deepEqual(run('Starting my own business. No hashtags.',['#Entrepreneurship']),[]);
});
test('case variants of fragments and duplicate career concepts do not survive',()=>{
 const tags=run(cases[1][0],['#againafter','#startingagainafter','#ChangingCareers','#ChangingCareers']);
 assert.doesNotMatch(tags.join(' '),/againafter/i);
 assert.equal(tags.filter(t=>/^(?:#careerchange|#careertransition|#changingcareers)$/i.test(t)).length,1);
});
