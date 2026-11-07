import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, imageInput } from './image-test-helpers.mjs';
const { selectSourceQuote } = loadTs('lib/quote-selection.ts');
const { buildCreativeBrief, normaliseDesign, renderDesignSvg } = loadTs('lib/image-design.ts');
const { normalizeImageRequest } = loadTs('lib/image-generation-contract.ts');

test('selects complete source wording instead of dependent replies and metaphors', () => {
  const source = "I didn't. Consistent practice builds creative confidence. Keep watering the seed.";
  assert.equal(selectSourceQuote(source), 'Consistent practice builds creative confidence.');
  assert.equal(selectSourceQuote('Rest matters.'), 'Rest matters.');
  assert.equal(selectSourceQuote('Keep watering the seed.'), '');
});

test('explicit quotations retain punctuation and Unicode, with SVG-safe escaping', () => {
  const quote = '“Don’t erase #1: café & <hope>.”';
  const input = normalizeImageRequest(imageInput({ brandContext: {}, mode: 'text', outputText: 'A post.', creativeInstructions: `Quote: ${quote}` }));
  const design = buildCreativeBrief(input).design;
  assert.equal(design.headline, quote);
  assert.equal(normaliseDesign(design).headline, quote);
  const svg = renderDesignSvg(design, 1080, 1080);
  assert.match(svg, /café &amp; &lt;hope&gt;/);
  assert.doesNotMatch(svg, /<hope>/);
  const combined = normalizeImageRequest(imageInput({ brandContext: {}, mode: 'text', outputText: 'A post.', creativeInstructions: 'Quote: An ending. Brand: Example' }));
  assert.equal(buildCreativeBrief(combined).design.headline, 'An ending.');
});

test('long explicit quotations are rejected without clipping input', () => {
  const quote = 'A'.repeat(121);
  const input = imageInput({ brandContext: {}, creativeInstructions: `Quote: ${quote}` });
  assert.throws(() => normalizeImageRequest(input), /120 characters or fewer/);
  assert.equal(input.creativeInstructions, `Quote: ${quote}`);
});

test('explicit quote and headline take precedence over automatic selection', () => {
  for (const label of ['Quote', 'Headline']) {
    const brief = buildCreativeBrief(normalizeImageRequest(imageInput({ brandContext: {}, outputText: 'Consistent practice builds creative confidence.', creativeInstructions: `${label}: A fresh perspective` })));
    assert.equal(brief.design.headline, 'A fresh perspective');
  }
});
