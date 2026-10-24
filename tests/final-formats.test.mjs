import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./image-test-helpers.mjs";
const { normalizeGenerationRequest, parseGenerationOutput } = loadTs("lib/generation-contract.ts");
const { buildStudioInput } = loadTs("lib/production-generation.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const textModule = loadTs("lib/text-normalize.ts");
const formatModule = loadTs("lib/output-format.ts", { "./text-normalize": textModule });
const { formatOutputSection } = formatModule;
const { buildSectionCopyText, buildGenerationCopyText } = loadTs("lib/copy.ts", { "./text-normalize": textModule, "./output-format": formatModule });
const { updateWorkspaceProfile, workspaceFromProfile } = loadTs("lib/workspace-contract.ts");
const source = "The workshop lasts 45 minutes. It takes place in Bristol on 12 November. No CTA.";
const examples = {
  linkedin: ["A little space to think can be useful.\n\nThe workshop lasts 45 minutes.\n\nIt takes place in Bristol on 12 November.", []],
  instagram: ["A pause for fresh ideas.\n\nThe workshop lasts 45 minutes.\n\nIt takes place in Bristol on 12 November.", ["#Workshop", "#Bristol"]],
  tiktok: ["A little room for a fresh perspective. The workshop lasts 45 minutes.", ["#Workshop"]],
  twitter: ["A pause for fresh ideas. The workshop lasts 45 minutes.", []],
  facebook: ["A moment to think together.\n\nThe workshop lasts 45 minutes. It takes place in Bristol on 12 November.", []],
  youtubeShorts: ["Title: A little space to think\nHook: A fresh perspective starts with a pause.\nVoiceover: The workshop lasts 45 minutes.", ["Workshop", "Bristol"]],
  xThread: ["A little space to think.", ["1/2 A fresh perspective starts with a pause.", "2/2 The workshop lasts 45 minutes."]],
  shortVideoScript: ["Hook: Room for a fresh perspective.\nScene: Notebook on a desk.\nVoiceover: The workshop lasts 45 minutes.", []],
  carousel: ["A little space to think.", ["Slide 1: A fresh perspective", "Slide 2: The workshop lasts 45 minutes.", "Slide 3: It takes place in Bristol on 12 November."]],
  emailNewsletter: ["Subject: A little space to think\nPreview: Room for fresh ideas.\n\nHello,\n\nThe workshop lasts 45 minutes. It takes place in Bristol on 12 November.", []],
  repurposePack: ["Room for fresh ideas.", ["LinkedIn: The workshop lasts 45 minutes.", "Instagram: A fresh perspective starts with a pause."]],
  hooks: ["Opening ideas", ["A little space to think.", "Fresh ideas can begin with a pause."]],
  ctas: ["A moment worth marking. Thank you for being here.", []],
  platformHashtags: ["Platform tags", ["Instagram: #Workshop #Bristol", "LinkedIn: #Workshop"]]
};
for (const { id, prompt } of contentTypes) test(`${id}: distinct contract, formatting, account save and text export round-trip`, () => {
  const request = normalizeGenerationRequest({ source, selectedTypes: [id], brandName: "Example Studio", tone: "friendly", writingStyle: "Plain English", ctaMode: "none", automaticSettings: [] });
  assert.ok(buildStudioInput(request).includes(prompt));
  assert.match(buildStudioInput(request), /Tone selected: Friendly/);
  const [body, items] = examples[id];
  const result = parseGenerationOutput(JSON.stringify({ title: "Workshop draft", summary: "A pause for fresh ideas.", sections: [{ id, type: id, title: id, platform: id, body, items, cta: "" }] }), request);
  const section = result.sections[0];
  assert.equal(section.type, id);
  assert.ok(formatOutputSection(section, source));
  const exported = buildSectionCopyText(section, { sourceText: source });
  assert.ok(exported.trim().length > 0);
  assert.doesNotMatch(exported, /undefined|\[object Object\]/);
  const profile = { id: "synthetic-formats", plan: "pro_studio", subscription_status: "active", entitlement_source: "owner_complimentary_lifetime", usage_events_json: [{ id: "retained" }] };
  const saved = updateWorkspaceProfile(profile, profile.id, { revision: 0, store: { version: 1, recent: [result], saved: [result], drafts: [] }, preferences: { brandName: "Example Studio", audience: "", offer: "", writingStyle: "Plain English", contentGoal: "" } });
  const restored = workspaceFromProfile(saved.data, profile.id).store.saved[0];
  assert.deepEqual(restored.sections, result.sections);
  assert.equal(buildGenerationCopyText(restored), buildGenerationCopyText(result));
  assert.equal(saved.data.entitlement_source, profile.entitlement_source);
  assert.deepEqual(saved.data.usage_events_json, profile.usage_events_json);
  assert.throws(() => workspaceFromProfile(saved.data, "other-account"));
});
