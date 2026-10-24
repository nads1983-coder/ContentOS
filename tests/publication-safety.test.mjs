import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTs} from './image-test-helpers.mjs';
const {normalizeGenerationRequest: normalize,parseGenerationOutput:parse,GenerationGroundingError}=loadTs('lib/generation-contract.ts');
const {reviewBusinessFacts:review}=loadTs('lib/business-facts.ts');
const {parseWorkspaceGeneration}=loadTs('lib/workspace-contract.ts');
const {contentTypes}=loadTs('lib/content-config.ts');
const original=JSON.parse(readFileSync(new URL('fixtures/pr7-captured-instagram.json',import.meta.url)));
const captured=JSON.parse(readFileSync(new URL('fixtures/pr7-final-acceptance-instagram.json',import.meta.url)));
const req=(extra={})=>normalize({...original.request,...extra});
const pack=body=>({title:'A moment to celebrate',summary:'A thoughtful update.',sections:[{id:'instagram',type:'instagram',platform:'Instagram',title:'Community update',body,items:[],cta:''}]});
const check=(body,extra={})=>parse(JSON.stringify(pack(body)),req(extra));

test('exact final capture is useful with the unsupported sentence omitted, not invented replacement facts',()=>{
 const before=JSON.stringify(captured),r=req();const decisions=review(captured,r);
 assert.equal(decisions.find(d=>d.field==='summary').classification,'source_supported');
 assert.equal(decisions.find(d=>d.text.includes('first newsletter')).classification,'unsupported');
 const result=parse(before,r),section=result.sections[0];
 assert.equal(section.review.status,'needs_confirmation');
 assert.match(section.review.notes.join(' '),/history was omitted/);
 assert.doesNotMatch(section.body,/newsletter/);assert.match(section.body,/We reached 1,000 subscribers!/);
 assert.match(section.body,/\[CONFIRM:/);assert.equal(JSON.stringify(captured),before);
 assert.equal(review(result,r).some(d=>d.classification==='unsupported'),false);
 assert.deepEqual(parseWorkspaceGeneration(result),result,'review state survives cloud serialization');
});

test('milestone paraphrases preserve subject quantity unit scope and factual relation',()=>{
 for(const body of ['We have reached 1k subscribers!','Northbank Paper crossed 1000 subscribers.','1,000 subscribers and giveaway announcement'])assert.equal(check(body).sections[0].review.status,'ready_to_review');
 for(const body of ['We reached 1,001 subscribers.','Northbank Paper reached 1,000 newsletter subscribers.','Our founder reached 1,000 subscribers.','We reached 1,000 subscribers per month.','We lost 1,000 subscribers.','We reached at least 1,000 subscribers.'])assert.throws(()=>check(body),GenerationGroundingError);
 for(const source of ['Northbank Paper might reach 1,000 subscribers.','Northbank Paper reached 1,000 subscribers in London.','Northbank Paper did not reach 1,000 subscribers.'])assert.throws(()=>check('We reached 1,000 subscribers!',{source}),GenerationGroundingError);
});

test('audience context never creates giveaway eligibility or authorizes arbitrary summary claims',()=>{
 for(const summary of ['Instagram caption announcing Northbank Paper reaching 1,000 subscribers and a giveaway for independent makers.','Instagram caption for Northbank Paper hitting 1,000 subscribers and launching a giveaway, speaking to independent makers.']){
  const value=pack('Every big milestone deserves a moment.');value.summary=summary;assert.doesNotThrow(()=>parse(JSON.stringify(value),req()));
 }
 for(const text of ['The giveaway is only for independent makers.','Only independent makers are eligible for the giveaway.','We reached 1,000 subscribers and a giveaway for independent makers.'])assert.throws(()=>check(text),GenerationGroundingError);
 const value=pack('A moment to reflect.');value.summary=captured.summary.replace('1,000','10,000');assert.throws(()=>parse(JSON.stringify(value),req()),GenerationGroundingError);
 value.summary=captured.summary.replace('independent makers','doctors');assert.throws(()=>parse(JSON.stringify(value),req()),GenerationGroundingError);
});

test('channel existence is not first-publication history, frequency, dates or subscriber source',()=>{
 for(const channel of ['newsletter','email list','podcast','youtube channel','blog']){
  const claim=`Thank you for being here since our first ${channel}.`;
  const result=check(`Every big milestone deserves a moment.\n${claim}`);
  assert.doesNotMatch(result.sections[0].body,/since our first/);assert.equal(result.sections[0].review.status,'needs_confirmation');
  assert.equal(check(claim,{source:claim}).sections[0].body,claim);
  const offer=`We publish a ${channel}.`;
  assert.doesNotMatch(check(`Every big milestone deserves a moment. ${claim}`,{offer}).sections[0].body,/first/);
 }
 assert.equal(check('Thank you for reading our newsletter.',{source:'Northbank Paper publishes a newsletter.'}).sections[0].review.status,'ready_to_review');
 assert.equal(check('Thank you for reading our newsletter.',{source:'We publish a newsletter.'}).sections[0].body,'Thank you for reading our newsletter.');
 for(const claim of ['Our weekly newsletter is a pleasure to write.','Our monthly newsletter keeps you informed.']) {
  const result=check(`A moment to reflect. ${claim}`,{offer:'We publish a newsletter.'});
  assert.doesNotMatch(result.sections[0].body,/newsletter/);assert.equal(result.sections[0].review.status,'needs_confirmation');
 }
 const contradicted=check('A moment to reflect. Thank you for reading our newsletter.',{source:'We no longer publish a newsletter.',offer:'We publish a newsletter.'});
 assert.doesNotMatch(contradicted.sections[0].body,/reading/);
});

test('source-authored founder paraphrases preserve relationships; preferences and refinement are not evidence',()=>{
 const story='Northbank Paper started in an attic in 2021.';
 assert.equal(check('We started in an attic in 2021.',{source:story}).sections[0].body,'We started in an attic in 2021.');
 assert.throws(()=>check('We started in an attic in 2020.',{source:story}),GenerationGroundingError);
 for(const extra of [{audience:'We publish a newsletter.'},{writingStyle:'We publish a newsletter.'},{contentGoal:'We publish a newsletter.'},{refinement:{action:'custom',instructions:'Make this warmer. We publish a newsletter.',section:pack('We publish a newsletter.').sections[0]}}]){
  const result=check('A moment to reflect. Thank you for reading our newsletter.',extra);assert.doesNotMatch(result.sections[0].body,/newsletter/);
 }
 for(const body of ['Every big milestone deserves a moment.','Imagine a newsletter full of fresh ideas.','A newsletter can help you organise your thoughts.','A little pause. A big thank-you.'])assert.equal(check(body).sections[0].body,body);
});

test('all formats remove complete unsupported channel sentences and preserve confirmation metadata',()=>{
 for(const {id} of contentTypes){
  const value=pack('A moment worth marking. Thank you for being here since our first newsletter.');value.sections[0].type=id;
  const result=parse(JSON.stringify(value),req({selectedTypes:[id]}));
  assert.doesNotMatch(result.sections[0].body,/newsletter/);assert.equal(result.sections[0].review.status,'needs_confirmation');
  assert.deepEqual(parseWorkspaceGeneration(result).sections[0].review,result.sections[0].review);
 }
 const value=pack('A moment worth marking. Thank you for being here since our first newsletter.');
 value.sections=contentTypes.map(({id})=>({...value.sections[0],id,type:id}));
 const all=parse(JSON.stringify(value),req({selectedTypes:contentTypes.map(t=>t.id)}));
 assert.equal(all.sections.length,14);
 assert.ok(all.sections.every(s=>s.review.status==='needs_confirmation' && !s.body.includes('newsletter')));
});

test('omission cannot hide adjacent high-risk facts, exhaust coverage or smuggle forged review status',()=>{
 assert.throws(()=>check('Our newsletter is award-winning.'),GenerationGroundingError);
 assert.throws(()=>check('Since our first newsletter, our sales increased by 50%.'),GenerationGroundingError);
 assert.throws(()=>check(Array.from({length:9},(_,i)=>`Our first newsletter issue ${i} was memorable.`).join('\n')),GenerationGroundingError);
 const value=pack('A moment worth marking. Thank you for reading our newsletter.');value.sections[0].review={status:'ready_to_review',notes:[]};
 assert.equal(parse(JSON.stringify(value),req()).sections[0].review.status,'needs_confirmation');
 assert.equal(check('A moment worth marking.\n[CONFIRM: deadline]').sections[0].review.status,'needs_confirmation');
 value.sections.unshift({...pack('A useful reflection.').sections[0],id:'unrequested',type:'linkedin'});
 assert.equal(parse(JSON.stringify(value),req()).sections[0].review.status,'needs_confirmation','normalization must not detach omission notes from their asset');
});
