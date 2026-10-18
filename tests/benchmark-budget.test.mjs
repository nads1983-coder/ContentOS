/* global AbortController, AbortSignal, Buffer, Response */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { BASELINE, POLICY, acquireBudget, buildBenchmarkPlan, fetchResponse, formatMetrics, initializeBudget, newLedger, reserveBudget, runBenchmark, validateLedger, validatePayload, worstCaseReservation } from "../scripts/benchmark-content.mjs";

// All provider calls below are mocks. Never load env files or use a real credential in this suite.
const root = resolve(import.meta.dirname, "..");
const plan = buildBenchmarkPlan(root);
const key = "synthetic-offline-test-key-not-a-credential";
const errorCode = code => error => error.code === code;
const output = JSON.stringify({ title: "Synthetic result", summary: "Only an offline fixture", sections: [] });
const response = () => ({ status: "completed", output_text: output, usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } });
function fixture(t, initialize = true) {
  const dir = mkdtempSync("/tmp/contentos-benchmark-test-");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const budgetDirectory = join(dir, "budget"), outputDirectory = join(dir, "evidence");
  if (initialize) initializeBudget(budgetDirectory, plan.planHash);
  return { dir, budgetDirectory, outputDirectory, root, apiKey: key };
}
const ledgerAt = config => JSON.parse(readFileSync(join(config.budgetDirectory, "ledger.json"), "utf8"));

