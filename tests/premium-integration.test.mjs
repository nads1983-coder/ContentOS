import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const env = {
  CONTENTOS_PREVIEW_FIXTURES: "1", VERCEL_ENV: "preview",
  CONTENTOS_ISOLATED_BRANCH: "br-divine-term-b2rihbxv",
  DATABASE_URL: "postgresql://fixture:fixture@ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=require"
};
const cache = new Map(), runtime = { process: { env } };
const fixtures = loadTs("lib/preview-fixtures.ts", {}, cache, runtime);
const production = loadTs("lib/production-generation.ts", {}, cache, runtime);
const contract = loadTs("lib/generation-contract.ts", {}, cache, runtime);
const prompts = loadTs("lib/prompts.ts", {}, cache, runtime);
const config = loadTs("lib/content-config.ts", {}, cache, runtime);
const workspace = loadTs("lib/workspace-contract.ts", {}, cache, runtime);
const input = contract.normalizeGenerationRequest({ source: "Synthetic stationery collection. No sales results have been measured.", selectedTypes: config.contentTypes.map(t => t.id), ctaMode: "none" });

test("all 14 formats use the original production input without staged review", () => {
  assert.equal(input.selectedTypes.length, 14);
  assert.equal(production.buildStudioInput(input), prompts.buildInput(input));
  const parsed = contract.parseGenerationOutput(fixtures.previewTextResponse(input).output_text, input);
  assert.deepEqual(parsed.sections.map(s => s.type), input.selectedTypes);
  assert.ok(parsed.sections.every(s => s.cta === ""));
  assert.equal(production.productionOutputSchema.properties.sections.minItems, 1);
  assert.equal(production.productionOutputSchema.properties.sections.items.properties.type.enum, undefined);
});

test("refinement preserves the source and selected section, and edited provenance survives cloud validation", () => {
  const pack = contract.parseGenerationOutput(fixtures.previewTextResponse(input).output_text, input);
  const section = pack.sections[0];
  const refined = contract.normalizeGenerationRequest({ ...input, selectedTypes: [section.type], refinement: { action: "shorten", section } });
  const prompt = production.buildStudioInput(refined);
  assert.ok(prompt.includes(input.source));
  assert.ok(prompt.includes(section.body));
  assert.ok(prompt.includes("Remove redundancy"));
  const edited = workspace.parseWorkspaceGeneration({ ...pack, sections: [{ ...section, revisionSource: "manual" }] });
  assert.equal(edited.sections[0].revisionSource, "manual");
});

test("Preview fixtures cannot run with production targets, paid credentials or unrecognised accounts", () => {
  assert.equal(fixtures.previewFixturesEnabled(), true);
  assert.equal(fixtures.isPreviewAccount("premium-preview-review@example.invalid"), true);
  assert.equal(fixtures.isPreviewAccount("customer@example.com"), false);
  for (const patch of [{ VERCEL_ENV: "production" }, { CONTENTOS_ISOLATED_BRANCH: "production" },
    { DATABASE_URL: "postgresql://fixture@production.invalid/contentos" },
    ...["OPENAI_API_KEY", "STRIPE_SECRET_KEY", "RESEND_API_KEY"].map(k => ({ [k]: "not-a-real-secret" }))]) {
    const isolated = loadTs("lib/preview-fixtures.ts", {}, new Map(), { process: { env: { ...env, ...patch } } });
    assert.throws(() => isolated.previewFixturesEnabled(), /isolation/);
  }
  const disabled = loadTs("lib/preview-fixtures.ts", {}, new Map(), { process: { env: {} } });
  assert.equal(disabled.previewFixturesEnabled(), false);
  assert.throws(() => disabled.previewTextResponse(input), /disabled/);
});
