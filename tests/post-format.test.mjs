import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./image-test-helpers.mjs";

const plain = loadTs("lib/text-normalize.ts");
const format = loadTs("lib/output-format.ts", { "./text-normalize": plain });
const copy = loadTs("lib/copy.ts", { "./text-normalize": plain, "./output-format": format });
const { normalizePostSection, plainPostText } = loadTs("lib/post-format.ts");
const { normalizeGenerationRequest, parseGenerationOutput, GenerationGroundingError } = loadTs("lib/generation-contract.ts");
const { parseWorkspaceGeneration } = loadTs("lib/workspace-contract.ts");
const section = extra => ({ id: "instagram", type: "instagram", title: "Planning ideas", platform: "Instagram", body: "A little room to think.\n\nTry putting one idea on paper.\n\nWhat would you write?", items: ["#Planning", "#Ideas"], cta: "What would you write?", ...extra });
const request = extra => normalizeGenerationRequest({ source: "Share planning ideas on Instagram.", brandName: "Example Studio", selectedTypes: ["instagram"], ...extra });
const pack = s => ({ title: "Planning ideas", summary: "A starting point.", sections: [s] });
const parse = (s, extra) => parseGenerationOutput(JSON.stringify(pack(s)), request(extra));
const expected = "A little room to think.\n\nTry putting one idea on paper.\n\nWhat would you write?\n\n#Planning #Ideas";

test("caption copy removes exact repetition and duplicate CTA, retaining distinct paragraphs and grouped tags", () => {
  const s = section({ body: "**A little room to think.**\n\nTry putting one idea on paper. Try putting one idea on paper.\n\nWhat would you write?" });
  assert.equal(copy.buildSectionCopyText(s), expected);
  assert.equal(format.formattedOutputToPlainText(format.formatOutputSection(s)), expected);
  assert.equal(format.formatSectionPlainText(s), expected);
  assert.equal(s.body.startsWith("**"), true, "rendering never mutates historical content");
});

test("server output, workspace round-trip, clipboard transport and export retain identical LF spacing", async () => {
  const result = parse(section());
  const restored = parseWorkspaceGeneration(JSON.parse(JSON.stringify(result)));
  const completed = expected + " #PlanningIdeas";
  assert.equal(copy.buildSectionCopyText(restored.sections[0]), completed);
  assert.equal(copy.buildGenerationCopyText(restored), completed);
  assert.equal(plainPostText(expected), expected, "formatter preserves copied spacing");
  let written;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async value => { written = value; } } } });
  try { await copy.copyPlainText(copy.buildSectionCopyText(restored.sections[0])); }
  finally { if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor); else delete globalThis.navigator; }
  assert.equal(written, completed);
});

test("short real captions never become source instructions, and literal identifiers survive formatting", () => {
  assert.equal(copy.buildSectionCopyText(section({ body: "A pause. A fresh idea.", items: [], cta: "" }), { sourceText: "Write me a post." }), "A pause. A fresh idea.");
  const body = "C# and https://example.invalid/#details remain literal.\n\nA **clear** idea, __plain__ text and *gentle* emphasis.";
  const formatted = copy.buildSectionCopyText(section({ body, items: [], cta: "" }));
  assert.equal(formatted, "C# and https://example.invalid/#details remain literal.\n\nA clear idea, plain text and gentle emphasis.");
  assert.equal(plainPostText("**First line\n\nSecond line**"), "First line\n\nSecond line");
  assert.equal(copy.buildSectionCopyText(section({ body: "What would you write?", items: [], cta: "What would you write?" }), { sourceText: "Write me a post." }), "What would you write?");
});

test("paragraph fallback is bounded to long unformatted prose, never rewrites distinct facts or deliberate lists", () => {
  const long = "A quiet page can be a useful place to begin. Put your unfinished ideas down without trying to make each one sound polished before you know what you want to say. Then choose the thought that matters most to the person you want to reach. Leave the remaining ideas for another post.";
  const normal = normalizePostSection(section({ body: long, items: [], cta: "" }));
  assert.equal(normal.body.split("\n\n").length, 3);
  assert.equal(normal.body.replace(/\s+/g, " "), long);
  assert.deepEqual(normalizePostSection(normal), normal);
  const deliberate = "One idea.\nOne page.\n\n1. Keep the date 12.5.\n2. Keep the price £12.50.\n\nOpen Monday. Closed Tuesday.";
  assert.equal(normalizePostSection(section({ body: deliberate, items: [], cta: "" })).body, deliberate);
});