test("closed historical campaign refuses live/init/setup/deploy before credential or database access", () => {
  for (const [script, mode] of [["scripts/benchmark-content.mjs", "--live"], ["scripts/benchmark-content.mjs", "--init-budget"],
    ["scripts/benchmark-preview/operator.mjs", "setup"], ["scripts/benchmark-preview/operator.mjs", "deploy-followup"]]) {
    const result = spawnSync(process.execPath, [script, mode], { cwd: root, env: {}, encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /historical_campaign_closed_new_pipeline_requires_approval/);
  }
});

test("fixed rates and conservative UTF-8/token bound cap six worst-case attempts at GBP 3.413760", () => {
  assert.equal(worstCaseReservation("gpt-5.2", 64000), 568960);
  assert.equal(POLICY.reserveGbpMicros, worstCaseReservation(POLICY.model, POLICY.maxInputBytes));
  assert.equal(POLICY.reserveGbpMicros * POLICY.maxAttempts, 3413760);
  assert.ok(POLICY.reserveGbpMicros * POLICY.maxAttempts <= POLICY.capGbpMicros);
  assert.throws(() => worstCaseReservation("gpt-5.2-pro", 100), errorCode("unpriced_model"));
  for (const n of [64001, -1, NaN, Infinity, "10", 0.5]) assert.throws(() => worstCaseReservation("gpt-5.2", n), errorCode("input_budget_exceeded"));
  assert.throws(() => worstCaseReservation("gpt-5.2", 100, 24001), errorCode("unexpected_output_cap"));
});
test("serialized payload bytes include instructions and schema, including multibyte input", () => {
  const payload = JSON.parse(plan.jobs[0].body);
  payload.input = "\u00e9".repeat(40000);
  assert.throws(() => validatePayload(payload), errorCode("input_budget_exceeded"));
  payload.input = "synthetic";
  payload.tools = [{ type: "web_search" }];
  assert.throws(() => validatePayload(payload), errorCode("unexpected_payload"));
});
test("reservation validates the exact transmitted bytes, rejecting padded or altered bodies", async t => {
  const job = plan.jobs[0];
  for (const body of [`${" ".repeat(POLICY.maxInputBytes)}${job.body}`, JSON.stringify({ ...JSON.parse(job.body), input: "altered" })]) {
    const altered = { ...job, body };
    assert.throws(() => reserveBudget(newLedger(plan.planHash), plan.planHash, altered), errorCode("invalid_job"));
    const config = fixture(t);
    let calls = 0;
    await assert.rejects(runBenchmark({ ...plan, jobs: [altered, ...plan.jobs.slice(1)] }, {
      ...config, transport: async () => { calls++; return response(); }
    }), errorCode("invalid_job"));
    assert.equal(calls, 0);
    assert.equal(ledgerAt(config).attempts.length, 0);
  }
});
test("an omitted, null, or changed output cap cannot reach transport", async t => {
  for (const cap of [undefined, null, 24001, "24000"]) {
    const payload = { ...JSON.parse(plan.jobs[0].body), max_output_tokens: cap };
    assert.throws(() => validatePayload(payload), errorCode("unexpected_output_cap"));
    const body = JSON.stringify(payload);
    const job = { ...plan.jobs[0], body, inputBytes: Buffer.byteLength(body), payloadHash: createHash("sha256").update(body).digest("hex") };
    const config = fixture(t);
    let calls = 0;
    await assert.rejects(runBenchmark({ ...plan, jobs: [job, ...plan.jobs.slice(1)] }, {
      ...config, transport: async () => { calls++; return response(); }
    }), errorCode("unexpected_output_cap"));
    assert.equal(calls, 0);
    assert.equal(ledgerAt(config).attempts.length, 0);
  }
});
test("only explicit default service tier passes validation, reservation, and the transport boundary", async t => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected network boundary"); };
  for (const serviceTier of [undefined, null, "auto", "priority", "flex", "scale", "DEFAULT"]) {
    const payload = { ...JSON.parse(plan.jobs[0].body), service_tier: serviceTier };
    assert.throws(() => validatePayload(payload), errorCode("unpriced_service_tier"));
    const body = JSON.stringify(payload);
    const job = { ...plan.jobs[0], body, inputBytes: Buffer.byteLength(body), payloadHash: createHash("sha256").update(body).digest("hex") };
    assert.throws(() => reserveBudget(newLedger(plan.planHash), plan.planHash, job), errorCode("unpriced_service_tier"));
    await assert.rejects(fetchResponse({ body, apiKey: key, signal: new AbortController().signal }), errorCode("unpriced_service_tier"));
    const config = fixture(t);
    await assert.rejects(runBenchmark({ ...plan, jobs: [job, ...plan.jobs.slice(1)] }, config), errorCode("unpriced_service_tier"));
    assert.equal(ledgerAt(config).attempts.length, 0);
  }
  assert.equal(calls, 0);
  for (const job of plan.jobs) assert.equal(JSON.parse(job.body).service_tier, "default");
});
test("archived six jobs retain the actual baseline and historical prompt-only candidate for all 14 formats", () => {
  assert.equal(plan.jobs.length, 6);
  assert.equal(plan.types.length, 14);
  const baseline = JSON.parse(plan.jobs[0].body), candidate = JSON.parse(plan.jobs[1].body);
  assert.equal(baseline.text.format.schema.properties.sections.minItems, 1);
  assert.equal(baseline.text.format.schema.properties.sections.items.properties.type.enum, undefined);
  assert.equal(candidate.text.format.schema.properties.sections.minItems, 14);
  assert.deepEqual(candidate.text.format.schema.properties.sections.items.properties.type.enum, plan.types);
  assert.notEqual(baseline.instructions, candidate.instructions);
  assert.notEqual(baseline.input, candidate.input);
  for (const job of plan.jobs) {
    assert.deepEqual(job.request.selectedTypes, plan.types);
    assert.equal(JSON.parse(job.body).max_output_tokens, 24000);
    assert.equal(job.inputBytes, Buffer.byteLength(job.body));
    assert.equal(job.reserveGbpMicros, 568960);
  }
  for (const [file, hash] of Object.entries(plan.provenance.baselineSources)) {
    const original = execFileSync("git", ["show", `${BASELINE}:${file}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(createHash("sha256").update(original).digest("hex"), hash);
  }
});
test("pure budget transitions reserve before success and never refund failures or permit seventh attempts", () => {
  let ledger = newLedger(plan.planHash);
  for (const job of plan.jobs) {
    ledger = reserveBudget(ledger, plan.planHash, job);
    ledger.attempts.at(-1).status = "unknown";
  }
  assert.equal(ledger.reservedGbpMicros, 3413760);
  assert.throws(() => reserveBudget(ledger, plan.planHash, plan.jobs[0]), errorCode("attempt_limit"));
  const first = reserveBudget(newLedger(plan.planHash), plan.planHash, plan.jobs[0]);
  assert.throws(() => reserveBudget(first, plan.planHash, plan.jobs[0]), errorCode("attempt_already_reserved"));
  for (const corrupt of [{ ...first, reservedGbpMicros: 0 }, { ...first, attempts: [...first.attempts, first.attempts[0]] }, { ...first, model: "other" }, { ...first, halted: undefined }]) {
    assert.throws(() => validateLedger(corrupt, plan.planHash), errorCode("ledger_uncertain"));
  }
});
test("provider mock observes durable reservation on disk before every invocation", async t => {
  const config = fixture(t);
  let calls = 0;
  const summary = await runBenchmark(plan, { ...config, transport: async ({ body, signal }) => {
    calls++;
    const ledger = ledgerAt(config);
    assert.equal(ledger.attempts.length, calls);
    assert.equal(ledger.attempts.at(-1).status, "reserved");
    assert.equal(ledger.reservedGbpMicros, calls * POLICY.reserveGbpMicros);
    assert.equal(body, plan.jobs[calls - 1].body);
    assert.equal(signal.aborted, false);
    assert.equal(existsSync(join(config.budgetDirectory, "ledger.json.pending")), false);
    return response();
  } });
  assert.equal(calls, 6);
  assert.equal(summary.completed, true);
  assert.equal(summary.reservedGbpMicros, 3413760);
  const files = readdirSync(config.outputDirectory);
  assert.equal(files.length, 6);
  const evidence = JSON.parse(readFileSync(join(config.outputDirectory, files[0]), "utf8"));
  assert.deepEqual(evidence.usage, { input_tokens: 100, output_tokens: 50, total_tokens: 150 });
  assert.equal(evidence.metrics.candidateContractValid, false);
  assert.ok(evidence.latencyMs >= 0);
  assert.equal(evidence.provenance.baseline, BASELINE);
  const rerun = await runBenchmark(plan, { ...config, outputDirectory: join(config.dir, "other-evidence"), transport: async () => { calls++; return response(); } });
  assert.equal(rerun.attempts, 6);
  assert.equal(calls, 6, "changing evidence location must not reset budget");
});
test("all ambiguous failures count across reruns; none retries the same job or logs raw error/key", async t => {
  const config = fixture(t);
  let calls = 0;
  const transport = async () => { calls++; throw new Error(`PRIVATE_RAW_ERROR ${key}`); };
  for (let i = 0; i < 6; i++) {
    await assert.rejects(runBenchmark(plan, { ...config, transport }), errorCode("provider_outcome_uncertain"));
    assert.equal(ledgerAt(config).attempts.length, i + 1);
    assert.equal(ledgerAt(config).reservedGbpMicros, (i + 1) * POLICY.reserveGbpMicros);
  }
  const exhausted = await runBenchmark(plan, { ...config, transport });
  assert.equal(calls, 6);
  assert.equal(exhausted.completed, false);
  for (const file of readdirSync(config.outputDirectory)) {
    const text = readFileSync(join(config.outputDirectory, file), "utf8");
    assert.equal(text.includes(key), false);
    assert.equal(text.includes("PRIVATE_RAW_ERROR"), false);
  }
});
test("missing key, unpriced model, missing ledger and corrupt ledger all fail before transport", async t => {
  let calls = 0;
  const transport = async () => { calls++; return response(); };
  const config = fixture(t);
  await assert.rejects(runBenchmark(plan, { ...config, apiKey: "", transport }), errorCode("missing_key"));
  await assert.rejects(runBenchmark(plan, { ...config, model: "gpt-5.2-pro", transport }), errorCode("unpriced_model"));
  const missing = fixture(t, false);
  await assert.rejects(runBenchmark(plan, { ...missing, transport }));
  writeFileSync(join(config.budgetDirectory, "ledger.json"), "{broken");
  await assert.rejects(runBenchmark(plan, { ...config, transport }));
  assert.equal(calls, 0);
  assert.equal(existsSync(join(config.budgetDirectory, "run.lock")), true);
});
test("initialization is exclusive and changed candidate snapshots cannot reuse the old budget", t => {
  const config = fixture(t);
  assert.throws(() => initializeBudget(config.budgetDirectory, plan.planHash));
  assert.throws(() => acquireBudget(config.budgetDirectory, "0".repeat(64)), errorCode("ledger_uncertain"));
});
test("parallel runners cannot double-spend; stale locks are never automatically stolen", async t => {
  const config = fixture(t);
  let started, finish;
  const entered = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { finish = resolve; });
  let calls = 0;
  const first = runBenchmark(plan, { ...config, transport: async () => { calls++; if (calls === 1) { started(); await gate; } return response(); } });
  await entered;
  try {
    await assert.rejects(runBenchmark(plan, { ...config, transport: async () => { calls++; return response(); } }));
    assert.equal(calls, 1);
  } finally { finish(); }
  await first;
  writeFileSync(join(config.budgetDirectory, "run.lock"), "abandoned-process", { mode: 0o600 });
  await assert.rejects(runBenchmark(plan, { ...config, transport: async () => { calls++; return response(); } }));
  assert.equal(calls, 6);
});
test("uncertain reservation writes fail closed before network and uncertain completion retains spend", async t => {
  const config = fixture(t);
  writeFileSync(join(config.budgetDirectory, "ledger.json.pending"), "interrupted-write", { mode: 0o600 });
  let calls = 0;
  await assert.rejects(runBenchmark(plan, { ...config, transport: async () => { calls++; return response(); } }), errorCode("ledger_uncertain"));
  assert.equal(calls, 0);
  const another = fixture(t);
  await assert.rejects(runBenchmark(plan, { ...another, transport: async () => {
    calls++;
    writeFileSync(join(another.budgetDirectory, "ledger.json.pending"), "uncertain", { mode: 0o600 });
    return response();
  } }));
  assert.equal(calls, 1);
  assert.equal(ledgerAt(another).reservedGbpMicros, POLICY.reserveGbpMicros);
  assert.equal(ledgerAt(another).attempts[0].status, "reserved");
  assert.equal(existsSync(join(another.budgetDirectory, "run.lock")), true);
});
test("real transport configuration has one fetch per call, fixed URL, no redirects and 90s timeout", async t => {
  const config = fixture(t);
  const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
  const timeouts = [];
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; });
  AbortSignal.timeout = milliseconds => { timeouts.push(milliseconds); return new AbortController().signal; };
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.redirect, "error");
    assert.equal(options.method, "POST");
    assert.equal(JSON.parse(options.body).model, "gpt-5.2");
    assert.equal(JSON.parse(options.body).service_tier, "default");
    assert.equal(JSON.parse(options.body).max_output_tokens, 24000);
    return Response.json(response());
  };
  await runBenchmark(plan, config);
  assert.equal(calls, 6);
  assert.deepEqual(timeouts, Array(6).fill(90000));
});
test("reported usage beyond the reserved token bound halts further attempts permanently", async t => {
  const config = fixture(t);
  let calls = 0;
  const transport = async () => { calls++; return { ...response(), usage: { input_tokens: 68097, output_tokens: 1 } }; };
  await assert.rejects(runBenchmark(plan, { ...config, transport }), errorCode("usage_exceeds_bound"));
  assert.equal(ledgerAt(config).halted, true);
  await assert.rejects(runBenchmark(plan, { ...config, transport }), errorCode("ledger_halted"));
  assert.equal(calls, 1);
});
test("HTTP rejection and abort consume exactly one reserved attempt without retry", async t => {
  const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
  t.after(() => { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; });
  for (const kind of ["rejected", "aborted"]) {
    const config = fixture(t);
    let calls = 0;
    AbortSignal.timeout = milliseconds => {
      assert.equal(milliseconds, 90000);
      const controller = new AbortController();
      if (kind === "aborted") controller.abort();
      return controller.signal;
    };
    globalThis.fetch = async (_url, options) => {
      calls++;
      if (kind === "aborted") { assert.equal(options.signal.aborted, true); throw new Error(`private abort ${key}`); }
      return new Response(`private provider error ${key}`, { status: 429 });
    };
    await assert.rejects(runBenchmark(plan, config), errorCode("provider_outcome_uncertain"));
    assert.equal(calls, 1);
    assert.equal(ledgerAt(config).reservedGbpMicros, POLICY.reserveGbpMicros);
    assert.equal(ledgerAt(config).attempts[0].status, "unknown");
    const evidence = readFileSync(join(config.outputDirectory, "pilot-baseline.json"), "utf8");
    assert.equal(evidence.includes(key), false);
    assert.equal(evidence.includes("private"), false);
  }
});
test("missing usage is uncertain and output evidence redacts the supplied credential", async t => {
  const config = fixture(t);
  await assert.rejects(runBenchmark(plan, { ...config, transport: async () => ({ status: "completed", output_text: `Synthetic fixture ${key}` }) }), errorCode("provider_outcome_uncertain"));
  const evidence = readFileSync(join(config.outputDirectory, "pilot-baseline.json"), "utf8");
  assert.equal(evidence.includes(key), false);
  assert.equal(evidence.includes("[REDACTED]"), true);
  assert.equal(ledgerAt(config).reservedGbpMicros, POLICY.reserveGbpMicros);
});
test("evidence paths cannot be inside the checkout or outside tmp", async t => {
  const config = fixture(t);
  let calls = 0;
  for (const path of [root, join(root, "benchmark-evidence"), "/var/benchmark-evidence", "relative-path"]) {
    await assert.rejects(runBenchmark(plan, { ...config, outputDirectory: path, transport: async () => { calls++; return response(); } }), errorCode("unsafe_evidence_directory"));
  }
  assert.equal(calls, 0);
});
test("format metrics distinguish missing, duplicate and malformed results without repair or retry", () => {
  const request = plan.jobs[0].request;
  const invalid = formatMetrics("not JSON", request, plan.validateOutput);
  assert.equal(invalid.jsonValid, false);
  const metrics = formatMetrics(JSON.stringify({ sections: [{ type: "linkedin", body: "Text", items: [] }, { type: "linkedin" }, { type: "unknown" }] }), request, plan.validateOutput);
  assert.equal(metrics.sectionCount, 3);
  assert.deepEqual(metrics.duplicateFormats, ["linkedin"]);
  assert.deepEqual(metrics.unexpectedFormats, ["unknown"]);
  assert.equal(metrics.missingFormats.length, 13);
  assert.equal(metrics.candidateContractValid, false);
});
