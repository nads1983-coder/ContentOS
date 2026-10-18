import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
function loadTs(relative, mocks = {}, cache = new Map()) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  });
  const require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("@/")) return loadTs(`${id.slice(2)}.ts`, mocks, cache);
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}

const contract = loadTs("lib/generation-contract.ts");
const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse } = contract;
const source = "We are testing a weekly planning checklist with five freelance designers. Results are not available yet.";
const request = (selectedTypes = ["linkedin"], extra = {}) => normalize({ source, selectedTypes, ...extra });
function section(type, extra = {}) {
  return { id: `${type}-1`, type, title: `Weekly planning ${type}`, platform: type, body: source, items: [], cta: "What makes your planning easier?", ...extra };
}
function output(types = ["linkedin"], extra = {}) {
  return { title: "Weekly planning pilot", summary: "A checklist pilot with five designers, without results yet.", sections: types.map((type) => section(type)), ...extra };
}
const parseObject = (value, req = request()) => parse(JSON.stringify(value), req);

class ReservationError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function routeFixture(options = {}) {
  const calls = [];
  const requestId = "a189b831-43ea-479c-89ab-e639734983ab";
  let clientOptions;
  let providerInput;
  const analytics = [];
  const errors = [];
  const gateCalls = [];
  const route = loadTs("app/api/generate/route.ts", {
    "@/lib/request-security": { rejectUnsafeWrite: () => options.unsafe ? Response.json({ error: "Unsafe origin." }, { status: 403 }) : null },
    "@/lib/auth": { getCurrentUser: async () => options.anonymous ? null : { id: "user-test", email: "test@example.invalid" } },
    "@/lib/backend": { isDatabaseConfigured: () => { gateCalls.push("database_config"); return !options.noDatabase; } },
    "@/lib/monitoring": {
      captureServerError: (error, context) => errors.push({ message: error.message, context }),
      analyticsEvent: (event, fields) => { if (options.analyticsError) throw new Error("logger unavailable"); analytics.push({ event, fields }); }
    },
    "@/lib/generation-contract": contract,
    "@/lib/generation-reservation": options.reservationModule ?? { GenerationReservationError: ReservationError },
    "next/server": { NextResponse: Response },
    "@/lib/repository": {
      reserveTextGeneration: async (userId, id, input) => {
        calls.push("reserve");
        assert.equal(userId, "user-test");
        assert.equal(input.source, source);
        assert.equal(id, input.requestId ?? id);
        if (options.reservationError) throw options.reservationError;
        if (options.replay) return { status: "replay", requestId: id, result: options.replay };
        return { status: "reserved", requestId: id, fingerprint: "fixture-fingerprint", plan: "free" };
      },
      completeTextGeneration: async (_userId, _id, fingerprint, result) => {
        calls.push("complete");
        assert.equal(fingerprint, "fixture-fingerprint");
        if (options.saveError) throw new Error("uncertain commit");
        return result;
      },
      failTextGeneration: async () => { calls.push("fail"); if (options.failError) throw new Error("storage unavailable"); },
      ...options.repository
    },
    openai: class {
      constructor(input) {
        clientOptions = input;
        if (options.sdkFetch) {
          const RealOpenAI = nativeRequire("openai").default;
          return new RealOpenAI({ ...input, fetch: options.sdkFetch });
        }
      }
      responses = { create: async (input, config) => {
        calls.push("provider");
        providerInput = input;
        assert.ok(config.signal instanceof AbortSignal);
        if (options.providerError) throw options.providerError;
        return options.providerResponse ?? { status: "completed", output_text: JSON.stringify(output()) };
      } };
    }
  });
  const previous = process.env.OPENAI_API_KEY;
  try {
    if (options.noKey) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = "offline-placeholder-not-a-real-key";
    const headers = new Headers();
    if (options.accountHeader !== null) headers.set("X-ContentOS-Account", options.accountHeader ?? "user-test");
    const incoming = new Request("https://test.local/api/generate", {
      method: "POST", headers, body: options.rawBody ?? JSON.stringify(options.body ?? { source, selectedTypes: ["linkedin"], requestId })
    });
    const response = await route.POST(incoming);
    return { response, body: await response.json(), calls, clientOptions, providerInput, analytics, errors, gateCalls, bodyRead: incoming.bodyUsed };
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
}

test("route reserves before a bounded provider call and completes only validated output", async () => {
  const { response, body, calls, clientOptions, providerInput } = await routeFixture();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["reserve", "provider", "complete"]);
  assert.equal(body.sections.length, 1);
  assert.equal(clientOptions.maxRetries, 0);
  assert.equal(clientOptions.logLevel, "off");
  assert.equal(clientOptions.timeout, 90_000);
  assert.equal(providerInput.max_output_tokens, 24_000);
  assert.equal(response.headers.get("X-Request-Id"), "a189b831-43ea-479c-89ab-e639734983ab");
});

