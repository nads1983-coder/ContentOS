/* global AbortSignal, Buffer, TextEncoder, console, fetch, performance, process */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

export const BASELINE = "6c75fab8e995e94c53bec400aed01991e1ee0642";
// Rates supplied for this benchmark; the operator must confirm official pricing before --live.
export const POLICY = Object.freeze({
  model: "gpt-5.2", serviceTier: "default", inputUsdPerMillion: 1.75, outputUsdPerMillion: 14,
  maxInputBytes: 64_000, framingTokens: 4096, maxOutputTokens: 24_000,
  maxAttempts: 6, capGbpMicros: 5_000_000, timeoutMs: 90_000,
  // Deliberately pessimistic: GBP 1 per USD 1, then a further 25% buffer. Never refund reservations.
  reserveGbpMicros: 568_960
});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UID = process.getuid?.() ?? "local";
export const BUDGET_DIRECTORY = `/tmp/contentos-benchmark-gpt52-v1-${UID}`;
const JOB_IDS = ["pilot:baseline", "pilot:candidate", "launch:baseline", "launch:candidate", "sparse:baseline", "sparse:candidate"];
const sha = value => createHash("sha256").update(value).digest("hex");

export class BenchmarkError extends Error {
  constructor(code) { super(code); this.name = "BenchmarkError"; this.code = code; }
}
function requireSafe(condition, code) { if (!condition) throw new BenchmarkError(code); }
export function worstCaseReservation(model, inputBytes, outputTokens = POLICY.maxOutputTokens) {
  requireSafe(model === POLICY.model, "unpriced_model");
  requireSafe(Number.isSafeInteger(inputBytes) && inputBytes >= 0 && inputBytes <= POLICY.maxInputBytes, "input_budget_exceeded");
  requireSafe(outputTokens === POLICY.maxOutputTokens, "unexpected_output_cap");
  return Math.ceil(((inputBytes + POLICY.framingTokens) * 175 + outputTokens * 1400) * 125 / 10_000);
}
export function validatePayload(payload) {
  requireSafe(payload && payload.model === POLICY.model, "unpriced_model");
  requireSafe(Object.keys(payload).every(key => ["model", "service_tier", "instructions", "input", "max_output_tokens", "text", "store"].includes(key)), "unexpected_payload");
  requireSafe(payload.service_tier === POLICY.serviceTier, "unpriced_service_tier");
  requireSafe(typeof payload.instructions === "string" && typeof payload.input === "string" && payload.store === false, "unexpected_payload");
  requireSafe(payload.text?.format?.type === "json_schema" && payload.text.format.strict === true, "unexpected_payload");
  requireSafe(payload.max_output_tokens === POLICY.maxOutputTokens, "unexpected_output_cap");
  const body = JSON.stringify(payload), inputBytes = Buffer.byteLength(body, "utf8");
  worstCaseReservation(payload.model, inputBytes, payload.max_output_tokens);
  return { body, inputBytes, payloadHash: sha(body), reserveGbpMicros: POLICY.reserveGbpMicros };
}

