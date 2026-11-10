// Paid, manually run evaluation. Uses only synthetic briefs and a separate
// explicitly funded project; never runs as part of the app or test suite.
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { loadTs } from "../../tests/image-test-helpers.mjs";

process.loadEnvFile(".env.local");
if (!process.env.OPENAI_API_KEY || process.env.CONTENTOS_SEPARATE_EVAL_APPROVED !== "1") {
  throw new Error("An explicitly approved separately funded evaluation project is required.");
}
const { normalizeGenerationRequest, parseGenerationOutput } = loadTs("lib/generation-contract.ts");
const { buildStudioInput, productionOutputSchema } = loadTs("lib/production-generation.ts");
const { buildInstructions } = loadTs("lib/prompts.ts");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 45_000, logLevel: "off" });
const cases = [
  { id: "milestone", source: "Northbank Paper has reached 1,000 newsletter subscribers. Announce an upcoming giveaway, but prize, dates and eligibility have not been decided.", selectedTypes: ["instagram"], ctaMode: "none", automaticSettings: [] },
  { id: "practical", source: "A small design studio shares three planning steps: collect references, sketch alternatives, and review the draft before publishing.", selectedTypes: ["linkedin"], automaticSettings: [] },
  { id: "limited-claim", source: "A volunteer group is piloting a monthly repair cafe. The first session is planned for Saturday; attendance and outcomes are not yet known.", selectedTypes: ["tiktok"], automaticSettings: [] }
];
const requestedModel=process.argv[2];
const supported=["gpt-5.2", "gpt-5.6-luna", "gpt-6-luna", "gpt-4.1-mini"];
if(requestedModel && !supported.includes(requestedModel))throw new Error("Unsupported evaluation model.");
const models = requestedModel ? [requestedModel] : supported.slice(0,3);
const results = [];
for (const model of models) for (const input of cases) {
  const request = normalizeGenerationRequest(input);
  const payload = { model, instructions: buildInstructions(), input: buildStudioInput(request), max_output_tokens: 1800,
    ...(model==="gpt-4.1-mini"?{}:{reasoning: { effort: "none" }}),
    text: { format: { type: "json_schema", name: "social_content_generation", strict: true, schema: productionOutputSchema } } };
  if (Buffer.byteLength(JSON.stringify(payload)) > 24_000) throw new Error("Evaluation input bound exceeded.");
  try {
    const response = await client.responses.create(payload);
    let parsed = null, validation = "passed";
    try { parsed = parseGenerationOutput(response.output_text, request); }
    catch { validation = "failed"; }
    results.push({ model, case: input.id, status: response.status, validation, usage: response.usage,
      output: response.output_text, sections: parsed?.sections ?? [] });
    console.log(`${model} ${input.id}: ${response.status}, validation ${validation}`);
  } catch (error) {
    results.push({ model, case: input.id, status: "request_failed", errorClass: error?.constructor?.name ?? "Error" });
    console.log(`${model} ${input.id}: request failed`);
  }
}
const outputPath=requestedModel ? `docs/pr22-topup-model-evaluation-${requestedModel}-2026-11-09.json` : "docs/pr22-topup-model-evaluation-2026-11-09.json";
writeFileSync(outputPath, JSON.stringify({
  note: "Small synthetic evaluation, 1800 output-token cap, reasoning none; human quality review is required.", cases, results
}, null, 2) + "\n");
