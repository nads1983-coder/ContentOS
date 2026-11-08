import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, imageInput, createImageHarness, PNG } from './image-test-helpers.mjs';

const { buildCreativeBrief } = loadTs('lib/image-design.ts');
const { normalizeImageRequest } = loadTs('lib/image-generation-contract.ts');
const cases = [
  'After 12 years in policing, I am changing careers. I want to bring the skills I learned listening and staying calm into my next chapter.',
  'Confidence grows through practice, small steps and learning from setbacks. Personal development is not about being perfect.',
  'Our business is planting seeds today for sustainable growth tomorrow. Patient investment in relationships matters more than quick wins.',
  'Good leadership starts with listening. Make space for your team to share ideas before deciding together.',
  'A red ceramic teapot on a wooden table beside a window.'
];
const make = (outputText, extra = {}) => normalizeImageRequest(imageInput({ mode: 'image', brandContext: {}, outputText, ...extra }));

test('provider brief retains content and asks for grounded interpretation of literal and figurative meaning', () => {
  for (const source of cases) {
    const { prompt } = buildCreativeBrief(make(source));
    assert.ok(prompt.includes(`Content to interpret (context, not text to draw): ${source}`));
    assert.match(prompt, /central message, relevant context, and relationships/);
    assert.match(prompt, /figurative language as meaning/);
    assert.match(prompt, /literal visual request, depict the requested subject directly/);
    assert.match(prompt, /Do not invent people, identities, locations, events, outcomes/);
  }
  const long = `${'Context '.repeat(160)}The decisive detail is a career change after policing.`;
  assert.ok(buildCreativeBrief(make(long)).prompt.includes('The decisive detail is a career change after policing.'));
});

test('explicit visual instructions and appearance reach the actual provider payload', async () => {
  let payload;
  const h = createImageHarness({ provider: async (_url, init) => {
    payload = JSON.parse(init.body);
    return Response.json({ data: [{ b64_json: PNG }] });
  } });
  const input = imageInput({ mode: 'image', brandContext: {}, outputText: cases[2], creativeInstructions: 'Show an abstract blue spiral, not plants.', appearance: { type: 'illustration', style: 'bold', colours: ['#123456', '#ffffff'] }, format: 'portrait' });
  const result = await h.post(input);
  assert.equal(result.response.status, 200);
  assert.ok(payload, 'image provider request captured');
  assert.equal(h.calls.filter(call => call === 'provider').length, 1);
  assert.match(payload.prompt, /Show an abstract blue spiral, not plants/);
  assert.match(payload.prompt, /Selected style: bold/);
  assert.match(payload.prompt, /Image type: illustration/);
  assert.match(payload.prompt, /hex 123456, hex ffffff/);
  assert.match(payload.prompt, /Orientation: portrait/);
  assert.match(payload.prompt, /explicit description instructions must be respected/);
  assert.equal(payload.n, 1);
  assert.equal(payload.quality, 'high');
});
