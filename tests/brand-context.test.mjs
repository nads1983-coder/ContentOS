import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs, imageInput } from "./image-test-helpers.mjs";

const fixture = JSON.parse(readFileSync(new URL("fixtures/codex-brand-contamination.json", import.meta.url)));
const { brandContextScope: scope } = loadTs("lib/brand-context.ts");
const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse, GenerationGroundingError } = loadTs("lib/generation-contract.ts");
const { buildStudioInput } = loadTs("lib/production-generation.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const { normalizeImageRequest } = loadTs("lib/image-generation-contract.ts");
const { buildCreativeBrief, renderDesignSvg } = loadTs("lib/image-design.ts");
const { buildTextlessBackgroundPrompt, buildSocialPosterContent } = loadTs("lib/social-image.ts");
const req = extra => normalize({ ...fixture.request, ...extra });
const natural = "A coding idea worth exploring.\n\nWhat would you try with Codex?";
const value = (body = natural, type = "instagram") => ({ ...fixture.output, sections: [{ ...fixture.output.sections[0], id: type, type, platform: type, body }] });
const check = (body, extra = {}) => parse(JSON.stringify(value(body)), req(extra));

test("reported Codex contamination fails, while the subject and creative hook survive tag cleanup", () => {
  const before = JSON.stringify(fixture);
  assert.throws(() => parse(JSON.stringify(fixture.output), req()), GenerationGroundingError);
  const result = check();
  assert.equal(result.sections[0].body, natural);
  assert.deepEqual(result.sections[0].items, ["#Codex", "#Coding", "#Programming", "#SoftwareDevelopment"]);
  assert.doesNotMatch(JSON.stringify(result), /GorlLead|Gorl Lead|competition/i);
  assert.equal(JSON.stringify(fixture), before);
});

test("provider input projects request-scoped preferences without mutating the saved profile", () => {
  const request = req(), before = JSON.stringify(request);
  const prompt = buildStudioInput(request);
  assert.match(prompt, /Codex.*coding ideas/);
  assert.match(prompt, /Conversational and thoughtful/);
  assert.doesNotMatch(prompt, /Gorl.?Lead|Gorlworld|Free competition|Entries close Friday|Always include/);
  assert.equal(JSON.stringify(request), before);
});

test("author identity, topic and explicit exclusions are distinct; unrelated no-CTA does not suppress branding", () => {
  for (const source of [fixture.request.source, "My brand is Gorl Lead. Write about Codex.", "I run Gorl Lead, but write about Codex.", "Write about Codex, not about Gorl Lead.", "Write about Codex without branding."]) {
    assert.equal(scope(req({ source })).identity, false, source);
  }
  for (const source of ["Promote Gorl Lead.", "Write about Gorl Lead, no CTA.", "Include my brand name.", "Use #GorlLead."]) {
    assert.equal(scope(req({ source })).identity, true, source);
  }
  assert.equal(scope(req({ source: "Gorl Lead news.", refinement: { action: "custom", instructions: "Remove Gorl Lead.", section: value().sections[0] } })).identity, false);
  assert.equal(scope(req({ refinement: { action: "custom", instructions: "Mention my brand name.", section: value().sections[0] } })).identity, true);
});

test("saved offers and CTA choices do not establish promotions; confirmed current facts still work", () => {
  for (const body of ["Join our competition.", "Entries close Friday.", "Our exclusive discount is available.", "We partnered with Codex."]) {
    assert.throws(() => check(body, { ctaMode: "product" }), GenerationGroundingError, body);
  }
  const fact = "Gorl Lead is running a competition.";
  assert.doesNotThrow(() => check(fact, { source: `Promote Gorl Lead. ${fact}` }));
  assert.throws(() => check(`${fact} Entries close Friday.`, { source: `Promote Gorl Lead. ${fact}` }), GenerationGroundingError);
  assert.throws(() => check("Entries close Friday.", { source: "Promote Gorl Lead." }), GenerationGroundingError);
  assert.doesNotThrow(() => check("Entries close Friday.", { source: "Promote Gorl Lead using the saved offer." }));
  assert.throws(() => check("Entries close Friday.", { source: "Use the saved offer.", offer: "Maybe entries close Friday." }), GenerationGroundingError);
  assert.doesNotThrow(() => check("Our giveaway announcement is taking shape.", { source: "Announce our giveaway." }));
  assert.throws(() => check("Our giveaway announcement is taking shape."), GenerationGroundingError);
  assert.throws(() => check("Our giveaway announcement is taking shape with free prizes.", { source: "Announce our giveaway." }), GenerationGroundingError);
  assert.doesNotThrow(() => check("We're running a competition.", { source: "Promote the Gorl Lead competition." }));
  assert.throws(() => check("We're running a competition.", { source: "Promote Gorl Lead." }), GenerationGroundingError);
  assert.throws(() => check("We're running a competition.", { source: "Promote the Gorl Lead competition. The competition is cancelled." }), GenerationGroundingError);
  assert.throws(() => check("We're running a competition with free prizes.", { source: "Promote the Gorl Lead competition." }), GenerationGroundingError);
});

test("all fourteen formats reject unrelated identity in every delivered field and keep subject tags", () => {
  assert.equal(contentTypes.length, 14);
  for (const { id } of contentTypes) {
    const request = req({ selectedTypes: [id] });
    const good = value(natural, id);
    const result = parse(JSON.stringify(good), request);
    assert.doesNotMatch(JSON.stringify(result), /Gorl.?Lead/);
    for (const field of ["title", "summary", "sectionTitle", "body", "items", "cta", "platform"]) {
      const bad = structuredClone(good);
      if (["title", "summary"].includes(field)) bad[field] = "A fresh perspective from Gorl Lead.";
      else bad.sections[0][field === "sectionTitle" ? "title" : field] = field === "items" ? ["A fresh perspective from Gorl Lead."] : "A fresh perspective from Gorl Lead.";
      assert.throws(() => parse(JSON.stringify(bad), request), GenerationGroundingError, `${id}:${field}`);
    }
  }
});

test("refinement cannot authorize contamination from the previous draft or saved preferences", () => {
  const refinement = { action: "custom", instructions: "Make it warmer. Keep the Codex subject.", section: fixture.output.sections[0] };
  assert.throws(() => parse(JSON.stringify(fixture.output), req({ refinement })), GenerationGroundingError);
  assert.equal(check(natural, { refinement }).sections[0].body, natural);
  const explicit = { ...refinement, instructions: "Mention Gorl Lead. Include #GorlLead." };
  assert.deepEqual(check("A fresh perspective from Gorl Lead.", { refinement: explicit }).sections[0].items, ["#Codex", "#GorlLead", "#Coding", "#Programming", "#SoftwareDevelopment"]);
  assert.throws(() => check("Join the Gorl Lead competition.", { refinement: explicit }), GenerationGroundingError);
});

test("saved hashtag instructions cannot smuggle a brand or an unrelated promotion into subject tags", () => {
  const output = value();
  output.sections[0].items = ["#Codex", "#GorlLead", "#GorlLeadCompetition", "#FreeCompetition", "#DocumentaryViewers"];
  assert.deepEqual(parse(JSON.stringify(output), req()).sections[0].items, ["#Codex", "#Coding", "#Programming", "#SoftwareDevelopment"]);
  assert.deepEqual(check(natural, { source: "Write about Codex. Include #GorlLead." }).sections[0].items, ["#Codex", "#GorlLead"]);
  assert.deepEqual(check(natural, { source: "Write about Codex. Avoid #GorlLead." }).sections[0].items, ["#Codex"]);
});

test("Image Studio keeps saved aesthetics, not unrelated identity, audience or promotional instructions", () => {
  const brandContext = { brandName: "Gorl Lead", industry: "Gorlworld documentaries", audience: "Documentary viewers", brandColors: "#ffffff, #245c4a", writingStyle: fixture.request.writingStyle, visualStyle: "Minimal. Promote Gorl Lead competition." };
  for (const mode of ["image", "text", "mixed", "auto"]) {
    const input = normalizeImageRequest(imageInput({ mode, outputText: "Codex coding ideas", creativeInstructions: "Headline: Codex coding ideas", brandContext }));
    const before = JSON.stringify(input), brief = buildCreativeBrief(input);
    assert.equal(brief.design.brand, "");
    assert.equal(brief.design.accent, "#245c4a");
    assert.doesNotMatch(brief.prompt, /Gorl.?Lead|Gorlworld|Documentary viewers|Free competition|Entries close Friday/);
    assert.doesNotMatch(renderDesignSvg(brief.design, 1080, 1080), /Gorl.?Lead/);
    assert.equal(JSON.stringify(input), before);
  }
  const explicit = normalizeImageRequest(imageInput({ mode: "text", outputText: "Gorl Lead", creativeInstructions: "Headline: Gorl Lead. Brand: Gorl Lead", brandContext }));
  assert.equal(buildCreativeBrief(explicit).design.brand, "Gorl Lead");
  assert.equal(buildCreativeBrief({ ...explicit, creativeInstructions: "No branding. Headline: Codex" }).design.brand, "");
  const legacy = imageInput({ outputText: "Codex coding ideas", brandContext: { ...brandContext, offer: fixture.request.offer } });
  assert.doesNotMatch(buildTextlessBackgroundPrompt(legacy), /Gorl.?Lead|Documentary viewers|Free competition|Entries close Friday/);
  assert.notEqual(buildSocialPosterContent(legacy).footer, "Gorl Lead");
  assert.equal(buildSocialPosterContent({ ...legacy, outputText: "Gorl Lead news" }).footer, "Gorl Lead");
});
