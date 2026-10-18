import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { executePlan, validatePayload, validateRuntime, validateManifest, responseEvidence, providerCall, sha, PROJECT, ROLE, BASELINE, CANDIDATE, SEALED_HASH } from "../scripts/grounding-benchmark/runtime.mjs";

const key = "sk-isolated-test-not-a-real-key-000000000000";
test("consumed authorization refuses preparation and execution before database or provider access", () => {
  for (const mode of ["prepare", "execute"]) {
    const result = spawnSync(process.execPath, ["scripts/grounding-benchmark/operator.mjs", mode], {
      env: { PATH: process.env.PATH, DATABASE_URL: "invalid-and-must-not-be-read" }, encoding: "utf8", timeout: 10000
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /controlled_grounding_campaign_closed/);
    assert.match(result.stderr, /"providerCalls":0/);
    assert.equal(result.stdout, "");
  }
});
const body = (review = false) => JSON.stringify({ model: "gpt-5.2", store: false, service_tier: "default", instructions: "Synthetic fixture", input: "Synthetic fixture", max_output_tokens: review ? 16000 : 24000, text: { format: { type: "json_schema", strict: true, schema: {} } } });
const response = (extra = {}) => ({ status: "completed", service_tier: "default", model: "gpt-5.2-2025-12-11", output_text: "{}", usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 }, ...extra });
function fixture(options = {}) {
  let clock = 1000, paid = 0, disabled = false;
  const packs = ["H1", "H2", "H3"].flatMap(id => ["baseline", "candidate"].map(variant => ({ id: `${id}:${variant}`, variant, body: body(), payloadHash: sha(body()), request: { selectedTypes: Array.from({ length: 14 }, (_, i) => `format${i}`) } })));
  const jobs = packs.flatMap(p => [{ id: `${p.id}:draft`, state: "ready", payloadHash: p.payloadHash }, ...(p.variant === "candidate" ? [1, 2].map(i => ({ id: `${p.id}:review${i}`, state: "ready", payloadHash: null })) : [])]);
  const plan = { planHash: "a".repeat(64), expires: 9999999, packs, modules: { baseline: "baseline", candidate: "candidate" } };
  const evidence = new Map(), outcomes = new Map(), admissions = [], timeouts = [];
  class GroundingError extends Error { reason = "review_unavailable"; }
  const loader = () => path => {
    if (path === "baseline-parser.ts") return { parseOpenAIJson: JSON.parse };
    if (path === "lib/generation-contract.ts") return { parseGenerationOutput: JSON.parse };
    return { GroundingError, groundingReviewInstructions: "Synthetic fixture", groundingReviewSchema: () => ({}),
      groundGeneration: async (value, _request, review) => { await review("Synthetic review input"); if (options.blocked) throw new GroundingError(); if (options.repair) await review("Synthetic corrected review"); return value; } };
  };
  const ledger = {
    inspect: async () => ({ enabled: !disabled, unexpired: true, reservedGbpMicros: 0, jobs }),
    reserve: async (_h, id, hash, previous) => {
      if (options.reserveFailure && id.endsWith("review1")) throw new Error("database failed");
      const job = jobs.find(j => j.id === id); assert.equal(job.state, "ready");
      const previousId = id.endsWith("review1") ? id.replace("review1", "draft") : id.endsWith("review2") ? id.replace("review2", "review1") : null;
      assert.equal(previous, previousId ? evidence.get(previousId).responseHash : null);
      job.state = "reserved"; job.payloadHash = hash; admissions.push(id); return true;
    },
    finish: async (_h, id, state, value) => { if (options.finishFailure && id.endsWith("review1")) throw new Error("lost database ack"); jobs.find(j => j.id === id).state = state; evidence.set(id, value); },
    outcome: async (_h, id, value) => { outcomes.set(id, value); },
    disable: async () => { disabled = true; }
  };
  const transport = async (_body, _key, timeout) => { paid++; timeouts.push(timeout); clock += options.latency ?? 1000; if (options.throwAt === paid) throw new Error("network uncertain"); return options.badUsage ? response({ usage: null }) : response(); };
  return { plan, ledger, transport, load: loader, now: () => clock, apiKey: key, outcomes, evidence, admissions, timeouts, paid: () => paid, disabled: () => disabled };
}

