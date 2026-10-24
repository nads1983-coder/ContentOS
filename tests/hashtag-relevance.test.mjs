import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./image-test-helpers.mjs";

const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse } = loadTs("lib/generation-contract.ts");
const { applyContentQuality: quality } = loadTs("lib/content-quality.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const { parseWorkspaceGeneration } = loadTs("lib/workspace-contract.ts");
const plain = loadTs("lib/text-normalize.ts");
const format = loadTs("lib/output-format.ts", { "./text-normalize": plain });
const { buildSectionCopyText, buildGenerationCopyText } = loadTs("lib/copy.ts", { "./text-normalize": plain, "./output-format": format });
const { formatOutputSection, formattedOutputToPlainText } = format;
const relevant = ["#LinkedInGrowth", "#Consistency", "#PersonalBranding", "#ProfessionalGrowth"];
const source = "Reflect on one year of consistent LinkedIn activity.";
const request = extra => normalize({ source, brandName: "Gorl Lead", audience: "Papercraft enthusiasts", offer: "Free competition.", writingStyle: "Use #GorlLead and #papercraft.", selectedTypes: ["linkedin"], ...extra });
const section = (type = "linkedin", items = relevant) => ({ id: type, type, platform: type, title: "Showing up", body: "One year of consistent LinkedIn activity.\n\nA moment to reflect.", items, cta: "What keeps you showing up?" });
const pack = section => ({ title: "A moment to reflect", summary: "A reflection on consistent activity.", sections: [section] });

test("reported LinkedIn topic retains four meaningful concepts without saved brand or niche contamination", () => {
  const raw = pack(section("linkedin", ["#LinkedInPresence", ...relevant, "#GorlLead", "#papercraft", "#FreeCompetition", "#GuaranteedGrowth", "#MillionFollowers"]));
  const before = JSON.stringify(raw);
  const result = parse(before, request());
  assert.deepEqual(result.sections[0].items, ["#LinkedInPresence", ...relevant]);
  assert.equal(result.sections[0].body, raw.sections[0].body);
  assert.equal(JSON.stringify(raw), before);
});

test("themes need source relationships, not platform choice, invented output, saved preferences or brand tokens", () => {
  for (const extra of [
    { source: "Share an update." },
    { source: "Discuss a LinkedIn outage." },
    { source: "Share an update.", writingStyle: source, offer: source },
    { source: "Write about my brand.", brandName: "Consistent LinkedIn Activity", audience: "General readers" },
    { source: "Discuss photography. Do not discuss consistent LinkedIn activity." }
  ]) {
    const result = quality(pack(section()), request(extra));
    assert.ok(!result.sections[0].items.includes("#LinkedInGrowth"));
    assert.ok(!result.sections[0].items.includes("#PersonalBranding"));
    assert.ok(!result.sections[0].items.includes("#ProfessionalGrowth"));
  }
  assert.deepEqual(quality(pack(section("linkedin", ["#Coding", "#Programming", "#SoftwareDevelopment", "#AIExpert"])), request({ source: "Share coding ideas with Codex." })).sections[0].items,
    ["#Coding", "#Programming", "#SoftwareDevelopment"]);
});

test("all platform caps are preferences: keep fewer, never manufacture replacements, preserve explicit counts", () => {
  const cases = { linkedin: 5, instagram: 5, tiktok: 5, facebook: 3, youtubeShorts: 3, twitter: 2, xThread: 2 };
  const items = ["#LinkedInPresence", ...relevant, "#ShowingUp", "#ProfessionalDevelopment"];
  for (const [type, max] of Object.entries(cases)) {
    assert.equal(quality(pack(section(type, items)), request()).sections[0].items.length, max, type);
    assert.deepEqual(quality(pack(section(type, ["#Consistency"])), request()).sections[0].items, ["#Consistency"]);
    assert.deepEqual(quality(pack(section(type, [])), request()).sections[0].items, []);
    assert.equal(quality(pack(section(type, items)), request({ source: source + " Include 6 hashtags." })).sections[0].items.length, 6);
    assert.equal(quality(pack(section(type, items)), request({ source: source + " Include only 1 hashtag." })).sections[0].items.length, 1);
    assert.equal(quality(pack(section(type, items)), request({ source: source + " No hashtags." })).sections[0].items.length, 0);
  }
});

test("current preferences and refinement override defaults without allowing saved unrelated tags", () => {
  const refinement = { action: "custom", instructions: "Keep #Consistency. Exclude #PersonalBranding.", section: section() };
  assert.deepEqual(quality(pack(section()), request({ refinement, writingStyle: "No hashtags." })).sections[0].items,
    ["#LinkedInGrowth", "#Consistency", "#ProfessionalGrowth"]);
  assert.deepEqual(quality(pack(section()), request({ refinement: { ...refinement, instructions: "No hashtags." } })).sections[0].items, []);
  assert.deepEqual(quality(pack(section("linkedin", ["#Consistency"])), request({ writingStyle: "Avoid #Consistency." })).sections[0].items, []);
  assert.deepEqual(quality(pack(section("linkedin", ["#GorlLead"])), request({ source: "Promote Gorl Lead. Include #GorlLead." })).sections[0].items, ["#GorlLead"]);
  const added = quality(pack(section()), request({ source: "Share a reflection.", refinement: { ...refinement, instructions: "Focus on consistent LinkedIn activity." } }));
  assert.deepEqual(added.sections[0].items, relevant);
});

test("every format retains grounded themes and rejects unrelated identity; hashtag sets retain independent groups", () => {
  for (const { id } of contentTypes) {
    const result = quality(pack(section(id, ["#Consistency", "#GorlLead", "#papercraft"])), request());
    assert.deepEqual(result.sections[0].items, ["#Consistency"], id);
  }
  for (const type of ["platformHashtags", "repurposePack"]) {
    assert.deepEqual(quality(pack(section(type, ["LinkedIn: #Consistency #GorlLead", "Instagram: #Consistency #papercraft"])), request()).sections[0].items,
      ["LinkedIn: #Consistency", "Instagram: #Consistency"]);
    const groups = ["LinkedIn", "Instagram", "TikTok", "Facebook", "YouTube Shorts", "X/Twitter"];
    const tags = ["#LinkedInPresence", ...relevant, "#ShowingUp"];
    const limited = quality(pack(section(type, groups.map(label => `${label}: ${tags.join(" ")}`))), request()).sections[0];
    assert.deepEqual(limited.items.map(item => (item.match(/#/g) ?? []).length), [5, 5, 5, 3, 3, 2]);
  }
});

test("final display, clipboard serialization, workspace restore and export share the same final tags", () => {
  for (const type of ["linkedin", "instagram", "tiktok", "facebook", "youtubeShorts", "twitter"]) {
    const result = parse(JSON.stringify(pack(section(type, [...relevant, "#GorlLead", "#papercraft"]))), request({ selectedTypes: [type] }));
    const restored = parseWorkspaceGeneration(JSON.parse(JSON.stringify(result)));
    const s = restored.sections[0], expected = s.items.join(" ");
    const display = formattedOutputToPlainText(formatOutputSection(s));
    assert.ok(display.endsWith(expected), type);
    assert.equal(buildSectionCopyText(s), display);
    assert.equal(buildGenerationCopyText(restored), display);
    assert.deepEqual(restored.sections[0].items, result.sections[0].items);
  }
  const yt = quality(pack(section("youtubeShorts", ["#PersonalBranding"])), request()).sections[0];
  yt.body = "A reflection. #Consistency";
  const rendered = buildSectionCopyText(yt);
  assert.equal((rendered.match(/#Consistency/g) ?? []).length, 1);
  assert.ok(rendered.endsWith("#Consistency #PersonalBranding"));
});
