import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './image-test-helpers.mjs';
const {normalizeGenerationRequest:normalize,parseGenerationOutput:parse}=loadTs('lib/generation-contract.ts');
const {buildHashtagPolicy}=loadTs('lib/hashtag-policy.ts');
const source="I'm struggling to stay consistent with my goals, and I keep giving up when I don't see results quickly.";
const tags=['#Consistency','#PersonalDevelopment','#GrowthMindset'];
function generate(sourceText=source,items=tags,types=['linkedin','platformHashtags']) {
 const request=normalize({source:sourceText,selectedTypes:types,ctaMode:'none'});
 const sections=types.map(type=>({id:type,type,platform:type,title:type==='linkedin'?'A reflection':'Hashtags',body:type==='linkedin'?'Progress can take time.':'',items,cta:''}));
 return {request,result:parse(JSON.stringify({title:'A reflection',summary:'A thought to share.',sections}),request)};
}
test('goal-consistency hashtags survive the provider response and final output',()=>{
 const {request,result}=generate();
 assert.deepEqual(request.selectedTypes,['linkedin','platformHashtags']);
 assert.equal(buildHashtagPolicy(request).enabled,true);
 assert.deepEqual(result.sections[0].items,tags);
 assert.equal(result.sections[1].items.length,0,'additional set stays distinct from caption');
 const empty=generate(source,[]).result;assert.deepEqual(empty.sections[0].items,tags);
});
test('no hashtags and explicit exclusions or user tags remain authoritative',()=>{
 assert.deepEqual(generate(source+' No hashtags.').result.sections[0].items,[]);
 const excluded=generate(source+' Avoid #Consistency.').result.sections[0].items;
 assert.ok(!excluded.includes('#Consistency')); assert.ok(excluded.includes('#PersonalDevelopment'));
 assert.ok(generate(source+' Use #MyGoals.',[]).result.sections[0].items.includes('#MyGoals'));
});
test('topic inference is narrow and platform caps remain intact',()=>{
 for(const type of ['linkedin','instagram','facebook','twitter']) {
  const {result}=generate(source,tags,[type]);assert.ok(result.sections[0].items.length<=(type==='twitter'?2:5));
 }
 const p=buildHashtagPolicy(normalize({source:'A reliable thermostat keeps temperature consistent.',selectedTypes:['linkedin']}));
 assert.equal(p.accepts('#PersonalDevelopment'),false);assert.equal(p.accepts('#GrowthMindset'),false);
 const unrelated=buildHashtagPolicy(normalize({source:'The thermostat keeps temperature consistent. My goals are to sell thermostats.',selectedTypes:['linkedin']}));
 assert.equal(unrelated.accepts('#Consistency'),false);assert.equal(unrelated.accepts('#PersonalDevelopment'),false);assert.equal(unrelated.accepts('#GrowthMindset'),false);
});
