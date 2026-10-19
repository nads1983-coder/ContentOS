import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { loadTs } from "./image-test-helpers.mjs";

// Offline only. No credential, database or provider transport is loaded.
const baseline = "6517cc23cffa9e34dec684bc035d17a5a3b69dea";
const gitFile = file => execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" });
for (const file of ["lib/prompts.ts", "lib/content-config.ts", "lib/stripe-rest.ts", "lib/founder-offer.ts", "lib/entitlements.ts", "lib/usage.ts", "app/api/billing/webhook/route.ts"]) {
  assert.equal(readFileSync(file, "utf8"), gitFile(file), `${file}: production compatibility`);
}
const cache = new Map();
const { normalizeGenerationRequest, GENERATION_LIMITS, parseGenerationOutput } = loadTs("lib/generation-contract.ts", {}, cache);
const { buildInstructions } = loadTs("lib/prompts.ts", {}, cache);
const { buildStudioInput, productionOutputSchema } = loadTs("lib/production-generation.ts", {}, cache);
const { contentTypes } = loadTs("lib/content-config.ts", {}, cache);
const old = ts.createSourceFile("baseline.ts", gitFile("app/api/generate/route.ts"), ts.ScriptTarget.Latest, true);
let originalSchema;
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(old) === "schema" && ts.isObjectLiteralExpression(node.initializer)) {
    originalSchema = new Function(`return (${node.initializer.getText(old)})`)();
  }
  ts.forEachChild(node, visit);
}
visit(old);
assert.deepEqual(productionOutputSchema, originalSchema);
const current = ts.createSourceFile("current.ts", readFileSync("lib/production-generation.ts", "utf8"), ts.ScriptTarget.Latest, true);
const printer = ts.createPrinter({ removeComments: true });
for (const name of ["sanitizeGeneratedText", "asStringArray", "withoutHashtags", "hasMeaningfulCaption", "fallbackCaptionFromSource", "normalizeSections", "parseOpenAIJson"]) {
  const a = old.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  const b = current.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === (name === "parseOpenAIJson" ? "parseProductionGeneration" : name));
  assert.ok(a?.body && b?.body);
  assert.equal(printer.printNode(ts.EmitHint.Unspecified, a.body, old), printer.printNode(ts.EmitHint.Unspecified, b.body, current), `Original ${name} body preserved`);
}
const request = normalizeGenerationRequest({
  source: "Synthetic brief: Linden Desk sells a reusable weekly planning pad with 40 sheets for GBP 12. Each sheet has sections for priorities, appointments and notes. It is sold online in the UK. There are no published results, testimonials, delivery guarantees or discount offers. Present the pad as a practical planning option, not a promise of increased productivity. Do not invent a URL. Use a gentle reflection question where a CTA is appropriate.",
  brandName: "Linden Desk", audience: "Independent professionals planning their working week",
  offer: "Reusable weekly planning pad, 40 sheets, GBP 12", writingStyle: "Calm, specific, warm; no hype or invented personal stories",
  contentGoal: "Introduce the planning pad", tone: "professional", sharpness: "balanced", ctaMode: "soft", presetTopic: "product-promotion",
  selectedTypes: contentTypes.map(t => t.id), length: "standard"
});
assert.equal(request.selectedTypes.length, 14);
const payload = { model: "gpt-5.2", instructions: buildInstructions(), input: buildStudioInput(request), max_output_tokens: GENERATION_LIMITS.maxOutputTokens,
  text: { format: { type: "json_schema", name: "social_content_generation", strict: true, schema: productionOutputSchema } } };
const serialized = JSON.stringify(payload), bytes = Buffer.byteLength(serialized);
// One token per serialized UTF-8 byte plus 4,096 framing tokens: deliberately
// conservative; runtime must reject changed payloads/models or larger counts.
const inputBound = bytes + 4096, outputBound = payload.max_output_tokens;
const usdBound = (inputBound * 1.75 + outputBound * 14) / 1e6;
const gbpPlanningBound = usdBound * 0.85;
assert.ok(gbpPlanningBound * 1.2 < 0.50, "GBP 0.50 must cover conservative allocation and 20% billing contingency");
const raw = JSON.stringify({ title: "Offline compatibility", summary: "Synthetic response, not provider output.", sections: request.selectedTypes.map(type => ({ id: type, type, title: type, platform: type, body: "A synthetic planning pad with 40 sheets. Review the facts before publication.", items: [], cta: "What helps you plan your week?" })) });
assert.equal(parseGenerationOutput(raw, request).sections.length, 14);
console.log(JSON.stringify({ baseline, applicationContract: "PASS", formats: 14, schemaIdentical: true, parserBodiesIdentical: true,
  proposedTest: { requests: 1, modelAssumption: payload.model, serializedBytes: bytes, payloadSha256: createHash("sha256").update(serialized).digest("hex"), inputTokenBound: inputBound, outputTokenBound: outputBound,
    usdBound, gbpPerUsdAssumption: 0.85, gbpPlanningBound, gbpWith20PercentContingency: gbpPlanningBound * 1.2, requestedCapGbp: 0.50,
    condition: "Verify the inherited sensitive model setting and actual server payload before reserving or dispatching. Stop if model/pricing/FX/total liability exceeds the cap. No call is authorised." }, paidCalls: 0 }, null, 2));
