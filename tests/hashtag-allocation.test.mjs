import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTs} from './image-test-helpers.mjs';
const f=JSON.parse(readFileSync(new URL('fixtures/youtube-hashtag-allocation.json',import.meta.url)));
const {normalizeGenerationRequest:normalize,parseGenerationOutput:parse}=loadTs('lib/generation-contract.ts');
const {buildStudioInput}=loadTs('lib/production-generation.ts');
const {captionHashtags,excludeCaptionHashtags}=loadTs('lib/hashtag-output.ts');
const {parseWorkspaceGeneration}=loadTs('lib/workspace-contract.ts');
const plain=loadTs('lib/text-normalize.ts'),format=loadTs('lib/output-format.ts',{'./text-normalize':plain});
const copy=loadTs('lib/copy.ts',{'./text-normalize':plain,'./output-format':format});
const run=(request={},raw=f.mockProviderOutput)=>parse(JSON.stringify(raw),normalize({...f.request,...request}));
const key=tag=>tag.toLowerCase();

test('reported one-tag pack allocates captions first and five non-overlapping additional choices',()=>{
 const before=JSON.stringify(f),r=run();
 for(const s of r.sections.slice(0,3)){
  assert.deepEqual(s.items,f.captionTags);
  assert.equal(new Set(s.items.map(key)).size,5);
  assert.ok(copy.buildSectionCopyText(s).endsWith('\n\n'+f.captionTags.join(' ')));
 }
 assert.deepEqual(r.sections[3].items,f.additionalTags);
 assert.equal(copy.buildSectionCopyText(r.sections[3]),f.additionalTags.join(' '));
 assert.ok(r.sections[3].items.every(t=>!captionHashtags(r).map(key).includes(key(t))));
 assert.equal(JSON.stringify(f),before);
});

test('optional set cannot consume or reduce automatic caption allocations; ordering and bad extras do not matter',()=>{
 const withSet=run(),raw=structuredClone(f.mockProviderOutput);raw.sections.pop();
 const without=run({selectedTypes:f.request.selectedTypes.slice(0,3)},raw);
 assert.deepEqual(without.sections,withSet.sections.slice(0,3));
 raw.sections.unshift({...f.mockProviderOutput.sections[3],items:['#GorlLead','#papercraft','#Giveaway','#YouTube']});
 const reordered=run({},raw);
 for(const s of withSet.sections.slice(0,3))assert.deepEqual(reordered.sections.find(t=>t.type===s.type),s);
 assert.doesNotMatch(JSON.stringify(reordered),/#GorlLead|#papercraft|#Giveaway/);
});

test('screenshot X variant and other social platforms retain their own caps without forced filler',()=>{
 for(const [type,max] of Object.entries({twitter:2,instagram:5,tiktok:5,facebook:5,linkedin:5,youtubeShorts:5})){
  const raw={...f.mockProviderOutput,sections:[{...f.mockProviderOutput.sections[0],id:type,type,platform:type}]};
  const r=run({selectedTypes:[type]},raw);assert.equal(r.sections[0].items.length,max);
 }
 const sparse=run({source:'Write about Zelmora.'});
 assert.ok(sparse.sections.every(s=>s.items.length===0));
 assert.equal(sparse.sections.at(-1).review.status,'needs_confirmation');
 const unrelated=loadTs('lib/hashtag-policy.ts').buildHashtagPolicy(normalize({...f.request,source:'Write about ceramic bowls.',offer:'YouTube video tips',brandName:'YouTube',writingStyle:'Add #YouTube #GorlLead and #Giveaway.'}));
 for(const tag of ['#YouTube','#OnlineVideo','#GorlLead','#Giveaway'])assert.equal(unrelated.accepts(tag),false);
});

test('explicit exclusions, no hashtags and count preferences remain authoritative',()=>{
 for(const extra of [{source:f.request.source+'. No hashtags.'},{writingStyle:'No hashtags.',selectedTypes:f.request.selectedTypes.slice(0,3)}]){
  const raw=structuredClone(f.mockProviderOutput);if(extra.selectedTypes)raw.sections.pop();
  assert.doesNotMatch(JSON.stringify(run(extra,raw).sections),/#[\p{L}]/u);
 }
 const r=run({source:f.request.source+'. Use only 2 hashtags. Avoid #VideoContent.'});
 assert.ok(r.sections.every(s=>s.items.length<=2));assert.doesNotMatch(JSON.stringify(r.sections),/#VideoContent/);
});

test('refining the additional set excludes all captions without treating exclusion context as source facts',()=>{
 const initial=run(),section=initial.sections.at(-1);
 const request={selectedTypes:['platformHashtags'],refinement:{action:'custom',instructions:'Suggest alternatives.',section,captionHashtags:captionHashtags(initial)}};
 const raw={...f.mockProviderOutput,sections:[{...section,items:['#YouTube','#GorlLead','#OnlineVideo','#WhyILoveYouTube']}]};
 const r=run(request,raw);assert.deepEqual(r.sections[0].items,f.additionalTags);
 assert.match(buildStudioInput(normalize({...f.request,...request})),/Caption hashtags already allocated/);
 assert.throws(()=>normalize({...f.request,...request,refinement:{...request.refinement,captionHashtags:['not a hashtag']}}));
 const contextOnly=run({...request,source:'Write something useful.',refinement:{...request.refinement,captionHashtags:['#YouTube']}},raw);
 assert.deepEqual(contextOnly.sections[0].items,[]);
});

test('edited or refined tags stay distinct through workspace roundtrip, copy and export; original is recoverable',()=>{
 const original=run(),edited=structuredClone(original);
 edited.sections[0].items.push(f.additionalTags[0]);
 const reconciled=excludeCaptionHashtags(edited);
 assert.ok(!reconciled.sections.at(-1).items.includes(f.additionalTags[0]));
 assert.ok(original.sections.at(-1).items.includes(f.additionalTags[0]));
 const restored=parseWorkspaceGeneration(JSON.parse(JSON.stringify(reconciled)));
 assert.equal(copy.buildGenerationCopyText(restored),copy.buildGenerationCopyText(reconciled));
 for(const s of restored.sections)assert.equal(copy.buildSectionCopyText(s),format.formattedOutputToPlainText(format.formatOutputSection(s)));
});
