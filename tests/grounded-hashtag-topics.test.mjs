import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTs} from './image-test-helpers.mjs';
const fixtures=JSON.parse(readFileSync(new URL('fixtures/grounded-hashtag-topics.json',import.meta.url)));
const {normalizeGenerationRequest:normalize,parseGenerationOutput:parse}=loadTs('lib/generation-contract.ts');
const {buildHashtagPolicy}=loadTs('lib/hashtag-policy.ts');
const {buildStudioInput}=loadTs('lib/production-generation.ts');
const {captionHashtags}=loadTs('lib/hashtag-output.ts');
const {parseWorkspaceGeneration}=loadTs('lib/workspace-contract.ts');
const {cleanGenerationResult}=loadTs('lib/storage.ts');
const plain=loadTs('lib/text-normalize.ts'),format=loadTs('lib/output-format.ts',{'./text-normalize':plain});
const copy=loadTs('lib/copy.ts',{'./text-normalize':plain,'./output-format':format});
export function fixtureInput(f,extra={}){return normalize({source:f.source,selectedTypes:[...f.platforms,'platformHashtags'],tone:'friendly',ctaMode:'none',brandName:'Gorl Lead',offer:'Free competition.',writingStyle:'Warm. Add #GorlLead and #papercraft.',...extra});}
export function fixtureOutput(f){return {title:'A thought to share',summary:'A personal reflection.',sections:[...f.platforms.map(type=>({id:type,type,platform:type,title:'Caption',body:f.body,items:f.captionCandidates,cta:''})),{id:'platformHashtags',type:'platformHashtags',platform:'General',title:'Additional hashtags',body:'[CONFIRM: Add a specific subject before choosing relevant hashtags.]',items:f.additionalCandidates,cta:''}]};}
const run=(f,extra={},raw=fixtureOutput(f))=>parse(JSON.stringify(raw),fixtureInput(f,extra));

test('three reported topics: automatic caption allocation, distinct extras, no misleading confirmation',()=>{
 for(const f of fixtures.examples){
  const before=JSON.stringify(f),r=run(f),caption=r.sections.slice(0,-1),additional=r.sections.at(-1);
  for(const s of caption){
   assert.ok(s.items.length>=3&&s.items.length<=5,f.id);
   assert.equal(new Set(s.items.map(t=>t.toLowerCase())).size,s.items.length);
   assert.ok(copy.buildSectionCopyText(s).endsWith('\n\n'+s.items.join(' ')));
  }
  assert.ok(additional.items.every(t=>!captionHashtags(r).map(t=>t.toLowerCase()).includes(t.toLowerCase())));
  assert.equal(new Set(additional.items).size,additional.items.length);
  if(f.id!=='hashtag-effectiveness')assert.equal(additional.items.length,5);
  assert.doesNotMatch(JSON.stringify(r),/\[CONFIRM:|#(?:Hashtags|GorlLead|papercraft|Giveaway|LEDStripLights)\b/);
  const without=fixtureOutput(f);without.sections.pop();
  assert.deepEqual(run(f,{selectedTypes:f.platforms},without).sections,caption);
  assert.equal(JSON.stringify(f),before);
 }
});

test('unfamiliar topics have lexical fallback without a topic dictionary or model tags',()=>{
 for(const [source,body,tags] of [
  ['Why I enjoy coastal birdwatching.','Coastal birdwatching is a welcome pause.',['#CoastalBirdwatching','#Birdwatching']],
  ['Write about restoring vintage radios.','Vintage radios invite a closer look.',['#VintageRadios','#Radios']],
  ['I enjoy miniature railway photography.','Miniature railway photography is a different perspective.',['#MiniatureRailwayPhotography','#RailwayPhotography']],
  ['Why do I love the different coloured lights in my room?','Room lighting and coloured lights.',['#RoomLighting','#ColouredLights']]
 ]){
  const f={source,body,platforms:['instagram','linkedin','tiktok'],captionCandidates:[],additionalCandidates:[]};
  const r=run(f);for(const s of r.sections.slice(0,-1)){for(const tag of tags)assert.ok(s.items.includes(tag),`${source}: ${s.items}`);assert.ok(s.items.length<=5);}
  assert.doesNotMatch(JSON.stringify(r),/\[CONFIRM:/);
 }
});

test('inflections and case survive; unsupported caption nouns cannot become hashtag evidence',()=>{
 const f=fixtures.examples[2],p=buildHashtagPolicy(fixtureInput(f),['LED strips, gaming, therapy, luxury and guaranteed sleep.']);
 for(const tag of ['#roomlighting','#RoomLighting','#ColoredLights','#ColourfulLighting','#LightingIdeas'])assert.equal(p.accepts(tag),true,tag);
 for(const tag of ['#LEDStrips','#GamingRoom','#LightTherapy','#LuxuryRoom','#GuaranteedSleep','#LightingGiveaway','#GorlLead','#papercraft','#Room50PercentOff'])assert.equal(p.accepts(tag),false,tag);
 const sparse=run({...f,source:'Write something useful.'});assert.ok(sparse.sections.every(s=>s.items.length===0));
 assert.doesNotMatch(buildStudioInput(fixtureInput(f)),/#GorlLead|#papercraft/);
 assert.match(buildStudioInput(fixtureInput(f)),/#ColouredLights/);
 const negative=buildHashtagPolicy(fixtureInput(f,{source:'Write about coastal birdwatching. Do not discuss vintage radios.'}),['Vintage radios and birdwatching.']);
 assert.equal(negative.accepts('#VintageRadios'),false);
 const domain=buildHashtagPolicy(fixtureInput(f,{source:'Write a post about plan.com.'}),['An earlier draft about plan.com.']);
 assert.deepEqual(domain.suggestions('linkedin'),[],'a domain must not become a common-word fallback');
});

test('platform caps, explicit no-hashtag instructions and exclusions survive fallback',()=>{
 const f=fixtures.examples[2];
 for(const [type,limit] of Object.entries({facebook:5,linkedin:5,youtubeShorts:5,instagram:5,tiktok:5,twitter:2})){
  const single={...f,platforms:[type]},r=run(single);assert.equal(r.sections[0].items.length,limit);
  const none=run(single,{source:f.source+' No hashtags.'});assert.ok(none.sections.every(s=>s.items.length===0));
  const exclude=run(single,{source:f.source+' Use only 2 hashtags. Avoid #RoomLighting.'});assert.ok(exclude.sections.every(s=>s.items.length<=2));assert.doesNotMatch(JSON.stringify(exclude.sections),/#RoomLighting\b/);
 }
});

test('refinement, storage, formatter, clipboard text and export share final tags',()=>{
 for(const f of fixtures.examples){
  const initial=run(f),s=initial.sections[0];
  const refined=run(f,{selectedTypes:[s.type],refinement:{action:'custom',instructions:'Make it warmer.',section:s}},{...fixtureOutput(f),sections:[{...s,items:['#GorlLead','#papercraft']}]});
  assert.deepEqual(refined.sections[0].items,s.items);
  const restored=parseWorkspaceGeneration(JSON.parse(JSON.stringify(cleanGenerationResult(initial))));
  assert.equal(copy.buildGenerationCopyText(restored),copy.buildGenerationCopyText(initial));
  for(const section of restored.sections)assert.equal(copy.buildSectionCopyText(section),format.formattedOutputToPlainText(format.formatOutputSection(section)));
 }
});