test("route rejects unsafe/unauthenticated/invalid/unconfigured requests before admission", async () => {
  for (const [options, status] of [[{ unsafe: true }, 403], [{ anonymous: true }, 401],
    [{ body: { source: "bad" } }, 400], [{ noDatabase: true }, 503], [{ noKey: true }, 503]]) {
    const result = await routeFixture(options);
    assert.equal(result.response.status, status);
    assert.deepEqual(result.calls, []);
  }
});

test("text route rejects missing, empty, and stale account headers before reading data or accessing storage", async () => {
  for (const accountHeader of [null, "", "previous-account"]) {
    const result = await routeFixture({ accountHeader, rawBody: "{", noDatabase: true });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, "account_changed");
    assert.match(result.body.error, /Reload the page or sign in again/);
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.gateCalls, []);
    assert.equal(result.bodyRead, false);
    assert.equal(result.clientOptions, undefined);
    assert.deepEqual(result.analytics, []);
    assert.ok(!JSON.stringify(result.body).includes("user-test"));
    assert.ok(!JSON.stringify(result.body).includes("previous-account"));
  }
  assert.equal((await routeFixture({ anonymous: true, accountHeader: null })).response.status, 401);
});

test("route quota, paid-format, conflict and unavailable admission errors never call provider", async () => {
  for (const [status, code] of [[429, "quota_exceeded"], [403, "paid_output_required"], [409, "request_mismatch"], [409, "request_in_progress"]]) {
    const result = await routeFixture({ reservationError: new ReservationError("Reservation refused.", status, code) });
    assert.equal(result.response.status, status);
    assert.equal(result.body.code, code);
    assert.deepEqual(result.calls, ["reserve"]);
  }
  const result = await routeFixture({ reservationError: new Error("database unavailable") });
  assert.equal(result.response.status, 503);
  assert.deepEqual(result.calls, ["reserve"]);
});

test("route returns completed replays without another provider call or usage event", async () => {
  const replay = parseObject(output());
  const result = await routeFixture({ replay });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, replay);
  assert.deepEqual(result.calls, ["reserve"]);
});

test("route marks malformed/refused/incomplete packs failed without completing usage", async () => {
  for (const providerResponse of [
    { status: "completed", output_text: JSON.stringify(output([], { sections: [] })) },
    { status: "completed", output_text: "" },
    { status: "incomplete", output_text: JSON.stringify(output()) },
    { status: "failed", output_text: JSON.stringify(output()) }
  ]) {
    const result = await routeFixture({ providerResponse });
    assert.equal(result.response.status, 502);
    assert.equal(result.body.code, "invalid_generation");
    assert.deepEqual(result.calls, ["reserve", "provider", "fail"]);
  }
});

test("route provider errors and timeouts do not retry or complete usage", async () => {
  for (const name of ["Error", "APIConnectionTimeoutError", "APIUserAbortError"]) {
    const providerError = new Error("fixture failure");
    providerError.name = name;
    const result = await routeFixture({ providerError, failError: true });
    assert.equal(result.response.status, name === "Error" ? 500 : 504);
    assert.deepEqual(result.calls, ["reserve", "provider", "fail"]);
  }
});