// Only pure repository prompt/config modules may execute. No route, auth, database or SDK import.
function sourceLoader(root, revision) {
  const allowed = new Set(["lib/prompts.ts", "lib/content-config.ts", "lib/generation-contract.ts", "lib/text-normalize.ts"]);
  const cache = new Map(), sources = {};
  function read(path) {
    if (!Object.hasOwn(sources, path)) {
      sources[path] = revision
        ? execFileSync("git", ["show", `${revision}:${path}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 2_000_000 })
        : readFileSync(join(root, path), "utf8");
    }
    return sources[path];
  }
  function load(path) {
    requireSafe(allowed.has(path), "unexpected_prompt_dependency");
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    const { outputText } = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    runInNewContext(outputText, { module, exports: module.exports, TextEncoder,
      crypto: { randomUUID: () => "benchmark-validation-only" },
      require: id => { requireSafe(id.startsWith("@/"), "unexpected_prompt_dependency"); return load(`${id.slice(2)}.ts`); }
    }, { timeout: 2000 });
    return module.exports;
  }
  return { load, read, sources };
}
function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    requireSafe(ts.isPropertyAssignment(property), "schema_not_literal");
    return [property.name.text, literal(property.initializer)];
  }));
  throw new BenchmarkError("schema_not_literal");
}
function routeFormat(source, candidateSchema) {
  const tree = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "client.responses.create") calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  requireSafe(calls.length === 1, "provider_call_shape_changed");
  function property(object, name) {
    requireSafe(ts.isObjectLiteralExpression(object), "provider_call_shape_changed");
    const found = object.properties.find(p => ts.isPropertyAssignment(p) && p.name.text === name);
    requireSafe(found, "provider_call_shape_changed");
    return found.initializer;
  }
  const format = property(property(calls[0].arguments[0], "text"), "format");
  if (!candidateSchema) return literal(format);
  requireSafe(property(format, "schema").getText(tree) === "generationOutputSchema(request.selectedTypes)", "candidate_schema_changed");
  return { type: literal(property(format, "type")), name: literal(property(format, "name")), strict: literal(property(format, "strict")), schema: candidateSchema };
}
export function buildBenchmarkPlan(root = ROOT) {
  const baseline = sourceLoader(root, BASELINE), candidate = sourceLoader(root);
  const baselinePrompts = baseline.load("lib/prompts.ts"), candidatePrompts = candidate.load("lib/prompts.ts");
  const contract = candidate.load("lib/generation-contract.ts");
  const types = Array.from(candidate.load("lib/content-config.ts").contentTypes, t => t.id);
  const baselineTypes = Array.from(baseline.load("lib/content-config.ts").contentTypes, t => t.id);
  requireSafe(types.length === 14 && JSON.stringify(types) === JSON.stringify(baselineTypes), "format_set_changed");
  const baseFormat = routeFormat(baseline.read("app/api/generate/route.ts"));
  const candidateFormat = routeFormat(candidate.read("app/api/generate/route.ts"), contract.generationOutputSchema(types));
  const shared = { tone: "professional", sharpness: "balanced", ctaMode: "soft", presetTopic: "none", selectedTypes: types, length: "standard" };
  const briefs = [
    { id: "pilot", source: "Fictional example: Example Studio is testing a weekly planning checklist with five freelance designers for two weeks. Results are not available yet. The checklist asks designers to choose three priorities, reserve two focus sessions, and review unfinished work each Friday. This is a pilot, not evidence of improved income or productivity.", brandName: "Example Studio", audience: "Freelance designers", offer: "Weekly planning checklist pilot", writingStyle: "Plain English, concrete steps, no hype", contentGoal: "Explain the pilot and invite thoughtful discussion" },
    { id: "launch", source: "Fictional example: Sample Workshop will offer a live 45-minute online class on organizing a small craft workspace on 12 November 2026 at 18:00 UTC. It costs GBP 12. Participants will group tools by task, label two storage zones, and plan a ten-minute weekly reset. No materials are sold with the class. No testimonials, discount, enrollment URL, capacity limit, or measured outcomes are available.", brandName: "Sample Workshop", audience: "Adults doing crafts in small homes", offer: "45-minute online workspace class for GBP 12", writingStyle: "Warm and practical", contentGoal: "Describe the class accurately", ctaMode: "product" },
    { id: "sparse", source: "Fictional example: Demo Notes is considering a monthly email about maintaining a reading habit. It has not launched, has no subscribers, and has no measured results. The first proposed issue would discuss placing a book near a familiar chair. No signup link or other offer exists.", brandName: "Demo Notes", audience: "People interested in reading", offer: "", writingStyle: "Restrained, clear, no invented anecdotes", contentGoal: "Explore the idea without overstating it", ctaMode: "none" }
  ];
  const jobs = briefs.flatMap(({ id, ...brief }) => {
    const request = JSON.parse(JSON.stringify(contract.normalizeGenerationRequest({ ...shared, ...brief })));
    return ["baseline", "candidate"].map(variant => {
      const prompts = variant === "baseline" ? baselinePrompts : candidatePrompts;
      const payload = { model: POLICY.model, service_tier: POLICY.serviceTier, instructions: prompts.buildInstructions(), input: prompts.buildInput(request),
        max_output_tokens: POLICY.maxOutputTokens, store: false, text: { format: variant === "baseline" ? baseFormat : candidateFormat } };
      return { id: `${id}:${variant}`, brief: id, variant, request, ...validatePayload(payload) };
    });
  });
  const hashes = loader => Object.fromEntries(Object.entries(loader.sources).map(([path, source]) => [path, sha(source)]));
  const provenance = { baseline: BASELINE, baselineSources: hashes(baseline), candidateSources: hashes(candidate) };
  const planHash = sha(JSON.stringify({ provenance, jobs: jobs.map(job => ({ id: job.id, payloadHash: job.payloadHash })) }));
  return { jobs, provenance, planHash, types, validateOutput: (text, request) => contract.parseGenerationOutput(text, request) };
}

export function newLedger(planHash) {
  requireSafe(/^[a-f0-9]{64}$/.test(planHash), "invalid_plan");
  return { version: 1, campaign: "contentos-gpt52-six-call-v1", planHash, model: POLICY.model, reservedGbpMicros: 0, attempts: [], halted: false };
}
export function validateLedger(ledger, planHash) {
  requireSafe(ledger && ledger.version === 1 && ledger.campaign === "contentos-gpt52-six-call-v1" && ledger.model === POLICY.model && ledger.planHash === planHash && typeof ledger.halted === "boolean", "ledger_uncertain");
  requireSafe(Array.isArray(ledger.attempts) && ledger.attempts.length <= POLICY.maxAttempts, "ledger_uncertain");
  const seen = new Set();
  for (const attempt of ledger.attempts) {
    requireSafe(attempt && JOB_IDS.includes(attempt.jobId) && !seen.has(attempt.jobId) && /^[a-f0-9]{64}$/.test(attempt.payloadHash) && Number.isSafeInteger(attempt.inputBytes) && attempt.inputBytes >= 0 && attempt.inputBytes <= POLICY.maxInputBytes && attempt.reserveGbpMicros === POLICY.reserveGbpMicros && ["reserved", "succeeded", "failed", "unknown"].includes(attempt.status), "ledger_uncertain");
    seen.add(attempt.jobId);
  }
  requireSafe(ledger.reservedGbpMicros === ledger.attempts.length * POLICY.reserveGbpMicros && ledger.reservedGbpMicros <= POLICY.capGbpMicros, "ledger_uncertain");
  return ledger;
}
export function reserveBudget(ledger, planHash, job) {
  validateLedger(ledger, planHash);
  requireSafe(!ledger.halted, "ledger_halted");
  requireSafe(ledger.attempts.length < POLICY.maxAttempts, "attempt_limit");
  requireSafe(!ledger.attempts.some(attempt => attempt.jobId === job.id), "attempt_already_reserved");
  const verified = validatePayload(JSON.parse(job.body));
  requireSafe(JOB_IDS.includes(job.id) && verified.body === job.body && verified.payloadHash === job.payloadHash && verified.inputBytes === job.inputBytes, "invalid_job");
  requireSafe(ledger.reservedGbpMicros + POLICY.reserveGbpMicros <= POLICY.capGbpMicros, "budget_exceeded");
  const next = { ...ledger, reservedGbpMicros: ledger.reservedGbpMicros + POLICY.reserveGbpMicros,
    attempts: [...ledger.attempts, { jobId: job.id, payloadHash: job.payloadHash, inputBytes: job.inputBytes, reserveGbpMicros: POLICY.reserveGbpMicros, status: "reserved" }] };
  return validateLedger(next, planHash);
}
function syncDirectory(path) { const fd = openSync(path, constants.O_RDONLY); try { fsyncSync(fd); } finally { closeSync(fd); } }
function privateDirectory(path) {
  const stat = lstatSync(path);
  requireSafe(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && (process.getuid === undefined || stat.uid === process.getuid()), "unsafe_directory");
}
function readPrivate(path) {
  const stat = lstatSync(path);
  requireSafe(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && (stat.mode & 0o077) === 0 && (process.getuid === undefined || stat.uid === process.getuid()), "ledger_uncertain");
  return JSON.parse(readFileSync(path, "utf8"));
}
function durableWrite(path, value) {
  const pending = `${path}.pending`;
  const fd = openSync(pending, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(pending, path);
  syncDirectory(dirname(path));
}
export function initializeBudget(directory, planHash) {
  // Initialization is explicit and exclusive. Missing/corrupt ledgers are NEVER recreated by --live.
  // Never delete/reinitialize this campaign directory after use. Lost tmp state requires spend review.
  mkdirSync(directory, { mode: 0o700 });
  privateDirectory(directory);
  durableWrite(join(directory, "ledger.json"), newLedger(planHash));
  syncDirectory(dirname(directory));
}
export function acquireBudget(directory, planHash) {
  privateDirectory(directory);
  const lockPath = join(directory, "run.lock");
  const token = randomUUID();
  const fd = openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, token); fsyncSync(fd); } finally { closeSync(fd); }
  syncDirectory(directory);
  const checkLock = () => requireSafe(readFileSync(lockPath, "utf8") === token, "lock_uncertain");
  const load = () => {
    checkLock();
    requireSafe(!existsSync(join(directory, "ledger.json.pending")), "ledger_uncertain");
    return validateLedger(readPrivate(join(directory, "ledger.json")), planHash);
  };
  // If validation fails, leave the lock in place for manual reconciliation; never steal stale locks.
  load();
  return {
    load,
    save(value) { checkLock(); validateLedger(value, planHash); durableWrite(join(directory, "ledger.json"), value); return load(); },
    release() { checkLock(); unlinkSync(lockPath); syncDirectory(directory); }
  };
}
function evidenceDirectory(path, root) {
  requireSafe(isAbsolute(path), "unsafe_evidence_directory");
  const target = resolve(path), tmp = realpathSync("/tmp"), canonicalRoot = realpathSync(root);
  // Resolve existing parents to reject symlink escapes, including /tmp worktrees.
  let parent = target;
  while (!existsSync(parent)) parent = dirname(parent);
  const canonical = resolve(realpathSync(parent), relative(parent, target));
  requireSafe(canonical.startsWith(`${tmp}/`) && canonical !== canonicalRoot && !canonical.startsWith(`${canonicalRoot}/`) && !canonical.startsWith(`${realpathSync(dirname(BUDGET_DIRECTORY))}/${BUDGET_DIRECTORY.split("/").at(-1)}`), "unsafe_evidence_directory");
  mkdirSync(target, { recursive: true, mode: 0o700 });
  privateDirectory(target);
  return realpathSync(target);
}
export function formatMetrics(text, request, validateOutput) {
  const metrics = { jsonValid: false, candidateContractValid: false, sectionCount: 0, expectedFormatCount: 14, missingFormats: [...request.selectedTypes], duplicateFormats: [], unexpectedFormats: [], perFormat: [] };
  let parsed;
  try { parsed = JSON.parse(text); metrics.jsonValid = true; } catch { return metrics; }
  const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
  const types = sections.map(section => section?.type).filter(type => typeof type === "string");
  metrics.sectionCount = sections.length;
  metrics.missingFormats = request.selectedTypes.filter(type => !types.includes(type));
  metrics.duplicateFormats = [...new Set(types.filter((type, index) => types.indexOf(type) !== index))];
  metrics.unexpectedFormats = [...new Set(types.filter(type => !request.selectedTypes.includes(type)))];
  metrics.perFormat = request.selectedTypes.map(type => {
    const section = sections.find(item => item?.type === type);
    return { type, present: Boolean(section), bodyCharacters: typeof section?.body === "string" ? [...section.body].length : 0, itemCount: Array.isArray(section?.items) ? section.items.length : 0, ctaPresent: typeof section?.cta === "string" && Boolean(section.cta.trim()) };
  });
  try { validateOutput(text, request); metrics.candidateContractValid = true; } catch { /* Invalid output is evidence, not a retry. */ }
  return metrics;
}
export async function fetchResponse({ body, apiKey, signal }) {
  // Recheck the actual wire body; never inherit a project's auto/priority pricing tier.
  const verified = validatePayload(JSON.parse(body));
  requireSafe(verified.body === body, "invalid_job");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", redirect: "error", signal,
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body
  });
  if (!response.ok) { await response.body?.cancel(); throw new BenchmarkError("provider_rejected"); }
  // Bound response memory too. Never log provider errors, headers, IDs, or credentials.
  const reader = response.body?.getReader();
  requireSafe(reader, "empty_response");
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      requireSafe(bytes <= 2_000_000, "response_too_large");
      chunks.push(Buffer.from(part.value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function runBenchmark(plan, { apiKey, model = POLICY.model, budgetDirectory = BUDGET_DIRECTORY, outputDirectory, root = ROOT, transport = fetchResponse } = {}) {
  requireSafe(typeof apiKey === "string" && apiKey.trim().length > 0 && !/[\r\n]/.test(apiKey), "missing_key");
  requireSafe(model === POLICY.model, "unpriced_model");
  requireSafe(JSON.stringify(plan.jobs.map(job => job.id)) === JSON.stringify(JOB_IDS), "invalid_plan");
  const output = evidenceDirectory(outputDirectory ?? `/tmp/contentos-benchmark-evidence-${UID}`, root);
  const budget = acquireBudget(budgetDirectory, plan.planHash);
  let uncertain = false;
  try {
    let ledger = budget.load();
    requireSafe(!ledger.halted, "ledger_halted");
    for (const job of plan.jobs) {
      if (ledger.attempts.some(attempt => attempt.jobId === job.id)) continue;
      const evidencePath = join(output, `${job.id.replace(":", "-")}.json`);
      requireSafe(!existsSync(evidencePath) && !existsSync(`${evidencePath}.pending`), "evidence_exists");
      uncertain = true;
      ledger = budget.save(reserveBudget(ledger, plan.planHash, job));
      // Reservation fsync + directory fsync + readback have completed before this sole transport call.
      uncertain = false;
      const started = performance.now();
      let evidence, status = "unknown", halt = false;
      try {
        const response = await transport({ body: job.body, apiKey, signal: AbortSignal.timeout(POLICY.timeoutMs) });
        const usage = Object.fromEntries(["input_tokens", "output_tokens", "total_tokens"].filter(key => Number.isSafeInteger(response.usage?.[key]) && response.usage[key] >= 0).map(key => [key, response.usage[key]]));
        halt = usage.input_tokens > POLICY.maxInputBytes + POLICY.framingTokens || usage.output_tokens > POLICY.maxOutputTokens;
        const raw = typeof response.output_text === "string" ? response.output_text : (Array.isArray(response.output) ? response.output : []).flatMap(item => Array.isArray(item.content) ? item.content : []).filter(part => part.type === "output_text" && typeof part.text === "string").map(part => part.text).join("");
        const text = raw.replaceAll(apiKey, "[REDACTED]");
        status = response.status === "completed" && ["input_tokens", "output_tokens", "total_tokens"].every(field => Object.hasOwn(usage, field)) ? "succeeded" : "unknown";
        evidence = { status, outputText: text, usage, providerCompleted: response.status === "completed", metrics: formatMetrics(text, job.request, plan.validateOutput) };
      } catch {
        // Timeout, network failure and ambiguous responses consume the full reservation permanently.
        evidence = { status: "unknown", failure: "provider_outcome_uncertain" };
      }
      uncertain = true;
      durableWrite(evidencePath, { jobId: job.id, model, latencyMs: Math.round(performance.now() - started), reserveGbpMicros: POLICY.reserveGbpMicros,
        planHash: plan.planHash, payloadHash: job.payloadHash, inputBytes: job.inputBytes, provenance: plan.provenance, syntheticRequest: job.request, ...evidence });
      ledger = budget.save({ ...ledger, halted: halt, attempts: ledger.attempts.map(attempt => attempt.jobId === job.id ? { ...attempt, status } : attempt) });
      uncertain = false;
      requireSafe(!halt, "usage_exceeds_bound");
      requireSafe(status === "succeeded", "provider_outcome_uncertain");
    }
    return { completed: ledger.attempts.length === POLICY.maxAttempts && ledger.attempts.every(attempt => attempt.status === "succeeded"),
      attempts: ledger.attempts.length, succeededAttempts: ledger.attempts.filter(attempt => attempt.status === "succeeded").length,
      reservedGbpMicros: ledger.reservedGbpMicros, outputDirectory: output };
  } finally {
    // An uncertain disk write leaves the lock, requiring review instead of a potentially unsafe rerun.
    if (!uncertain) budget.release();
  }
}
async function main() {
  const args = process.argv.slice(2);
  requireSafe(args.length === 1 && ["--dry-run", "--init-budget", "--live"].includes(args[0]), "use_dry_run_init_budget_or_live");
  requireSafe(!process.env.OPENAI_MODEL || process.env.OPENAI_MODEL === POLICY.model, "unpriced_model");
  requireSafe(!process.env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL === "https://api.openai.com/v1", "custom_endpoint_forbidden");
  const plan = buildBenchmarkPlan();
  if (args[0] === "--dry-run") {
    console.log(JSON.stringify({ mode: "offline", planHash: plan.planHash, budgetDirectory: BUDGET_DIRECTORY, policy: POLICY,
      maximumSixAttemptGbp: POLICY.reserveGbpMicros * POLICY.maxAttempts / 1_000_000,
      jobs: plan.jobs.map(({ id, inputBytes, payloadHash }) => ({ id, inputBytes, payloadHash })), provenance: plan.provenance }, null, 2));
  } else if (args[0] === "--init-budget") {
    initializeBudget(BUDGET_DIRECTORY, plan.planHash);
    console.log(JSON.stringify({ initialized: true, budgetDirectory: BUDGET_DIRECTORY, planHash: plan.planHash }));
  } else {
    const summary = await runBenchmark(plan, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL ?? POLICY.model, outputDirectory: process.env.CONTENTOS_BENCHMARK_OUTPUT_DIR });
    console.log(JSON.stringify(summary));
    if (!summary.completed) process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({ error: error instanceof BenchmarkError ? error.code : "benchmark_failed_closed", note: "No automatic retries. Inspect the budget ledger before any further live run." }));
    process.exitCode = 1;
  });
}