test("six drafts plus three reviews, exact dynamic stage binding, no retries", async () => {
  const f = fixture(); const result = await executePlan(f.plan, f);
  assert.equal(result.calls, 9); assert.equal(f.outcomes.size, 6); assert.equal(f.disabled(), true);
  assert.deepEqual(f.timeouts.slice(6), [89000, 89000, 89000]);
});
test("bounded repair plus fresh review uses at most twelve calls", async () => {
  const f = fixture({ repair: true }); await executePlan(f.plan, f);
  assert.equal(f.paid(), 12); assert.equal(new Set(f.admissions).size, 12);
  assert.deepEqual(f.timeouts.slice(6), [89000, 88000, 89000, 88000, 89000, 88000]);
});
test("normal grounding rejections are blocked, not delivered or retried", async () => {
  const f = fixture({ blocked: true }); await executePlan(f.plan, f);
  assert.equal(f.paid(), 9); assert.equal([...f.outcomes.values()].filter(v => v.status === "blocked").length, 3);
});
for (const throwAt of [1, 7]) test(`uncertain call ${throwAt} stops the whole campaign with reservation retained`, async () => {
  const f = fixture({ throwAt }); await assert.rejects(executePlan(f.plan, f), /provider_outcome_uncertain/);
  assert.equal(f.paid(), throwAt); assert.equal(f.admissions.length, throwAt); assert.equal([...f.evidence.values()].at(-1).failure, "provider_outcome_uncertain"); assert.equal(f.disabled(), true);
});
for (const failure of ["reserveFailure", "finishFailure"]) test(`${failure} during review cannot become a quality rejection and continue spending`, async () => {
  const f = fixture({ [failure]: true }); await assert.rejects(executePlan(f.plan, f)); assert.equal(f.paid(), failure === "reserveFailure" ? 6 : 7); assert.equal(f.disabled(), true);
});
test("missing usage is uncertain, never treated as free", async () => {
  const f = fixture({ badUsage: true }); await assert.rejects(executePlan(f.plan, f)); assert.equal(f.paid(), 1); assert.equal(f.admissions.length, 1);
});
test("an expired pack deadline refuses further calls", async () => {
  const f = fixture({ latency: 90000 }); await executePlan(f.plan, f); assert.equal(f.paid(), 6); assert.equal([...f.outcomes.values()].filter(v => v.status === "blocked").length, 3);
});
test("non-pristine ledger cannot execute", async () => {
  const f = fixture(); f.ledger.inspect = async () => ({ enabled: true, unexpired: true, reservedGbpMicros: 568960 }); await assert.rejects(executePlan(f.plan, f), /ledger_not_pristine/); assert.equal(f.paid(), 0);
});
test("payload bounds reject unpriced models, tool calls, high output, and huge reviews", () => {
  for (const change of [{ model: "unpriced" }, { tools: [] }, { service_tier: "priority" }, { max_output_tokens: 99999 }, { store: true }]) assert.throws(() => validatePayload(JSON.stringify({ ...JSON.parse(body()), ...change }), "draft"));
  assert.throws(() => validatePayload(JSON.stringify({ ...JSON.parse(body(true)), input: "x".repeat(256001) }), "review1"));
  assert.equal(validatePayload(body(), "draft").reserve * 6 + validatePayload(body(true), "review1").reserve * 6, 8507520);
});
test("usage costing includes cache and output tokens and rejects unknown quantities", () => {
  const e = responseEvidence(response(), body(), "draft", key, 12); assert.equal(e.costUsd, .000455); assert.equal(e.responseHash, sha("{}"));
  for (const bad of [{ usage: null }, { service_tier: "priority" }, { model: "unknown" }, { usage: { input_tokens: 100, output_tokens: 20, total_tokens: 121 } }]) assert.throws(() => responseEvidence(response(bad), body(), "draft", key, 12));
});
test("transport sends one nonredirecting request and never retries HTTP failures", async () => {
  let calls = 0;
  await assert.rejects(providerCall(body(), key, 1000, async (url, opts) => { calls++; assert.equal(url, "https://api.openai.com/v1/responses"); assert.equal(opts.redirect, "error"); return new Response("unavailable", { status: 503 }); }), /provider_rejected/);
  assert.equal(calls, 1);
});
test("runtime rejects production, customer database credentials, or weakened TLS", () => {
  const env = { VERCEL_ENV: "preview", VERCEL_PROJECT_ID: PROJECT, OPENAI_API_KEY: key, BENCHMARK_DATABASE_URL: `postgresql://${ROLE}:synthetic@ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech/contentos?sslmode=verify-full` };
  assert.ok(validateRuntime(env));
  for (const bad of [{ VERCEL_ENV: "production" }, { VERCEL_PROJECT_ID: "other" }, { OPENAI_API_KEY: "" }, { BENCHMARK_DATABASE_URL: env.BENCHMARK_DATABASE_URL.replace(ROLE, "contentos_owner") }, { BENCHMARK_DATABASE_URL: env.BENCHMARK_DATABASE_URL.replace("verify-full", "require") }]) assert.throws(() => validateRuntime({ ...env, ...bad }));
});
test("manifest is signed, commit/brief bound, expiring and immutable", () => {
  const f = fixture(), now = Date.now(), { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const material = { project: PROJECT, environment: "preview", role: ROLE, baseline: BASELINE, candidate: CANDIDATE, sealedHash: SEALED_HASH, expires: now + 60000, capGbpMicros: 9000000, maxRequests: 12, maxReservedGbpMicros: 8507520, packs: f.plan.packs, modules: { baseline: {}, candidate: {} }, moduleHashes: { baseline: {}, candidate: {} } };
  const manifest = JSON.stringify({ ...material, planHash: sha(JSON.stringify(material)) });
  const signed = { manifest, signature: sign(null, Buffer.from(manifest), privateKey).toString("base64") };
  assert.ok(validateManifest(signed, publicKey, now));
  assert.throws(() => validateManifest({ ...signed, manifest: manifest.replace(CANDIDATE, BASELINE) }, publicKey, now));
  assert.throws(() => validateManifest(signed, publicKey, now + 70000));
});