test("uncertain completion keeps reservation intact and returns request ID for replay", async () => {
  const result = await routeFixture({ saveError: true });
  assert.equal(result.response.status, 503);
  assert.equal(result.body.code, "generation_save_uncertain");
  assert.equal(result.body.requestId, "a189b831-43ea-479c-89ab-e639734983ab");
  assert.deepEqual(result.calls, ["reserve", "provider", "complete"]);
});

test("installed OpenAI SDK makes one fetch on 429, 500, connection failure, and timeout", async () => {
  for (const failure of [429, 500, "connection", "timeout"]) {
    let fetches = 0;
    const result = await routeFixture({ sdkFetch: async () => {
      fetches++;
      if (typeof failure === "string") throw new Error(failure === "timeout" ? "connection timed out" : "connection failed");
      return Response.json({ error: { message: "offline test rejection" } }, { status: failure, headers: { "x-should-retry": "true" } });
    } });
    assert.equal(fetches, 1);
    assert.deepEqual(result.calls, ["reserve", "fail"]);
    assert.equal(result.response.status, failure === "timeout" ? 504 : 500);
  }
});

test("success analytics contain only elapsed time, output count, and provider token counts", async () => {
  const result = await routeFixture({ providerResponse: {
    status: "completed", output_text: JSON.stringify(output()),
    usage: { input_tokens: 101, output_tokens: 202, total_tokens: 303, source, email: "private@example.invalid" }
  } });
  assert.equal(result.response.status, 200);
  assert.equal(result.analytics.length, 1);
  assert.equal(result.analytics[0].event, "text_generation_success");
  const fields = result.analytics[0].fields;
  assert.deepEqual(Object.keys(fields).sort(), ["duration_ms", "output_count", "input_tokens", "output_tokens", "total_tokens"].sort());
  assert.ok(Number.isSafeInteger(fields.duration_ms) && fields.duration_ms >= 0);
  assert.equal(fields.output_count, 1);
  assert.equal(fields.total_tokens, 303);
  assert.ok(Object.values(fields).every(value => typeof value === "number"));
  assert.deepEqual(result.errors, []);
});

test("failure and replay metrics omit malformed token values and all identifying fields", async () => {
  const invalid = await routeFixture({ providerResponse: {
    status: "incomplete", output_text: source,
    usage: { input_tokens: "private@example.invalid", output_tokens: -1, total_tokens: Infinity }
  } });
  assert.equal(invalid.analytics[0].event, "text_generation_failure");
  assert.deepEqual(Object.keys(invalid.analytics[0].fields).sort(), ["duration_ms", "output_count"]);
  assert.equal(invalid.analytics[0].fields.output_count, 0);
  const replay = await routeFixture({ replay: parseObject(output()) });
  assert.equal(replay.analytics[0].event, "text_generation_replay");
  assert.deepEqual(Object.keys(replay.analytics[0].fields).sort(), ["duration_ms", "output_count"]);
});

test("raw provider and repository errors never enter route logs or analytics", async () => {
  const secret = `${source} private@example.invalid Private Brand user-test`;
  for (const options of [{ providerError: new Error(secret), failError: true }, { reservationError: new Error(secret) }, { saveError: true }]) {
    const result = await routeFixture(options);
    assert.ok(result.errors.length > 0);
    for (const error of result.errors) {
      assert.equal(error.message, "Generation operation failed.");
      assert.deepEqual(Object.keys(error.context).sort(), ["error_class", "event", "route"]);
      assert.ok(["invalid_output", "provider_timeout", "provider_abort", "operation_failure"].includes(error.context.error_class));
    }
    const logs = JSON.stringify({ analytics: result.analytics, errors: result.errors });
    for (const privateValue of [source, "private@example.invalid", "Private Brand", "user-test", "a189b831-43ea-479c-89ab-e639734983ab"]) assert.ok(!logs.includes(privateValue));
  }
});

test("analytics failures cannot turn a committed generation into an error", async () => {
  const result = await routeFixture({ analyticsError: true });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.calls, ["reserve", "provider", "complete"]);
});

