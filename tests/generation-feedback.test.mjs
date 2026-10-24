import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './image-test-helpers.mjs';
const {generationFailure}=loadTs('lib/generation-feedback.ts');
const source='why is contentos.co not generating hashtags under posts like it was before?';

test('factual rejection identifies the failed prompt and permits only deliberate fresh retry',()=>{
 const feedback=generationFailure(source,false,'No accepted result.','unsupported_business_facts');
 assert.deepEqual(feedback,{source,refinement:false,message:'No accepted result.',uncertain:false,canStartNew:true});
});
test('unknown delivery and save uncertainty never authorize a new retry ID',()=>{
 for(const code of [undefined,'generation_save_uncertain','request_in_progress']){
  const feedback=generationFailure(source,true,'Delivery not confirmed.',code);
  assert.equal(feedback.uncertain,true);assert.equal(feedback.canStartNew,false);assert.equal(feedback.refinement,true);
 }
});
test('quota, session and storage errors do not offer another chargeable attempt',()=>{
 for(const code of ['account_changed','quota_exceeded','global_capacity_exhausted','invalid_attempt_budget'])assert.equal(generationFailure(source,false,'Blocked.',code).canStartNew,false);
 for(const code of ['invalid_generation','request_failed','request_expired','generation_timeout','generation_failed'])assert.equal(generationFailure(source,false,'Failed.',code).canStartNew,true);
});
