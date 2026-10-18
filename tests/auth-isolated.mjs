import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";

// Explicit opt-in; this script is never part of the default unit-test glob.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH, "br-divine-term-b2rihbxv");
assert.ok(["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech", "ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(url.hostname));
assert.equal(url.pathname, "/contentos");
for (const key of ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "OPENAI_API_KEY"]) assert.ok(!process.env[key]);
const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url), cache = new Map(), mail = [];
const mocks = { "server-only": {}, "@/lib/auth-mail": { queueAuthMail: async (user, url, kind) => { mail.push({ user, url, kind }); } } };
function load(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : nativeRequire(id);
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}
const { auth } = load("lib/auth-config.ts");
const { getPool } = load("lib/db/client.ts");
const repository = load("lib/postgres-repository.ts");
const prefix = `release-${randomUUID()}`, users = [], checks = [];
const ipNamespace = Number.parseInt(randomUUID().slice(0, 2), 16);
const password = "Isolated-Release-Only-2026!";
let passwordB = password;
const base = process.env.BETTER_AUTH_URL;
async function request(path, body, cookie, ip = "192.0.2.201") {
  return auth.handler(new Request(`${base}/api/account/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: base, "content-type": "application/json", "x-vercel-forwarded-for": `198.18.${ipNamespace}.${ip.split(".").at(-1)}`, ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
function cookies(response) { return response.headers.getSetCookie().map(v => v.split(";")[0]).join("; "); }
async function session(cookie) { return (await request("get-session", undefined, cookie)).json(); }
async function login(user, pass = password, ip = "192.0.2.210") {
  const response = await request("sign-in/email", { email: user.email, password: pass }, undefined, ip);
  assert.equal(response.status, 200, "verified login"); return cookies(response);
}
try {
  // Three concurrent real Better Auth transactions with the production max=3 pool.
  const started = performance.now();
  const responses = await Promise.all([0, 1, 2].map(async n => {
    const email = `${prefix}-${n}@example.invalid`;
    const response = await request("sign-up/email", { name: `Isolated ${n}`, email, password, callbackURL: `${base}/login?offer=founding100` }, undefined, `192.0.2.${201 + n}`);
    assert.equal(response.status, 200, "concurrent signup");
    const data = await response.json(); users.push({ id: data.user.id, email }); return data;
  }));
  assert.equal(responses.length, 3); assert.ok(performance.now() - started < 15000, "no pool-acquisition timeout");
  checks.push("three concurrent signups complete with pool max=3");
  const [alice, bob] = users;
  const unverified = await request("sign-in/email", { email: alice.email, password }, undefined, "192.0.2.211");
  assert.equal(unverified.status, 403);
  for (const user of users) {
    const verification = mail.find(m => m.user.id === user.id && m.kind === "verification");
    assert.ok(verification);
    assert.ok(new URL(verification.url).searchParams.get("callbackURL")?.includes("offer=founding100"));
    const verified = await auth.handler(new Request(verification.url));
    assert.ok([200, 302].includes(verified.status));
  }
  checks.push("email verification required; captured verification callback retains Founder intent; no mail sent");
  let cookieA = await login(alice), cookieB = await login(bob, password, "192.0.2.212");
  assert.equal((await session(cookieA)).user.id, alice.id); assert.equal((await session(cookieB)).user.id, bob.id);
  const initial = await repository.getWorkspace(alice.id);
  const edit = { revision: initial.revision, store: initial.store, preferences: { ...initial.preferences, brandName: "Isolated Brand" } };
  const saved = await repository.saveWorkspace(alice.id, edit);
  const secondDevice = await login(alice, password, "192.0.2.213");
  const deviceUser = (await session(secondDevice)).user.id;
  assert.equal((await repository.getWorkspace(deviceUser)).preferences.brandName, "Isolated Brand");
  await assert.rejects(repository.saveWorkspace(deviceUser, edit), e => e.status === 409);
  assert.notEqual((await repository.getWorkspace(bob.id)).preferences.brandName, "Isolated Brand");
  assert.equal(saved.revision, initial.revision + 1);
  checks.push("cloud persistence across independent sessions; stale-device CAS rejects; separate-account workspace unaffected");
  const recovery = await request("request-password-reset", { email: alice.email, redirectTo: `${base}/reset-password?offer=founding100` }, undefined, "192.0.2.214");
  assert.equal(recovery.status, 200);
  const reset = mail.findLast(m => m.user.id === alice.id && m.kind === "reset"); assert.ok(reset);
  const token = new URL(reset.url).pathname.split("/").at(-1);
  const newPassword = `${password}new`;
  assert.equal((await request("reset-password", { token, newPassword }, undefined, "192.0.2.215")).status, 200);
  assert.equal(await session(cookieA), null); assert.equal(await session(secondDevice), null);
  assert.equal((await request("reset-password", { token, newPassword }, undefined, "192.0.2.216")).status, 400);
  cookieA = await login(alice, newPassword, "192.0.2.217");
  assert.equal((await repository.getWorkspace(alice.id)).preferences.brandName, "Isolated Brand");
  checks.push("password reset revokes both devices, consumed token cannot replay, cloud content survives recovery");
  if (process.argv.includes("--reset-faults")) {
    const scope = load("lib/auth-database.ts"), authSchema = load("lib/db/auth-schema.ts");
    const original = scope.getAuthDatabase;
    await request("request-password-reset", { email: bob.email, redirectTo: `${base}/reset-password` }, undefined, "192.0.2.220");
    const resetB = mail.findLast(m => m.user.id === bob.id && m.kind === "reset");
    const tokenB = new URL(resetB.url).pathname.split("/").at(-1);
    scope.getAuthDatabase = () => new Proxy(original(), { get(target, key, receiver) {
      if (key === "delete") return table => table === authSchema.session
        ? { where: async () => { throw new Error("Synthetic revocation failure"); } }
        : target.delete(table);
      return Reflect.get(target, key, receiver);
    } });
    let failed;
    const originalError = console.error;
    try {
      console.error = () => {}; // Expected injected exception; never render library request details.
      failed = await request("reset-password", { token: tokenB, newPassword: `${password}changed` }, undefined, "192.0.2.221");
    } finally { scope.getAuthDatabase = original; console.error = originalError; }
    assert.ok(failed.status >= 500, "revocation failure must not acknowledge reset");
    assert.equal((await session(cookieB)).user.id, bob.id, "rollback leaves existing session and credential unchanged");
    await login(bob, password, "192.0.2.222");
    passwordB = `${password}changed`;
    const concurrent = await Promise.all([223, 224].map(octet => request("reset-password", { token: tokenB, newPassword: passwordB }, undefined, `192.0.2.${octet}`)));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 400], "rolled-back reset token is reusable exactly once across concurrent requests");
    assert.equal(await session(cookieB), null);
    cookieB = await login(bob, passwordB, "192.0.2.225");
    checks.push("revocation fault rolls back token consumption before password change; concurrent retry has one winner");
    await request("request-password-reset", { email: alice.email, redirectTo: `${base}/reset-password` }, undefined, "192.0.2.226");
    const expired = mail.findLast(m => m.user.id === alice.id && m.kind === "reset");
    await getPool().query("UPDATE contentos_auth.verification SET expires_at=now()-interval '1 second' WHERE value=$1", [alice.id]);
    assert.equal((await request("reset-password", { token: new URL(expired.url).pathname.split("/").at(-1), newPassword: `${password}expired` }, undefined, "192.0.2.227")).status, 400);
    assert.equal((await session(cookieA)).user.id, alice.id, "expired token must not revoke an active session");
    checks.push("expired reset token neither changes password nor revokes sessions");
  }
  assert.equal((await request("sign-out", {}, cookieA)).status, 200); assert.equal(await session(cookieA), null);
  assert.equal((await session(cookieB)).user.id, bob.id);
  checks.push("logout revokes only the intended session/account");
  if (process.argv.includes("--browser")) {
    await getPool().query("UPDATE contentos_app.profiles SET data=data || $2::jsonb WHERE id=$1 AND email=$3", [alice.id, JSON.stringify({ plan: "pro_studio", subscription_status: "active" }), alice.email]);
    const { runAuthenticatedBrowser } = await import("./auth-browser.mjs");
    await runAuthenticatedBrowser({ alice, bob, passwordA: newPassword, passwordB });
  }
  console.log(JSON.stringify({ status: "PASS", checks, providerCalls: 0, mailSent: 0, productionWrites: 0 }, null, 2));
} catch (error) {
  // Only our assertion labels; never render driver errors, SQL parameters, or auth tokens.
  console.error(JSON.stringify({ status: "FAIL", completedChecks: checks, assertion: error instanceof assert.AssertionError ? error.message.split("\n")[0] : "integration operation failed" }));
  process.exitCode = 1;
} finally {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Prefix-scoped synthetic fixtures only, even after a partially failed signup.
    const rows = await client.query('SELECT id FROM contentos_auth."user" WHERE email LIKE $1', [`${prefix}-%@example.invalid`]);
    const ids = rows.rows.map(r => r.id);
    await client.query("DELETE FROM contentos_app.profiles WHERE id=ANY($1::text[]) AND email LIKE $2", [ids, `${prefix}-%@example.invalid`]);
    await client.query("DELETE FROM contentos_auth.verification WHERE value=ANY($1::text[])", [ids]);
    await client.query('DELETE FROM contentos_auth."user" WHERE id=ANY($1::text[]) AND email LIKE $2', [ids, `${prefix}-%@example.invalid`]);
    await client.query("COMMIT");
    console.log("Isolated synthetic auth/profile fixtures removed; existing records untouched.");
  } catch { await client.query("ROLLBACK"); console.error("Isolated fixture cleanup needs review."); process.exitCode = 1; }
  finally { client.release(); await pool.end(); }
}
