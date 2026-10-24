import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./image-test-helpers.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/hashtag-effectiveness.json", import.meta.url)));
const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse } = loadTs("lib/generation-contract.ts");
const { buildStudioInput } = loadTs("lib/production-generation.ts");
const { buildHashtagPolicy, hashtagChoice } = loadTs("lib/hashtag-policy.ts");
const { parseWorkspaceGeneration } = loadTs("lib/workspace-contract.ts");
const plain = loadTs("lib/text-normalize.ts");
const format = loadTs("lib/output-format.ts", { "./text-normalize": plain });
const copy = loadTs("lib/copy.ts", { "./text-normalize": plain, "./output-format": format });
const request = extra => normalize({ ...fixture.request, ...extra });
const run = (extra = {}, output = fixture.mockProviderOutput) => parse(JSON.stringify(output), request(extra));

test("exact production question with additional Hashtags repairs empty caption and generic-only set locally", () => {
  const original = JSON.stringify(fixture);
  const result = run();
  assert.deepEqual(result.sections[0].items, fixture.expectedLinkedIn);
  assert.equal(result.sections[0].body, fixture.mockProviderOutput.sections[0].body);
  assert.equal(result.sections[1].items.length, 6);
  assert.equal(result.sections[1].items[0], `LinkedIn: ${fixture.expectedLinkedIn.join(" ")}`);
  assert.doesNotMatch(JSON.stringify(result), /#(?:Hashtags|GorlLead|papercraft|FreeCompetition)\b/i);
  assert.equal(result.sections[1].review.status, "ready_to_review");
  assert.equal(JSON.stringify(fixture), original, "original evidence is immutable");
});

test("prompt and validator share meaningful candidates, not format-label or saved-brand tags", () => {
  const input = buildStudioInput(request());
  assert.match(input, /meaningful suggestions explicitly requested/);
  for (const tag of fixture.expectedLinkedIn) {
    assert.ok(input.includes(tag));
    assert.equal(buildHashtagPolicy(request()).accepts(tag), true);
  }
  assert.doesNotMatch(input, /#GorlLead|#papercraft|Entries close Friday/);
  assert.equal(buildHashtagPolicy(request()).accepts("#Hashtags"), false);
  for (const tag of ["#Giveaway", "#FreeCompetition", "#MillionFollowers", "#GuaranteedGrowth"]) assert.equal(buildHashtagPolicy(request()).accepts(tag), false);
});

test("questions and educational topics are not no-hashtag instructions; explicit exclusions always win", () => {
  for (const text of [fixture.request.source, "Why should I avoid hashtags?", "Explain posts without hashtags.", "Discuss why no hashtags appear on my posts.", "How do hashtags work on social posts?"]) {
    assert.notEqual(hashtagChoice(text), false, text);
  }
  for (const text of ["No hashtags.", "Please omit hashtags.", "Do not include any hashtags.", "Don't add hashtags.", "Use zero hashtags.", "Write a LinkedIn post without hashtags.", "Conversational, no hashtags."]) {
    assert.equal(hashtagChoice(text), false, text);
    const result = run({ source: fixture.request.source + " " + text });
    assert.doesNotMatch(JSON.stringify(result.sections), /#[\p{L}]/u);
    assert.equal(result.sections[1].body, "Hashtags omitted as requested.");
  }
  assert.deepEqual(run({ writingStyle: "No hashtags." }).sections[0].items, fixture.expectedLinkedIn, "current format selection overrides saved preference");
  const output = structuredClone(fixture.mockProviderOutput); output.sections = [output.sections[0]];
  output.sections[0].items = fixture.expectedLinkedIn;
  assert.deepEqual(run({ selectedTypes: ["linkedin"] }, output).sections[0].items, fixture.expectedLinkedIn);
  assert.deepEqual(run({ selectedTypes: ["linkedin"], writingStyle: "No hashtags." }, output).sections[0].items, []);
});

test("only a relevant subject authorizes social strategy candidates, not a selected platform or Hashtags label", () => {
  const result = run({ source: "Write something useful." });
  assert.equal(result.sections[1].review.status, "needs_confirmation");
  assert.match(result.sections[1].body, /\[CONFIRM:/);
  assert.deepEqual(result.sections[1].items, []);
  assert.doesNotMatch(JSON.stringify(result), /#Hashtags\b|#LinkedInTips/);
  const unrelated = buildHashtagPolicy(request({ source: "Our ceramic bowls are blue. Include hashtags." }));
  for (const tag of fixture.expectedLinkedIn) assert.equal(unrelated.accepts(tag), false);
  const explicit = run({ source: "Why are hashtags not working on my posts? Include only 2 hashtags. Avoid #LinkedInGrowth." });
  assert.equal(explicit.sections[0].items.length, 2);
  assert.doesNotMatch(JSON.stringify(explicit.sections), /#LinkedInGrowth/);
});

test("all social platforms get bounded relevant sets; single format and all fourteen format routing remain valid", () => {
  const { contentTypes } = loadTs("lib/content-config.ts");
  const max = { linkedin: 5, instagram: 5, tiktok: 5, facebook: 3, youtubeShorts: 3, twitter: 2 };
  for (const [type, maximum] of Object.entries(max)) {
    const raw = structuredClone(fixture.mockProviderOutput);
    Object.assign(raw.sections[0], { type, id: type, platform: type });
    const result = run({ selectedTypes: [type, "platformHashtags"] }, raw);
    assert.ok(result.sections[0].items.length >= 2);
    assert.ok(result.sections[0].items.length <= maximum);
    assert.doesNotMatch(result.sections[0].items.join(" "), type === "linkedin" ? /#GorlLead/ : /#LinkedIn/);
  }
  const raw = structuredClone(fixture.mockProviderOutput);
  raw.sections = contentTypes.map(({ id }) => ({ ...raw.sections[0], id, type: id, platform: id, items: ["#Hashtags"] }));
  const result = run({ selectedTypes: contentTypes.map(t => t.id) }, raw);
  assert.equal(result.sections.length, 14);
  assert.doesNotMatch(JSON.stringify(result), /#Hashtags\b/);
  const only = run({ selectedTypes: ["platformHashtags"] }, { ...fixture.mockProviderOutput, sections: [fixture.mockProviderOutput.sections[1]] });
  assert.equal(only.sections[0].items.length, 6);
});

test("refinement retains requested subject tags without treating old unsupported tags as evidence", () => {
  const accepted = run().sections[0];
  const raw = { ...fixture.mockProviderOutput, sections: [{ ...fixture.mockProviderOutput.sections[0], items: ["#GorlLead", "#Hashtags"] }] };
  const refinement = { action: "custom", instructions: "Make it shorter.", section: { ...accepted, items: [...accepted.items, "#papercraft"] } };
  assert.deepEqual(run({ selectedTypes: ["linkedin"], refinement }, raw).sections[0].items, fixture.expectedLinkedIn);
  assert.deepEqual(run({ selectedTypes: ["linkedin"], refinement: { ...refinement, instructions: "Remove hashtags." } }, raw).sections[0].items, []);
});

test("caption and separate sets survive display, clipboard serialization, save/restore and export", async () => {
  const result = run(), restored = parseWorkspaceGeneration(JSON.parse(JSON.stringify(result)));
  for (const section of restored.sections) {
    assert.equal(copy.buildSectionCopyText(section), format.formattedOutputToPlainText(format.formatOutputSection(section)));
    assert.equal(copy.buildSectionCopyText(section), copy.buildSectionCopyText(result.sections.find(s => s.type === section.type)));
  }
  const text = copy.buildGenerationCopyText(restored);
  assert.ok(copy.buildSectionCopyText(restored.sections[0]).endsWith(fixture.expectedLinkedIn.join(" ")));
  assert.match(copy.buildSectionCopyText(restored.sections[1]), /LinkedIn:/);
  let clipboard;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async value => { clipboard = value; } } } });
  try { await copy.copyPlainText(text); } finally { if (previous) Object.defineProperty(globalThis, "navigator", previous); else delete globalThis.navigator; }
  assert.equal(clipboard, text);
});