test("all post platforms group tags; explicit separate-line request survives generation and cloud save", () => {
  for (const type of ["instagram", "linkedin", "facebook", "tiktok", "twitter"]) {
    assert.ok(copy.buildSectionCopyText(section({ type })).endsWith("#Planning #Ideas"));
  }
  const result = parse(section(), { source: "Share planning ideas. Use one hashtag per line." });
  assert.equal(result.sections[0].hashtagLayout, "lines");
  assert.ok(copy.buildSectionCopyText(parseWorkspaceGeneration(result).sections[0]).endsWith("#Planning\n#Ideas\n#PlanningIdeas"));
  const override = parse(section(), { writingStyle: "Use one hashtag per line.", source: "Share planning ideas. Put hashtags on one line." });
  assert.equal(override.sections[0].hashtagLayout, "inline");
});

test("default hashtag limits do not add filler or drop meaningful text accompanying a tag", () => {
  const items = Array.from({ length: 10 }, (_, i) => `#Topic${i}`);
  const source = "Share these topics: " + items.map(s => s.slice(1)).join(" ");
  const result = parse(section({ items }), { source });
  assert.equal(result.sections[0].items.length, 5);
  assert.equal(parse(section({ items }), { source: source + ". Include 10 hashtags." }).sections[0].items.length, 10);
  assert.equal(parse(section({ items }), { source: source + ". Include only 2 hashtags.", writingStyle: "Use 8 hashtags." }).sections[0].items.length, 2);
  assert.match(copy.buildSectionCopyText(section({ items: ["A small note about #Planning."] })), /A small note about/);
});

test("ambiguous saved preferences never authorize promotions, terms, deadlines or offers", () => {
  const offer = "Competitions, offers and deadlines. Maybe a giveaway. Could offer free shipping.";
  for (const body of ["We're running a giveaway.", "Enter our competition.", "**Win** a notebook!", "Follow us to enter.", "Entries close Friday.", "Free shipping.", "Get 20% off."]) {
    assert.throws(() => parse(section({ body, items: [], cta: "" }), { offer }), GenerationGroundingError, body);
  }
  const fact = "Entries close Friday.";
  assert.equal(parse(section({ body: fact, items: [], cta: "" }), { source: fact }).sections[0].body, fact);
  assert.throws(() => parse(section({ body: fact, items: [], cta: "" }), { offer: fact }), GenerationGroundingError);
  assert.equal(parse(section({ body: fact, items: [], cta: "" }), { offer: fact, source: "Use the confirmed offer." }).sections[0].body, fact);
  assert.throws(() => parse(section({ body: fact, items: [], cta: "" }), { writingStyle: fact }), GenerationGroundingError);
});

test("explicit giveaway confirmation supports existence only, not prize, mechanics or timing; refinement stays guarded", () => {
  const source = "Announce our giveaway.";
  assert.doesNotThrow(() => parse(section({ body: "We're running a giveaway.", items: [], cta: "" }), { source }));
  assert.throws(() => parse(section({ body: "We're running a giveaway.", items: [], cta: "" }), { source: "Announce our giveaway. We are not running a giveaway." }), GenerationGroundingError);
  for (const body of ["Win a notebook!", "Comment to enter.", "Entries close Friday."]) {
    assert.throws(() => parse(section({ body, items: [], cta: "" }), { source }), GenerationGroundingError);
  }
  assert.throws(() => parse(section({ body: "We're running a giveaway.", items: [], cta: "" }), {
    offer: "Maybe a giveaway.", refinement: { action: "custom", instructions: "Make it exciting.", section: section({ body: "We're running a giveaway." }) }
  }), GenerationGroundingError);
  assert.throws(() => parse(section({ body: "A fresh idea. Follow us.", items: [], cta: "" }), { source: "Share planning ideas. No CTA." }));
  assert.doesNotThrow(() => parse(section({ body: "Win the day with one small idea.", items: [], cta: "" })));
});
