import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './image-test-helpers.mjs';
const { normalizeGenerationRequest, parseGenerationOutput, GenerationGroundingError } = loadTs('lib/generation-contract.ts');
const { reviewBusinessFacts } = loadTs('lib/business-facts.ts');
const source = "I'm thinking about changing careers, but I'm worried about starting again after 12 years in the same job.";
const request = normalizeGenerationRequest({ source, selectedTypes: ['linkedin'] });
const output = body => ({title:'A new chapter',summary:'A career reflection.',sections:[{id:'linkedin',type:'linkedin',title:'A new chapter',platform:'LinkedIn',body,items:[],cta:''}]});
test('career input: supported paraphrase, exact fact and creative reflection pass', () => {
  const paraphrase = 'I spent 12 years in the same job, and I am considering a career change.';
  assert.equal(reviewBusinessFacts(output(paraphrase),request).find(x=>x.category==='high_risk').classification, 'source_supported');
  assert.doesNotThrow(() => parseGenerationOutput(JSON.stringify(output(paraphrase)), request));
  assert.doesNotThrow(() => parseGenerationOutput(JSON.stringify(output("I have spent 12 years in the same job and I'm thinking about changing careers.")), request));
  assert.doesNotThrow(() => parseGenerationOutput(JSON.stringify(output(source)),request));
  assert.doesNotThrow(() => parseGenerationOutput(JSON.stringify(output('Changing careers can feel daunting.')),request));
});
test('invented career history and business claims remain rejected', () => {
  for (const body of ['I worked as a teacher before changing careers.', 'We started this business in our attic three years ago.', 'I spent 13 years in the same job, and I am considering a career change.', "I have spent 13 years in the same job and I'm thinking about changing careers.", 'I spent 12 years in the same job as a teacher, and I am considering a career change.', 'I spent 12 years in the same job at Acme, and I am considering a career change.', 'I spent 12 years in the same job, and I am considering a career change after earning a certification.', 'I spent 12 years in the same job, and I am not considering a career change.']) {
    assert.throws(() => parseGenerationOutput(JSON.stringify(output(body)),request), GenerationGroundingError);
  }
});

test('negated and different source contexts never establish career evidence', () => {
  const paraphrase = 'I spent 12 years in the same job, and I am considering a career change.';
  for (const source of ["I'm not thinking about changing careers, but I'm worried about starting again after 12 years in the same job.", "I'm thinking about changing careers, but I'm worried about starting again after 12 years in a different job.", "She spent 12 years in the same job."]) {
    assert.throws(() => parseGenerationOutput(JSON.stringify(output(paraphrase)), normalizeGenerationRequest({source,selectedTypes:['linkedin']})), GenerationGroundingError);
  }
});
