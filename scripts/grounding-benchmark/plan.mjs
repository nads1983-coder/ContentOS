import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { BASELINE, CANDIDATE, SEALED_HASH, PROJECT, ROLE, sha, demand, loadModules, validatePayload } from "./runtime.mjs";

const read = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { encoding: "utf8", maxBuffer: 2000000 });
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  demand(ts.isObjectLiteralExpression(node), "nonliteral_schema");
  return Object.fromEntries(node.properties.map(p => { demand(ts.isPropertyAssignment(p), "nonliteral_schema"); return [p.name.text, literal(p.initializer)]; }));
}
function baselineSource(source) {
  const tree = ts.createSourceFile("baseline.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let format;
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(tree) === "client.responses.create") {
      const text = n.arguments[0].properties.find(p => p.name.text === "text").initializer;
      format = literal(text.properties.find(p => p.name.text === "format").initializer);
    }
    ts.forEachChild(n, visit);
  }
  visit(tree); demand(format, "missing_baseline_schema");
  const pure = tree.statements.filter(n => {
    if (ts.isImportDeclaration(n)) return ["@/lib/content-config", "@/lib/prompts", "@/lib/text-normalize", "@/types/content"].includes(n.moduleSpecifier.text);
    return !(ts.isFunctionDeclaration(n) && n.name.text === "POST");
  }).map(n => n.getText(tree)).join("\n") + "\nexport { parseOpenAIJson, normalizeRequest };";
  return { format, pure };
}

export function buildPlan(inputsPath, expires) {
  demand(sha(readFileSync("/tmp/contentos-grounding-heldout.md")) === SEALED_HASH, "heldout_changed");
  const modules = { baseline: {}, candidate: {} }, sourceHashes = { baseline: {}, candidate: {} };
  for (const [variant, revision] of [["baseline", BASELINE], ["candidate", CANDIDATE]]) {
    const paths = ["lib/prompts.ts", "lib/content-config.ts", "lib/text-normalize.ts", ...(variant === "candidate" ? ["lib/generation-contract.ts", "lib/cta-policy.ts", "lib/factual-grounding.ts"] : [])];
    for (const path of paths) { const source = read(revision, path); modules[variant][path] = compile(source); sourceHashes[variant][path] = sha(source); }
  }
  const baseRoute = read(BASELINE, "app/api/generate/route.ts"), base = baselineSource(baseRoute);
  sourceHashes.baseline["app/api/generate/route.ts"] = sha(baseRoute);
  sourceHashes.candidate["app/api/generate/route.ts"] = sha(read(CANDIDATE, "app/api/generate/route.ts"));
  modules.baseline["baseline-parser.ts"] = compile(base.pure);
  const candidate = loadModules(modules.candidate), baseline = loadModules(modules.baseline);
  const contract = candidate("lib/generation-contract.ts"), types = Array.from(candidate("lib/content-config.ts").contentTypes, t => t.id);
  demand(types.length === 14 && JSON.stringify(types) === JSON.stringify(Array.from(baseline("lib/content-config.ts").contentTypes, t => t.id)), "format_set_changed");
  const inputs = JSON.parse(readFileSync(inputsPath, "utf8"));
  demand(Array.isArray(inputs) && JSON.stringify(inputs.map(x => x.id)) === JSON.stringify(["H1", "H2", "H3"]), "unexpected_briefs");
  const packs = inputs.flatMap(({ id, request }) => ["baseline", "candidate"].map(variant => {
    const loader = variant === "baseline" ? baseline : candidate;
    const normalized = variant === "baseline" ? baseline("baseline-parser.ts").normalizeRequest(request) : contract.normalizeGenerationRequest(request);
    demand(JSON.stringify(normalized.selectedTypes) === JSON.stringify(types), "missing_formats");
    const prompts = loader("lib/prompts.ts");
    const body = JSON.stringify({ model: "gpt-5.2", store: false, service_tier: "default", instructions: prompts.buildInstructions(), input: prompts.buildInput(normalized), max_output_tokens: 24000,
      text: { format: variant === "baseline" ? base.format : { type: "json_schema", name: "social_content_generation", strict: true, schema: contract.generationOutputSchema(types) } } });
    return { id: `${id}:${variant}`, brief: id, variant, request: normalized, body, payloadHash: validatePayload(body, "draft").payloadHash };
  }));
  const material = { project: PROJECT, environment: "preview", role: ROLE, baseline: BASELINE, candidate: CANDIDATE, sealedHash: SEALED_HASH,
    capGbpMicros: 9000000, maxRequests: 12, maxReservedGbpMicros: 8507520, expires, packs, modules, sourceHashes,
    moduleHashes: Object.fromEntries(Object.entries(modules).map(([variant, files]) => [variant, Object.fromEntries(Object.entries(files).map(([p, s]) => [p, sha(s)]))])),
    pricing: { model: "gpt-5.2", inputUsdPerMillion: 1.75, cachedUsdPerMillion: .175, outputUsdPerMillion: 14, verified: "2026-10-18", source: "https://developers.openai.com/api/docs/models/gpt-5.2", gbpPerUsdReference: .84385 / 1.1253, fxDate: "2026-10-16", reserveGbpPerUsdWithBuffer: 1.25 } };
  return { ...material, planHash: sha(JSON.stringify(material)) };
}
