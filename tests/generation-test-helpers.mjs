import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadTs, requestId, profile } from "./image-test-helpers.mjs";
export { loadTs, requestId };
const require = createRequire(import.meta.url);
export const source = "A planning checklist is being tested with five designers. Results are not available yet.";
export const input = (extra = {}) => ({ source, selectedTypes: ["linkedin"], requestId: requestId(), ...extra });
export const output = (extra = {}) => ({ title: "Planning checklist", summary: source, sections: [
  { id: "linkedin-1", type: "linkedin", title: "Planning checklist", platform: "LinkedIn", body: source, items: [], cta: "" }
], ...extra });
export const receipt = (value = output()) => ({ status: "completed", output_text: JSON.stringify(value), usage: { input_tokens: 100, output_tokens: 200 } });
export function reviewReceipt(payload, change = d => d) {
  const batch = JSON.parse(payload.input);
  return receipt({ decisions: batch.units.map(unit => change({ id: unit.id, kind: "supported", sourceIds: batch.sources.map(s => s.id), reason: "none", replacement: null }, unit, batch)) });
}
export function harness(options = {}) {
  const rows = new Map([["user-test", profile(options.profile)], ["other-user", profile({ id: "other-user" })]]);
  let queue = Promise.resolve();
  const h = { rows, calls: [], logs: [], analytics: [], userId: options.anonymous ? null : "user-test", fault: null,
    now: new Date(), provider: async p => p.text.format.name === "social_content_generation" ? receipt() : reviewReceipt(p),
    get data() { return rows.get("user-test"); }, set data(value) { rows.set("user-test", value); } };
  const rowOps = target => ({
    select: () => ({ from: () => ({ where: id => ({ for: async mode => {
      assert.equal(mode, "update"); return target.has(id) ? [{ data: structuredClone(target.get(id)) }] : [];
    } }) }) }),
    update: () => ({ set: value => ({ where: async id => { target.set(id, structuredClone(value.data)); } }) })
  });
  const db = { transaction: fn => {
    const task = queue.then(async () => {
      const working = new Map([...rows].map(([id, d]) => [id, structuredClone(d)]));
      const result = await fn(rowOps(working));
      if (h.fault === "rollback") { h.fault = null; throw new Error("Synthetic rollback"); }
      for (const [id, d] of working) rows.set(id, d);
      if (h.fault === "lost-ack") { h.fault = null; throw new Error("Synthetic lost acknowledgment"); }
      return result;
    }); queue = task.catch(() => {}); return task;
  } };
  const cache = new Map();
  const mocks = {
    "server-only": {}, "drizzle-orm": { eq: (_, id) => id, sql: () => ({}) },
    "@/lib/db/client": { getDb: () => db }, "@/lib/db/app-schema": { profiles: { id: "id" } },
    "@/lib/request-security": { rejectUnsafeWrite: () => options.unsafe ? Response.json({ error: "Unsafe" }, { status: 403 }) : null },
    "@/lib/auth": { getCurrentUser: async () => h.userId ? { id: h.userId } : null },
    "@/lib/backend": { isDatabaseConfigured: () => !options.noDatabase },
    "@/lib/monitoring": { captureServerError: (e, c) => h.logs.push([e.message, c]), analyticsEvent: (e, f) => {
      if (options.analyticsError) throw new Error("logger failed"); h.analytics.push([e, f]);
    } },
    "next/server": { NextResponse: Response },
    openai: class {
      constructor(config) {
        h.clientOptions = config;
        if (options.sdkFetch) return new (require("openai").default)({ ...config, fetch: options.sdkFetch });
      }
      responses = { create: async (payload, config) => {
        assert.ok(config.signal instanceof AbortSignal); assert.equal(payload.store, false);
        h.calls.push(payload); return h.provider(payload, config);
      } };
    }
  };
  const runtime = { process: { env: options.noKey ? {} : { OPENAI_API_KEY: "offline-synthetic-not-a-key", ...(options.model ? { OPENAI_MODEL: options.model } : {}) } } };
  if (options.textGenerationMode !== undefined) runtime.process.env.CONTENTOS_TEXT_GENERATION_MODE = options.textGenerationMode;
  if (options.pilotAccounts !== undefined) runtime.process.env.CONTENTOS_TEXT_GENERATION_PILOT_ACCOUNTS = options.pilotAccounts;
  h.setTextGenerationMode = mode => { runtime.process.env.CONTENTOS_TEXT_GENERATION_MODE = mode; };
  h.load = file => loadTs(file, mocks, cache, runtime);
  h.repository = h.load("lib/postgres-repository.ts");
  mocks["@/lib/generation-reservation"] = h.load("lib/generation-reservation.ts");
  mocks["@/lib/repository"] = {
    beginTextGenerationStage: (...args) => h.repository.beginTextGenerationStage(...args, h.now),
    checkpointTextGenerationStage: (...args) => h.repository.checkpointTextGenerationStage(...args, h.now)
  };
  if (options.remaining !== undefined) mocks["@/lib/generation-contract"] = { ...h.load("lib/generation-contract.ts"), remainingGenerationTime: () => options.remaining };
  h.instance = () => loadTs("app/api/generate/route.ts", mocks, new Map(), runtime).POST;
  const post = h.instance();
  h.post = async (body = input(), settings = {}) => {
    const headers = { ...(settings.account !== null ? { "X-ContentOS-Account": settings.account ?? h.userId ?? "user-test" } : {}),
      ...(settings.stage != null ? { "X-ContentOS-Stage": settings.stage } : {}) };
    const request = new Request("https://test.invalid/api/generate", { method: "POST", headers,
      body: settings.rawBody ?? JSON.stringify(body), signal: settings.signal });
    const response = await (settings.instance ?? post)(request);
    return { response, body: await response.json(), bodyRead: request.bodyUsed };
  };
  h.finish = async (body = input(), stage, steps = 40) => {
    for (let n = 0; n < steps; n++) {
      const value = await h.post(body, { stage });
      if (value.response.status !== 202) return value;
      stage = value.body.nextStage;
      assert.equal(value.body.running, false, "finish helper does not spin on active work");
    }
    throw new Error("Pipeline did not terminate");
  };
  return h;
}
