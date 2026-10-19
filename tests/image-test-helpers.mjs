import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
const { Response, Request, Headers, AbortSignal, structuredClone, console } = globalThis;

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
export function loadTs(relative, mocks = {}, cache = new Map(), runtime = {}) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  });
  const require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/")
    ? loadTs(`${id.slice(2)}.ts`, mocks, cache, runtime) : nativeRequire(id);
  new Function("require", "module", "exports", "fetch", "process", "console", outputText)(
    require, module, module.exports,
    runtime.fetch ?? (async () => { throw new Error("Network is forbidden in image tests"); }),
    runtime.process ?? { env: {} }, runtime.console ?? console
  );
  return module.exports;
}

export const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
export const requestId = (n = 1) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const imageInput = (extra = {}) => ({ requestId: requestId(), outputText: "Five designers are testing a planning checklist. Results are not available yet.", platform: "LinkedIn", contentType: "LinkedIn Post", style: "minimal", format: "square", ...extra });
export const profile = (extra = {}) => ({ id: "user-test", email: "test@example.invalid", plan: "pro_studio", subscription_status: "active", ...extra });

export function createImageHarness(options = {}) {
  const calls = [], warnings = [], reads = [], rows = new Map();
  if (!options.noProfile) rows.set("user-test", profile(options.profile));
  rows.set("other-user", profile({ id: "other-user" }));
  let queue = Promise.resolve(), failCommit = false;
  const h = {
    calls, warnings, reads, rows, fault: options.fault, userId: options.anonymous ? null : "user-test",
    provider: options.provider ?? (async () => Response.json({ data: [{ b64_json: PNG }] })),
    get data() { return rows.get("user-test"); },
    set data(value) { rows.set("user-test", value); }
  };
  function session(target) {
    return {
      select: fields => ({ from: () => ({ where: criterion => {
        const row = typeof criterion === "string" ? target.get(criterion) : [...target.values()].find(value => value.email === criterion.email);
        return {
          for: async mode => {
            assert.equal(mode, "update");
            assert.equal(fields, undefined, "locked mutation must read the full row");
            reads.push({ locked: true, keys: Object.keys(row ?? {}) });
            return row ? [{ data: structuredClone(row) }] : [];
          },
          limit: async () => {
            assert.deepEqual(Object.keys(fields), ["data"]);
            const query = new PgDialect().sqlToQuery(fields.data);
            assert.equal(query.sql, '"profiles"."data" - ARRAY[\'image_generation_reservations_json\', \'image_generation_tombstones_json\', \'generation_reservations_json\', \'generation_tombstones_json\']::text[]');
            assert.deepEqual(query.params, []);
            const data = row ? structuredClone(row) : undefined;
            for (const key of ["image_generation_reservations_json", "image_generation_tombstones_json", "generation_reservations_json", "generation_tombstones_json"]) if (data) delete data[key];
            reads.push({ locked: false, keys: Object.keys(data ?? {}), sql: query.sql });
            return data ? [{ data }] : [];
          }
        };
      } }) }),
      update: () => ({ set: value => ({ where: async id => target.set(id, structuredClone(value.data)) }) })
    };
  }
  const db = {
    ...session(rows),
    transaction: fn => {
      const task = queue.then(async () => {
        const working = new Map([...rows].map(([id, value]) => [id, structuredClone(value)]));
        const result = await fn(session(working));
        if (failCommit) { failCommit = false; throw new Error("Commit failed before persistence"); }
        for (const [id, value] of working) rows.set(id, value);
        return result;
      });
      queue = task.catch(() => {});
      return task;
    }
  };
  const mocks = {
    // Budget/transaction integration is exercised against isolated Neon separately.
    "@/lib/commercial-ledger": { dispatchCommercial: async () => {}, settleCommercialUsage: async () => {} },
    "server-only": {}, "drizzle-orm": { sql, eq: (column, value) => column === "email" ? { email: value } : value },
    "@/lib/db/client": { getDb: () => db }, "@/lib/db/app-schema": { profiles: { id: "id", email: "email", data: sql.raw('"profiles"."data"') } },
    "@/lib/request-security": { rejectUnsafeWrite: () => options.unsafe ? Response.json({ error: "Unsafe" }, { status: 403 }) : null },
    "@/lib/auth": { getCurrentUser: async () => h.userId ? { id: h.userId, email: "test@example.invalid" } : null },
    "@/lib/backend": { isDatabaseConfigured: () => { calls.push("config"); return !options.noDatabase; } },
    "@/lib/env": { isStripeConfigured: () => false },
    "next/server": { NextResponse: Response }
  };
  const runtime = {
    process: { env: options.noKey ? {} : { OPENAI_API_KEY: "offline-test-placeholder" } },
    console: { warn: (...args) => warnings.push(args) },
    fetch: async (url, init) => {
      calls.push("provider");
      assert.equal(url, "https://api.openai.com/v1/images/generations");
      assert.equal(JSON.parse(init.body).n, 1);
      assert.equal(init.redirect, "error");
      assert.ok(init.signal instanceof AbortSignal);
      return h.provider(url, init);
    }
  };
  const cache = new Map();
  const actual = loadTs("lib/postgres-repository.ts", mocks, cache, runtime);
  h.repository = actual;
  h.contract = loadTs("lib/image-generation-contract.ts", mocks, cache, runtime);
  h.reservations = loadTs("lib/image-generation-reservation.ts", mocks, cache, runtime);
  mocks["@/lib/repository"] = {
    getUserProfileForUser: async (...args) => { calls.push("profile"); return actual.getUserProfileForUser(...args); },
    reserveImageGeneration: async (...args) => {
      calls.push("reserve");
      if (h.fault === "reserve-before") failCommit = true;
      const value = await actual.reserveImageGeneration(...args.slice(0,2));
      if (h.fault === "reserve-after") throw new Error("Reservation acknowledgement lost");
      return value;
    },
    completeImageGeneration: async (...args) => {
      calls.push("complete");
      if (h.fault === "complete-before") failCommit = true;
      const value = await actual.completeImageGeneration(...args.slice(0,4));
      if (h.fault === "complete-after") throw new Error("Completion acknowledgement lost");
      return value;
    },
    failImageGeneration: async (...args) => {
      calls.push("fail");
      if (h.fault === "fail-before") failCommit = true;
      return actual.failImageGeneration(...args.slice(0,3));
    }
  };
  if (options.renderError) {
    const renderer = loadTs("lib/social-image.ts", mocks, cache, runtime);
    mocks["@/lib/social-image"] = { ...renderer, renderSocialPosterSvg: () => { throw new Error("Rendering failed"); } };
  }
  const { POST } = loadTs("app/api/generate-image/route.ts", mocks, cache, runtime);
  h.post = async (input = imageInput(), settings = {}) => {
    const headers = new Headers();
    if (settings.account !== null) headers.set("X-ContentOS-Account", settings.account ?? h.userId ?? "user-test");
    const request = new Request("https://test.invalid/api/generate-image", {
      method: "POST", headers, body: settings.rawBody ?? JSON.stringify(input), signal: settings.signal
    });
    const response = await POST(request);
    return { response, body: await response.json(), bodyRead: request.bodyUsed };
  };
  return h;
}

export function resultFixture(extra = {}) {
  return {
    image: "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E",
    mimeType: "image/svg+xml", size: "1080x1080", style: "minimal", format: "square",
    template: "clean_creator", imageCreditsLimit: 100, creditCharged: true,
    createdAt: "2026-10-18T12:00:00.000Z", ...extra
  };
}
