import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./image-test-helpers.mjs";

const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse, GenerationGroundingError } = loadTs("lib/generation-contract.ts");
const { applyContentQuality: quality } = loadTs("lib/content-quality.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const attic = JSON.parse(readFileSync(new URL("./fixtures/pr7-captured-instagram.json", import.meta.url)));
const captured = JSON.parse(readFileSync(new URL("./fixtures/pr7-instagram-quality-retest.json", import.meta.url)));
const request = extra => normalize({ ...attic.request, ...extra });
const output = (body, items = [], type = "instagram") => ({ title: "A milestone worth marking", summary: "A moment to celebrate.", sections: [{ id: type, type, title: "An update", platform: type, body, items, cta: "" }] });
const check = (items, extra = {}, body = "One thousand subscribers. Thank you for being here.") => parse(JSON.stringify(output(body, items)), request(extra)).sections[0];

test("exact captured retest keeps its factual hook, removes unsupported niche and two stock phrases", () => {
  const before = JSON.stringify(captured);
  const result = parse(before, request());
  const section = result.sections[0];
  assert.deepEqual(section.items, ["#independentmakers", "#northbankpaper", "#1000subscribers"]);
  assert.ok(section.body.startsWith("Hit a big milestone: 1,000 subscribers on Northbank Paper!"));
  assert.ok(!section.body.includes("creative journey deserves"));
  assert.ok(!section.body.includes("crafting what matters"));
  assert.ok(section.body.includes("giveaway."));
  assert.ok(section.body.length < captured.sections[0].body.length);
  assert.equal(JSON.stringify(captured), before);
});

test("quality processing cannot hide the attic failure or a fabricated tag-linked business claim", () => {
  assert.throws(() => parse(JSON.stringify(attic.output), request()), GenerationGroundingError);
  assert.throws(() => check(["#papercraft"], {}, "Our notebooks are award-winning. Every creative journey deserves a little spark."), GenerationGroundingError);
});

test("brand name alone and newly generated prose do not establish a niche", () => {
  assert.deepEqual(check(["#papercraft", "#paper", "#northbankpaper"]).items, ["#northbankpaper"]);
  assert.deepEqual(check(["#paper"], { source: "Northbank Paper sells paper." }).items, ["#paper"]);
  assert.deepEqual(check(["#papercraft"], {}, "Paper craft is a creative way to explore new ideas.").items, []);
  assert.deepEqual(check(["#papercraft"], { brandName: "Papercraft" }).items, []);
  assert.deepEqual(check(["#papercraft"], { offer: "Papercraft supplies" }).items, []);
  for (const extra of [{ source: "Share our papercraft ideas on Instagram." }, { audience: "Papercraft enthusiasts" }]) {
    assert.deepEqual(check(["#papercraft"], extra).items, ["#papercraft"]);
  }
});

test("explicit hashtag preferences and current overrides are respected", () => {
  assert.deepEqual(check(["#papercraft"], { writingStyle: "Use #papercraft." }).items, []);
  assert.deepEqual(check(["#northbankpaper"], { source: "A milestone update. No hashtags." }).items, []);
  assert.deepEqual(check(["#northbankpaper"], { writingStyle: "No hashtags." }).items, []);
  assert.deepEqual(check(["#northbankpaper"], { writingStyle: "No hashtags.", source: "Use #northbankpaper for our milestone." }).items, ["#northbankpaper"]);
  assert.deepEqual(check(["#northbankpaper"], { writingStyle: "Avoid #northbankpaper.", source: "Include #northbankpaper." }).items, ["#northbankpaper"]);
  assert.deepEqual(check(["#northbankpaper"], { source: "Omit #northbankpaper for this post." }).items, []);
});

test("Unicode, compound audience phrases, numbers and explicit tags remain usable", () => {
  assert.deepEqual(check(["#IndependentMakers", "#independent_makers", "#1000Subscribers", "#NorthbankPaper"]).items,
    ["#IndependentMakers", "#1000Subscribers", "#NorthbankPaper"]);
  assert.deepEqual(check(["#café", "#手作り"], { source: "Write about café and 手作り." }).items, ["#café", "#手作り"]);
});

test("hashtag cleanup preserves URL fragments and non-tag identifiers", () => {
  const body = "Explore https://example.invalid/guide#papercraft and https://example.invalid/#overview for the supplied details. C# is unchanged.";
  assert.equal(quality(output(body, ["#papercraft"]), request()).sections[0].body, body);
});

test("deduplication spans caption and tags but does not delete independent platform sets or plain labels", () => {
  const section = check(["#northbankpaper", "#independentmakers", "Hook:"], {}, "One thousand subscribers: a moment to celebrate with #northbankpaper.");
  assert.deepEqual(section.items, ["#independentmakers", "Hook:"]);
  const pack = quality(output("", ["Instagram: #northbankpaper #northbankpaper", "LinkedIn: #northbankpaper", "Facebook: #papercraft"], "platformHashtags"), request());
  assert.deepEqual(pack.sections[0].items, ["Instagram: #northbankpaper", "LinkedIn: #northbankpaper"]);
});

test("stock-phrase cleanup preserves explicit voice, genuine source text and unrelated creative language", () => {
  const body = "Here's the thing: One thousand subscribers. Every big milestone deserves a moment.";
  assert.equal(check([], {}, body).body, "One thousand subscribers. Every big milestone deserves a moment.");
  for (const extra of [{ writingStyle: "Always open with Here's the thing." }, { source: body }, { tone: "inspirational" }]) {
    assert.equal(check([], extra, body).body, body);
  }
  assert.equal(quality(output("Here's the thing!"), request()).sections[0].body, "Here's the thing!");
  const natural = "A journey through the notebook. Family photos on the cover. We are thrilled to announce a milestone.";
  assert.equal(check([], {}, natural).body, natural);
});

test("all fourteen formats survive quality cleanup, including empty supported-tag sets", () => {
  assert.equal(contentTypes.length, 14);
  const req = request({ selectedTypes: contentTypes.map(c => c.id) });
  const value = { ...captured, sections: contentTypes.map(c => output("One thousand subscribers. Every big milestone deserves a moment.", ["#northbankpaper", "#papercraft"], c.id).sections[0]) };
  const result = parse(JSON.stringify(value), req);
  assert.deepEqual(result.sections.map(s => s.type), req.selectedTypes);
  assert.ok(!JSON.stringify(result).includes("#papercraft"));
  const empty = quality(output("#papercraft", ["Instagram: #papercraft"], "platformHashtags"), request());
  assert.equal(empty.sections[0].body, "No relevant hashtags supported by this brief.");
  assert.deepEqual(empty.sections[0].items, []);
});

test("refinement remains grounded while allowing explicit style and hashtag instructions", () => {
  const fact = "We started this business in our attic three years ago.";
  const refinement = { action: "custom", instructions: "Use #northbankpaper. Open with Here's the thing.", section: captured.sections[0] };
  const result = check(["#northbankpaper", "#papercraft"], { refinement }, "Here's the thing: One thousand subscribers. Thank you for being here.");
  assert.ok(result.body.startsWith("Here's the thing:"));
  assert.deepEqual(result.items, ["#northbankpaper"]);
  assert.throws(() => check([], { refinement }, fact), GenerationGroundingError);
  assert.equal(check([], { refinement, source: fact }, fact).body, fact);
});