// Real reservation transitions, with an in-memory commit boundary. This tests
// route orchestration across requests, not Postgres locks or network behavior.
function statefulReservationHarness(commitMode = "ok", used = 0) {
  const reservationModule = loadTs("lib/generation-reservation.ts");
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  let state = { id: "user-test", email: "test@example.invalid", plan: "free", subscription_status: "none", generation_usage_json: { [start]: used } };
  let completions = 0;
  let failures = 0;
  return {
    reservationModule,
    get state() { return state; },
    get completions() { return completions; },
    get failures() { return failures; },
    repository: {
      reserveTextGeneration: async (userId, id, input) => {
        const next = reservationModule.reserveGenerationInProfile(state, userId, id, input, now);
        state = next.data;
        return next.result;
      },
      completeTextGeneration: async (userId, id, fingerprint, result) => {
        completions++;
        const next = reservationModule.completeGenerationInProfile(state, userId, id, fingerprint, result, now);
        if (commitMode === "rollback") throw new Error("commit rolled back");
        state = next.data;
        if (commitMode === "lost-ack") throw new Error("commit acknowledgement lost");
        return next.result;
      },
      failTextGeneration: async (userId, id, fingerprint) => {
        failures++;
        state = reservationModule.failGenerationInProfile(state, userId, id, fingerprint, now).data;
      }
    }
  };
}

test("lost completion acknowledgement replays committed output and charges exactly once", async () => {
  const h = statefulReservationHarness("lost-ack");
  const first = await routeFixture(h);
  assert.equal(first.response.status, 503);
  assert.deepEqual(first.calls, ["provider"]);
  const retry = await routeFixture(h);
  assert.equal(retry.response.status, 200);
  assert.deepEqual(retry.calls, []);
  assert.equal(retry.body.id, h.state.generation_history_json[0].payload.id);
  assert.equal(h.state.usage_events_json.length, 1);
  assert.equal(h.state.generation_history_json.length, 1);
  assert.equal(Object.values(h.state.generation_usage_json)[0], 1);
  assert.equal(h.completions, 1);
  assert.equal(h.failures, 0);
});

test("rolled-back completion leaves pending quota and blocks same-ID and new-ID duplicate retries", async () => {
  const h = statefulReservationHarness("rollback", 2);
  assert.equal((await routeFixture(h)).response.status, 503);
  const retry = await routeFixture(h);
  assert.equal(retry.body.code, "request_in_progress");
  assert.deepEqual(retry.calls, []);
  const duplicate = await routeFixture({ ...h, body: { source, selectedTypes: ["linkedin"], requestId: "b189b831-43ea-479c-89ab-e639734983ab" } });
  assert.equal(duplicate.body.code, "duplicate_in_progress");
  const different = await routeFixture({ ...h, body: { source, selectedTypes: ["linkedin"], length: "short", requestId: "c189b831-43ea-479c-89ab-e639734983ab" } });
  assert.equal(different.body.code, "quota_exceeded");
  assert.deepEqual(different.calls, []);
  assert.equal(h.state.generation_reservations_json[0].status, "reserved");
  assert.equal(h.state.usage_events_json, undefined);
  assert.equal(h.completions, 1);
  assert.equal(h.failures, 0);
});

test("failed provider attempt is terminal on retry and never counted as successful usage", async () => {
  const h = statefulReservationHarness();
  assert.equal((await routeFixture({ ...h, providerError: new Error("offline failure") })).response.status, 500);
  const retry = await routeFixture(h);
  assert.equal(retry.response.status, 409);
  assert.equal(retry.body.code, "request_failed");
  assert.deepEqual(retry.calls, []);
  assert.equal(h.failures, 1);
  assert.equal(h.completions, 0);
  assert.equal(h.state.usage_events_json, undefined);
});

