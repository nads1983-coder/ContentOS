import test from "node:test";
import assert from "node:assert/strict";
import { loadTs, createImageHarness, imageInput, PNG } from "./image-test-helpers.mjs";
const { normalizeGenerationRequest, parseGenerationOutput } = loadTs("lib/generation-contract.ts");
const { buildStudioInput } = loadTs("lib/production-generation.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const { generationFingerprint } = loadTs("lib/generation-reservation.ts");
const { buildCreativeBrief } = loadTs("lib/image-design.ts");
const { normalizeImageRequest } = loadTs("lib/image-generation-contract.ts");
const { normalizeHex } = loadTs("lib/image-appearance.ts");
const { parseWorkspaceWrite, updateWorkspaceProfile, workspaceFromProfile } = loadTs("lib/workspace-contract.ts");
const automaticSettings = ["tone", "sharpness", "ctaMode", "presetTopic", "length"];
const source = "Gorl Lead has reached 1,000 subscribers. Announce our giveaway. No CTA.";
const request = extra => normalizeGenerationRequest({ source, selectedTypes: ["instagram"], automaticSettings, ...extra });
const section = type => ({ id: type, type, title: "Draft - details to confirm", platform: type, body: "Gorl Lead has reached 1,000 subscribers. A giveaway is coming. [CONFIRM: prize, dates and eligibility]", items: [], cta: "" });

test("one sentence produces a single-platform contract; all 14 formats remain parseable", () => {
  for (const { id } of contentTypes) {
    const r = request({ selectedTypes: [id] });
    assert.deepEqual(r.selectedTypes, [id]);
    const result = parseGenerationOutput(JSON.stringify({ title: "Milestone", summary: "Giveaway draft", sections: [section(id)] }), r);
    assert.equal(result.sections.length, 1);
    assert.equal(result.sections[0].type, id);
    if(id==='platformHashtags'){
      assert.ok(result.sections[0].items.length>0);
      assert.doesNotMatch(result.sections[0].body,/\[CONFIRM:/);
    }else assert.match(result.sections[0].body, /\[CONFIRM:/);
    assert.equal(result.source, source);
  }
  assert.equal(contentTypes.length, 14);
});

test("automatic orchestration omits conflicting defaults and explicit selections override inference", () => {
  const auto = buildStudioInput(request({ tone: "bold", ctaMode: "website", length: "short" }));
  assert.match(auto, /Tone selected: Automatic/);
  assert.doesNotMatch(auto, /Tone selected: Bold|Preferred length: short|CTA behavior: Website/);
  assert.match(auto, /one coherent, ready-to-edit draft/);
  assert.match(auto, /Never invent giveaway prizes, dates/);
  assert.match(auto, /Draft - details to confirm/);
  const manual = buildStudioInput(request({ automaticSettings: [], tone: "friendly", ctaMode: "none", length: "short", brandName: "Gorl Lead", audience: "Subscribers" }));
  assert.match(manual, /Tone selected: Friendly/);
  assert.match(manual, /CTA behavior: No CTA/);
  assert.match(manual, /Preferred length: short/);
  assert.match(manual, /Brand identity authorised for this subject: Gorl Lead/);
  assert.match(manual, /Audience preference \(not evidence of facts or eligibility\): Subscribers/);
  assert.notEqual(generationFingerprint(request()), generationFingerprint(request({ automaticSettings: [] })));
  for (const invalid of ["auto", ["budget"], ["tone", "tone"]]) assert.throws(() => request({ automaticSettings: invalid }), /automatic settings/);
});

test("custom refinements are bounded, source-grounded and included in request identity", () => {
  const r = request({ refinement: { action: "custom", instructions: "Make it shorter.", section: section("instagram") } });
  const prompt = buildStudioInput(r);
  assert.match(prompt, /Requested change: Make it shorter\./);
  assert.match(prompt, /Preserve unrelated content, facts and qualifications/);
  assert.match(prompt, /original brief above as the source of business facts/);
  assert.notEqual(generationFingerprint(r), generationFingerprint(request({ refinement: { ...r.refinement, instructions: "Make it warmer." } })));
  for (const instructions of ["", "x".repeat(401), "data:image/png;base64,abc"]) assert.throws(() => request({ refinement: { ...r.refinement, instructions } }));
  assert.throws(() => request({ refinement: { ...r.refinement, section: section("linkedin") } }), /matching content format/);
});

test("saved preferences round-trip through account-scoped workspace without replacing legacy data", () => {
  const data = { id: "synthetic-a", plan: "pro_studio", entitlement_source: "owner_complimentary_lifetime", studio_state_json: null };
  const input = { revision: 0, store: { version: 1, recent: [], saved: [], drafts: [] }, preferences: { brandName: "Example brand", audience: "Creators", offer: "", writingStyle: "Warm", contentGoal: "", brandColors: "Cream, gold", visualStyle: "Luxury", automaticSettings, length: "short" } };
  const next = updateWorkspaceProfile(data, "synthetic-a", input);
  assert.deepEqual(workspaceFromProfile(next.data, "synthetic-a").preferences, input.preferences);
  assert.equal(next.data.entitlement_source, data.entitlement_source);
  assert.equal(data.studio_state_json, null);
  assert.throws(() => workspaceFromProfile(next.data, "synthetic-b"), /unavailable/);
  assert.throws(() => updateWorkspaceProfile(next.data, "synthetic-a", input), /Workspace changed/);
  assert.throws(() => parseWorkspaceWrite({ ...input, preferences: { ...input.preferences, automaticSettings: ["invented"] } }));
  assert.throws(() => parseWorkspaceWrite({ ...input, preferences: { ...input.preferences, brandColors: "x".repeat(181) } }));
});

test("visual description and selected controls reach actual image prompt without altering caption or model parameters", async () => {
  const value = imageInput({ mode: "auto", creativeInstructions: "Create a luxury cream-and-gold giveaway graphic. No people.",
    outputText: "Our community milestone. #Community", brandContext: { brandColors: "black, purple", visualStyle: "Corporate photography" },
    appearance: { type: "auto", style: "auto", colours: [] } });
  const brief = buildCreativeBrief(normalizeImageRequest(value));
  assert.equal(brief.design.background, "#fff7e8"); assert.equal(brief.design.accent, "#b58a30");
  assert.equal(brief.design.font, "editorial"); assert.match(brief.prompt, /Image type: graphic/);
  assert.match(brief.prompt, /No people/); assert.doesNotMatch(brief.prompt, /#Community/);
  assert.equal(value.outputText, "Our community milestone. #Community");
  // Full actual route with the existing mocked provider and reservation implementation.
  const route = createImageHarness({ provider: async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.equal(payload.prompt, brief.prompt);
    assert.equal(payload.quality, "high"); assert.equal(payload.n, 1);
    assert.equal(payload.size, "1024x1024");
    assert.doesNotMatch(payload.prompt, /#Community/);
    return Response.json({ data: [{ b64_json: PNG }] });
  } });
  const result = await route.post(value);
  assert.equal(result.response.status, 200);
  assert.equal(route.calls.filter(c => c === "provider").length, 1);
  assert.deepEqual((await route.post(value)).body, result.body);
  assert.equal(route.data.usage_events_json.length, 1);
});

test("explicit type, style and palette override inferred and saved defaults; invalid values fail before provider", async () => {
  for (const type of ["graphic", "photograph", "illustration"]) {
    const value = normalizeImageRequest(imageInput({ mode: "auto", creativeInstructions: "Cream and gold luxury graphic", appearance: { type, style: "minimalist", colours: ["#0f0", "#FFF"] } }));
    const brief = buildCreativeBrief(value);
    assert.equal(brief.design.background, "#00ff00"); assert.equal(brief.design.accent, "#ffffff");
    assert.equal(brief.design.font, "sans"); assert.match(brief.prompt, new RegExp(`Image type: ${type}`));
  }
  assert.equal(normalizeHex("#AbC"), "#aabbcc");
  for (const c of ["red", "#12", "#gg0000", 'red" onload="evil']) assert.equal(normalizeHex(c), undefined);
  for (const appearance of [{ type: "video", style: "auto", colours: [] }, { type: "auto", style: "auto", colours: ["#fff", "#000", "#f00"] }, { type: "auto", style: "auto", colours: ["#badhex"] }]) {
    const h = createImageHarness(); const result = await h.post(imageInput({ mode: "auto", appearance }));
    assert.equal(result.response.status, 400); assert.equal(h.calls.includes("provider"), false);
  }
});
