import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './image-test-helpers.mjs';
const { suggestImageDescription } = loadTs('lib/image-prefill.ts');
const { buildCreativeBrief } = loadTs('lib/image-design.ts');
const { imageInput } = await import('./image-test-helpers.mjs');

test('suggestions draw on later meaning and keep relationships grounded in the post', () => {
  const examples = [
    ['After twelve years in policing, I am changing careers. It was a difficult decision. My next chapter brings the skills I learned listening and staying calm into a new career.', /career|policing/i, /skills/i],
    ['Leadership is not about having every answer. Good leadership starts with listening to your team. Make space for their ideas before deciding together.', /leadership/i, /listening|ideas/i],
    ['Our business is planting seeds today for sustainable growth tomorrow. Patient investment in relationships matters more than quick wins.', /seeds|growth/i, /relationships|investment/i]
  ];
  for (const [post, ...patterns] of examples) {
    const suggestion = suggestImageDescription(post);
    assert.ok(suggestion.length <= 500);
    for (const pattern of patterns) assert.match(suggestion, pattern);
    assert.match(suggestion, /^(?:A conceptual visual|A visual metaphor)/);
    assert.ok(suggestion.length < 180);
    assert.notEqual(suggestion, post);
  }
});

test('empty posts clear the suggestion and separate posts never reuse prior content', () => {
  assert.equal(suggestImageDescription('  #OnlyTags  '), '');
  const a = suggestImageDescription('Leadership begins with listening to the team.');
  const b = suggestImageDescription('A career change brings new opportunities.');
  assert.match(a, /leadership/i); assert.doesNotMatch(b, /leadership/i);
});

test('edited instructions remain explicit direction alongside source context', () => {
  const post = 'Leadership starts with listening to your team.';
  const brief = buildCreativeBrief(imageInput({ outputText: post, creativeInstructions: 'Show an abstract blue spiral.', brandContext: {} }));
  assert.match(brief.prompt, /Content to interpret.*Leadership starts/);
  assert.match(brief.prompt, /Creative direction.*Show an abstract blue spiral/);
});

test('framing respects explicit close-ups and supporting text remains complete or omitted', () => {
  const source = 'A new direction.\n\nA complete thought. ' + 'This supporting sentence is deliberately much too long '.repeat(4);
  const mixed = buildCreativeBrief(imageInput({ mode: 'mixed', outputText: source, creativeInstructions: 'An intentional close-up portrait.', brandContext: {} }));
  assert.equal(mixed.design.body, 'A complete thought.');
  assert.match(mixed.prompt, /Unless a close-up or artistic crop is explicitly requested/);
  assert.match(mixed.prompt, /Respect explicitly requested crops/);
  assert.match(mixed.prompt, /An intentional close-up portrait/);
  const long = buildCreativeBrief(imageInput({ mode: 'mixed', outputText: 'A headline.\n\n' + 'An unfinished long sentence '.repeat(8), creativeInstructions: '', brandContext: {} }));
  assert.equal(long.design.body, '');
  const fragment = buildCreativeBrief(imageInput({ mode: 'mixed', outputText: 'A headline.\n\nA sentence that trails off', creativeInstructions: '', brandContext: {} }));
  assert.equal(fragment.design.body, '');
  const image = buildCreativeBrief(imageInput({ mode: 'image', outputText: source, creativeInstructions: 'No text', brandContext: {} }));
  assert.equal(image.design.body, '');
  const quote = buildCreativeBrief(imageInput({ mode: 'text', outputText: source, creativeInstructions: 'Quote: “Small steps matter.”', brandContext: {} }));
  assert.equal(quote.design.headline, '“Small steps matter.”');
});