async function imageRouteFixture(t, options = {}) {
  const calls = [];
  const usage = [];
  const gateCalls = [];
  const route = loadTs("app/api/generate-image/route.ts", {
    "@/lib/request-security": { rejectUnsafeWrite: () => null },
    "@/lib/auth": { getCurrentUser: async () => options.anonymous ? null : { id: "user-test", email: "test@example.invalid" } },
    "@/lib/backend": { isDatabaseConfigured: () => { gateCalls.push("database_config"); return !options.noDatabase; } },
    "@/lib/env": { isStripeConfigured: () => false },
    "next/server": { NextResponse: Response },
    "@/lib/repository": {
      getUserProfileForUser: async () => { gateCalls.push("profile"); return options.noProfile ? null : {
        id: "user-test", plan: "pro_studio", subscription_status: "active", ...options.profile
      }; },
      getMonthlyUsageCount: async (input) => {
        calls.push("quota");
        assert.equal(input.eventType, "image_generation");
        assert.equal(input.userId, "user-test");
        if (options.usageError) throw new Error("usage unavailable");
        return Object.hasOwn(options, "used") ? options.used : 0;
      },
      recordUsageEvent: async (input) => { calls.push("record"); usage.push(input); }
    }
  });
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push("provider");
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    assert.equal(JSON.parse(init.body).n, 1);
    return Response.json({ data: [{ b64_json: "b2ZmbGluZS1maXh0dXJl" }] });
  });
  const previous = process.env.OPENAI_API_KEY;
  try {
    if (options.noKey) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = "offline-placeholder-not-a-real-key";
    const headers = new Headers();
    if (options.accountHeader !== null) headers.set("X-ContentOS-Account", options.accountHeader ?? "user-test");
    const incoming = new Request("https://test.local/api/generate-image", {
      method: "POST", headers, body: options.rawBody ?? JSON.stringify({ outputText: source, platform: "LinkedIn", style: "minimal", format: "square" })
    });
    const response = await route.POST(incoming);
    return { response, body: await response.json(), calls, usage, gateCalls, bodyRead: incoming.bodyUsed };
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    t.mock.restoreAll();
  }
}

test("image auth and plan failures block provider access and usage recording", async (t) => {
  for (const [options, status] of [[{ anonymous: true }, 401], [{ noDatabase: true }, 503],
    [{ noProfile: true }, 403], [{ profile: { plan: "free" } }, 403], [{ profile: { subscription_status: "canceled" } }, 403]]) {
    const result = await imageRouteFixture(t, options);
    assert.equal(result.response.status, status);
    assert.deepEqual(result.calls, []);
  }
});

test("image route rejects missing, empty, and stale account headers before reading data or accessing storage", async (t) => {
  for (const accountHeader of [null, "", "previous-account"]) {
    const result = await imageRouteFixture(t, { accountHeader, rawBody: "{", noDatabase: true });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, "account_changed");
    assert.match(result.body.error, /Reload the page or sign in again/);
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.gateCalls, []);
    assert.deepEqual(result.usage, []);
    assert.equal(result.bodyRead, false);
    assert.ok(!JSON.stringify(result.body).includes("user-test"));
    assert.ok(!JSON.stringify(result.body).includes("previous-account"));
  }
  assert.equal((await imageRouteFixture(t, { anonymous: true, accountHeader: null })).response.status, 401);
});

test("image quota outage or invalid counter fails closed; exhausted credits return 429", async (t) => {
  for (const options of [{ usageError: true }, ...[undefined, null, NaN, -1, 0.5, Infinity, "0"].map(used => ({ used }))]) {
    const result = await imageRouteFixture(t, options);
    assert.equal(result.response.status, 503);
    assert.deepEqual(result.calls, ["quota"]);
    assert.deepEqual(result.usage, []);
  }
  const result = await imageRouteFixture(t, { used: 100 });
  assert.equal(result.response.status, 429);
  assert.deepEqual(result.calls, ["quota"]);
});

test("entitled image request still renders actual SVG and records one mocked background usage", async (t) => {
  const result = await imageRouteFixture(t, { used: 99 });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.calls, ["quota", "provider", "record"]);
  assert.equal(result.body.mimeType, "image/svg+xml");
  assert.match(result.body.image, /^data:image\/svg\+xml/);
  assert.equal(result.body.format, "square");
  assert.equal(result.usage.length, 1);
  assert.equal(result.usage[0].metadata.background, "openai_textless");
});

test("image template fallback remains available when provider credentials are absent", async (t) => {
  const result = await imageRouteFixture(t, { noKey: true });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.calls, ["quota", "record"]);
  assert.match(result.body.warning, /not configured/);
  assert.equal(result.usage[0].metadata.background, "template_fallback");
});
