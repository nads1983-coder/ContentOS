import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { APIError } from "better-auth/api";
import { runWithEndpointContext } from "@better-auth/core/context";
import { resetPassword } from "../node_modules/better-auth/dist/api/routes/password.mjs";
import { createInternalAdapter } from "../node_modules/better-auth/dist/db/internal-adapter.mjs";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const schema = {
  session: { userId: "session.userId" },
  user: { id: "user.id", disabled: "user.disabled", emailVerified: "user.emailVerified" }
};
const profiles = { id: "profiles.id", email: "profiles.email" };
const user = { id: "synthetic-user", email: "SYNTHETIC@example.invalid", name: "Synthetic" };
const session = { id: "synthetic-session", userId: user.id };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

// Execute the real hooks and AsyncLocalStorage proxy, never a database/mail/provider client.
function fixture(options = {}) {
  const events = [], queries = [], transactions = [], revocations = [], cache = new Map();
  let poolReads = 0, adapter, adapterOptions, revoked = false;
  function connection(label) {
    return {
      label,
      select(fields) {
        if (label === "pool" && options.forbidPoolQueries) throw new Error("Pool query outside transaction");
        return { from: table => ({ where: condition => ({ limit: async limit => {
          queries.push({ label, fields, table, condition, limit });
          if (options.lookupError) throw options.lookupError;
          return options.rows ? options.rows({ label, table, condition }) : table === profiles ? [] : [{ disabled: false, emailVerified: true }];
        } }) }) };
      },
      delete(table) {
        assert.equal(table, schema.session);
        return { where: async condition => {
          assert.deepEqual(condition, { column: schema.session.userId, value: user.id });
          events.push("hook:revoke");
          revocations.push(label);
          if (options.revokeError) throw options.revokeError;
          revoked = true;
        } };
      },
      update(table) {
        assert.equal(table, schema.user);
        return { set: values => ({ where: async condition => {
          assert.deepEqual(condition, { column: schema.user.id, value: user.id });
          assert.equal(values.emailVerified, true);
          assert.equal(values.legacyAccount, false);
          assert.deepEqual(Object.keys(values).sort(), ["emailVerified", "legacyAccount", "updatedAt"]);
          assert.ok(values.updatedAt instanceof Date);
          assert.equal(revoked, true, "revocation must finish before metadata update");
          events.push("hook:metadata");
          if (options.metadataError) throw options.metadataError;
        } }) };
      }
    };
  }
  const db = Object.assign(connection("pool"), {
    async transaction(callback, config) {
      assert.equal(this, db, "proxy must retain transaction receiver");
      const tx = connection(`tx-${transactions.length + 1}`);
      transactions.push({ tx, config });
      const previousRevoked = revoked;
      try { return await callback(tx); }
      catch (error) { revoked = previousRevoked; throw error; }
    }
  });
  const mocks = {
    "better-auth": { betterAuth: config => config },
    "@better-auth/drizzle-adapter": { drizzleAdapter: (db, config) => { adapter = db; adapterOptions = config; return "offline-adapter"; } },
    "better-auth/api": { APIError },
    "drizzle-orm": { eq: (column, value) => ({ column, value }) },
    "@/lib/db/client": { getDb: () => { poolReads++; return db; } },
    "@/lib/db/app-schema": { profiles },
    "@/lib/db/auth-schema": schema,
    "@/lib/auth-mail": { queueAuthMail: () => { throw new Error("Unexpected mail"); } },
    "@/lib/postgres-repository": { upsertUserProfile: () => { throw new Error("Unexpected profile write"); } }
  };
  function load(relative) {
    assert.ok(["lib/auth-config.ts", "lib/auth-database.ts"].includes(relative));
    if (cache.has(relative)) return cache.get(relative).exports;
    const module = { exports: {} };
    cache.set(relative, module);
    const { outputText } = ts.transpileModule(readFileSync(resolve(root, relative), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    const require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === "@/lib/auth-database") return load("lib/auth-database.ts");
      assert.ok(["node:crypto", "node:async_hooks", "@better-auth/utils/base64", "@better-auth/utils/hash"].includes(id), `Unexpected dependency: ${id}`);
      return nativeRequire(id);
    };
    new Function("require", "module", "exports", "fetch", outputText)(require, module, module.exports, () => { throw new Error("Unexpected network"); });
    return module.exports;
  }
  const { auth } = load("lib/auth-config.ts");
  const scope = load("lib/auth-database.ts");
  return { auth, scope, db, adapter, adapterOptions, events, queries, transactions, revocations,
    get poolReads() { return poolReads; }, get revoked() { return revoked; } };
}

// Invoke the INSTALLED endpoint, so a library change to its ordering breaks these tests.
function reset(f, { credential = true, validToken = true, consumeVerificationValue, body = { token: "synthetic-reset-token", newPassword: "synthetic-new-password-123" }, query } = {}) {
  const record = (name, value) => async (...args) => {
    f.events.push(name);
    if (name === "consume") assert.equal(args[0], "reset-password:synthetic-reset-token");
    else assert.equal(args[0], user.id);
    return value;
  };
  return resetPassword({
    body, query,
    context: {
      options: f.auth,
      password: { config: { minPasswordLength: 12, maxPasswordLength: 128 }, hash: async () => { f.events.push("hash"); return "synthetic-hash"; } },
      internalAdapter: {
        consumeVerificationValue: consumeVerificationValue ?? record("consume", validToken ? { value: user.id } : null),
        findUserById: record("find-user", user),
        findCredentialAccount: record("find-credential", credential ? { userId: user.id } : null),
        updatePassword: async (id, hash) => { assert.equal(id, user.id); assert.equal(hash, "synthetic-hash"); f.events.push("update-password"); },
        createAccount: async account => { assert.deepEqual(account, { userId: user.id, providerId: "credential", accountId: user.id, password: "synthetic-hash" }); f.events.push("create-credential"); },
        deleteUserSessions: record("builtin:revoke")
      }
    }
  });
}

test("installed reset endpoint: metadata hook failure occurs after explicit session revocation", async () => {
  const failure = new Error("synthetic metadata failure"), f = fixture({ metadataError: failure });
  await assert.rejects(reset(f), error => error === failure);
  assert.equal(f.revoked, true);
  assert.deepEqual(f.events, ["consume", "find-user", "hash", "find-credential", "update-password", "hook:revoke", "hook:metadata"]);
});

test("post-reset defense alone propagates revoke failure without marking metadata verified", async () => {
  const failure = new Error("synthetic revocation failure"), f = fixture({ revokeError: failure });
  await assert.rejects(reset(f), error => error === failure);
  assert.equal(f.revoked, false);
  assert.deepEqual(f.events, ["consume", "find-user", "hash", "find-credential", "update-password", "hook:revoke"]);
});

for (const credential of [true, false]) {
  test(`installed reset endpoint: ${credential ? "existing" : "legacy missing"} credential completes revoke-first hook and built-in revocation`, async () => {
    const f = fixture();
    assert.equal(f.auth.emailAndPassword.revokeSessionsOnPasswordReset, true);
    assert.deepEqual(await reset(f, { credential }), { status: true });
    assert.deepEqual(f.events, ["consume", "find-user", "hash", "find-credential", credential ? "update-password" : "create-credential", "hook:revoke", "hook:metadata", "builtin:revoke"]);
  });
}

test("installed reset endpoint: invalid or consumed token cannot reach password/session/metadata writes", async () => {
  const f = fixture();
  await assert.rejects(reset(f, { validToken: false }), error => error.status === "BAD_REQUEST");
  assert.deepEqual(f.events, ["consume"]);
});

// Real token hashing/consumption and reset orchestration, with only the database and credential writes mocked.
async function tokenResetFixture(options = {}) {
  const f = fixture(options);
  let verification;
  const storage = {
    async create({ model, data }) {
      assert.equal(model, "verification");
      verification = { id: "synthetic-verification", ...data };
      return verification;
    },
    async transaction(callback) {
      let next = verification;
      const tx = {
        async findMany({ model, where }) {
          assert.equal(model, "verification");
          return next && where.every(predicate => next[predicate.field] === predicate.value) ? [next] : [];
        },
        async consumeOne({ model, where }) {
          assert.equal(model, "verification");
          f.events.push("token:consume");
          if (options.consumeError) throw options.consumeError;
          if (!next || !where.every(predicate => next[predicate.field] === predicate.value)) return null;
          const consumed = next;
          next = undefined;
          return consumed;
        },
        async deleteMany({ model }) { assert.equal(model, "verification"); return 0; }
      };
      const result = await f.adapter.transaction(() => callback(tx));
      verification = next;
      f.events.push("token:commit");
      return result;
    }
  };
  const context = { options: f.auth, hooks: [{ source: "test-config", hooks: f.auth.databaseHooks }], logger: { error() { throw new Error("Unexpected auth logger error"); } } };
  const internal = createInternalAdapter(storage, context);
  const creator = options.plaintext ? createInternalAdapter(storage, { ...context, options: { ...f.auth, verification: { storeIdentifier: "plain" } } }) : internal;
  await creator.createVerificationValue({ identifier: "reset-password:synthetic-reset-token", value: user.id, expiresAt: new Date(Date.now() + (options.expired ? -60_000 : 60_000)) });
  return {
    f, get verification() { return verification; },
    run({ credential = true, body = { token: "synthetic-reset-token", newPassword: "synthetic-new-password-123" }, query } = {}) {
      return runWithEndpointContext({ path: "/reset-password", body, query }, () => reset(f, { credential, body, query, consumeVerificationValue: internal.consumeVerificationValue }));
    }
  };
}

for (const credential of [true, false]) {
  test(`token-consumption hook revokes before ${credential ? "updating" : "creating migrated"} credentials using actual stored hash`, async () => {
    const h = await tokenResetFixture();
    assert.match(h.verification.identifier, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(h.verification.identifier, "reset-password:synthetic-reset-token");
    assert.deepEqual(await h.run({ credential }), { status: true });
    assert.equal(h.verification, undefined);
    assert.deepEqual(h.f.events, ["hook:revoke", "token:consume", "token:commit", "find-user", "hash", "find-credential", credential ? "update-password" : "create-credential", "hook:revoke", "hook:metadata", "builtin:revoke"]);
    assert.deepEqual(h.f.revocations, ["tx-1", "pool"]);
    assert.equal(h.f.auth.emailAndPassword.requireEmailVerification, true);
    assert.equal(h.f.auth.emailAndPassword.revokeSessionsOnPasswordReset, true);
  });

  test(`pre-revocation failure prevents ${credential ? "password update" : "migrated credential creation"} and preserves the token`, async () => {
    const failure = Error("synthetic pre-revoke failure"), h = await tokenResetFixture({ revokeError: failure });
    const original = h.verification;
    await assert.rejects(h.run({ credential }), error => error === failure);
    assert.equal(h.verification, original);
    assert.equal(h.f.revoked, false);
    assert.deepEqual(h.f.events, ["hook:revoke"]);
    assert.deepEqual(h.f.revocations, ["tx-1"]);
    assert.equal(h.f.scope.getAuthDatabase(), h.f.db);
  });
}

test("query-token and existing plaintext fallback use the same pre-revocation safeguard", async () => {
  for (const plaintext of [false, true]) {
    const h = await tokenResetFixture({ plaintext });
    assert.deepEqual(await h.run({ body: { newPassword: "synthetic-new-password-123" }, query: { token: "synthetic-reset-token" } }), { status: true });
    assert.deepEqual(h.f.revocations, [plaintext ? "tx-2" : "tx-1", "pool"]);
    assert.ok(h.f.events.indexOf("hook:revoke") < h.f.events.indexOf("token:consume"));
    assert.ok(h.f.events.indexOf("hook:revoke") < h.f.events.indexOf("update-password"));
    assert.equal(h.verification, undefined);
  }
});

test("wrong reset token never revokes sessions or changes credentials", async () => {
  const h = await tokenResetFixture(), original = h.verification;
  await assert.rejects(h.run({ body: { token: "wrong-synthetic-token", newPassword: "synthetic-new-password-123" } }), error => error.status === "BAD_REQUEST");
  assert.equal(h.verification, original);
  assert.equal(h.f.revoked, false);
  assert.deepEqual(h.f.revocations, []);
  assert.ok(h.f.events.every(event => event === "token:commit"));
});

test("expired token consumption does not revoke, hash, mutate credentials or verify metadata", async () => {
  const h = await tokenResetFixture({ expired: true });
  await assert.rejects(h.run(), error => error.status === "BAD_REQUEST");
  assert.equal(h.verification, undefined);
  assert.equal(h.f.revoked, false);
  assert.deepEqual(h.f.events, ["token:consume", "token:commit"]);
});

test("consumed-token retry cannot trigger pre-revocation or another credential write", async () => {
  const h = await tokenResetFixture();
  await h.run();
  const revokeCount = h.f.revocations.length, writes = h.f.events.filter(event => event === "update-password").length;
  await assert.rejects(h.run(), error => error.status === "BAD_REQUEST");
  assert.equal(h.f.revocations.length, revokeCount);
  assert.equal(h.f.events.filter(event => event === "update-password").length, writes);
});

test("token consumption failure rolls back pre-revocation and prevents password mutation", async () => {
  const failure = Error("synthetic consume failure"), h = await tokenResetFixture({ consumeError: failure });
  const original = h.verification;
  await assert.rejects(h.run(), error => error === failure);
  assert.equal(h.verification, original);
  assert.equal(h.f.revoked, false);
  assert.deepEqual(h.f.events, ["hook:revoke", "token:consume"]);
});

test("verification hook ignores unrelated contexts, token mismatches, expired and malformed expiry records", async () => {
  const h = await tokenResetFixture(), { f } = h;
  const hook = f.auth.databaseHooks.verification.delete.before, row = h.verification;
  const context = { path: "/reset-password", body: { token: "synthetic-reset-token" } };
  for (const other of [null, {}, { ...context, path: "/verify-email" }, { ...context, path: "/reset-password/" }, { ...context, path: "/api/account/reset-password" }, { ...context, body: {} }, { ...context, body: { token: {} } }, { ...context, body: { token: "wrong-synthetic-token" } }, { ...context, body: { token: "wrong-synthetic-token" }, query: { token: "synthetic-reset-token" } }]) {
    await hook(row, other);
  }
  for (const expiresAt of [new Date(0), new Date(NaN), "2099-01-01", undefined]) await hook({ ...row, expiresAt }, context);
  for (const identifier of ["unrelated-verification", "reset-password:wrong-synthetic-token", "email-verification:synthetic-reset-token"]) await hook({ ...row, identifier }, context);
  assert.deepEqual(f.events, []);
  assert.deepEqual(f.revocations, []);
});

test("post-reset metadata failure still follows both pre- and post-write session revocation", async () => {
  const failure = Error("synthetic metadata failure"), h = await tokenResetFixture({ metadataError: failure });
  await assert.rejects(h.run(), error => error === failure);
  assert.equal(h.f.revoked, true);
  assert.equal(h.verification, undefined);
  assert.deepEqual(h.f.revocations, ["tx-1", "pool"]);
  assert.deepEqual(h.f.events.slice(-3), ["update-password", "hook:revoke", "hook:metadata"]);
});

test("user reservation and session admission lookups use adapter transaction connection and account predicates", async () => {
  const f = fixture({ forbidPoolQueries: true });
  assert.equal(f.adapterOptions.transaction, true);
  const poolReads = f.poolReads, config = { isolationLevel: "read committed" };
  const result = await f.adapter.transaction(async tx => {
    assert.equal(f.scope.getAuthDatabase(), tx);
    assert.deepEqual(await f.auth.databaseHooks.user.create.before(user), { data: user });
    assert.deepEqual(await f.auth.databaseHooks.session.create.before(session), { data: session });
    return "transaction-result";
  }, config);
  assert.equal(result, "transaction-result");
  assert.equal(f.poolReads, poolReads, "hook must not acquire another pool connection");
  assert.equal(f.transactions[0].config, config);
  assert.deepEqual(f.queries, [
    { label: "tx-1", fields: { id: profiles.id }, table: profiles, condition: { column: profiles.email, value: user.email.toLowerCase() }, limit: 1 },
    { label: "tx-1", fields: { disabled: schema.user.disabled, emailVerified: schema.user.emailVerified }, table: schema.user, condition: { column: schema.user.id, value: user.id }, limit: 1 }
  ]);
  assert.equal(f.scope.getAuthDatabase(), f.db);
});

test("orphaned profile reservation rejects inside transaction without acquiring the pool", async () => {
  const f = fixture({ forbidPoolQueries: true, rows: () => [{ id: "legacy-id" }] });
  await assert.rejects(f.adapter.transaction(() => f.auth.databaseHooks.user.create.before(user)), error => error.status === "BAD_REQUEST");
  assert.equal(f.queries[0].label, "tx-1");
  assert.equal(f.scope.getAuthDatabase(), f.db);
});

for (const [state, rows] of [
  ["missing", []], ["disabled", [{ disabled: true, emailVerified: true }]],
  ["unverified", [{ disabled: false, emailVerified: false }]]
]) {
  test(`session hook denies ${state} user on the transaction connection`, async () => {
    const f = fixture({ forbidPoolQueries: true, rows: () => rows });
    await assert.rejects(f.adapter.transaction(() => f.auth.databaseHooks.session.create.before(session)), error => error.status === "FORBIDDEN");
    assert.equal(f.queries[0].label, "tx-1");
    assert.equal(f.scope.getAuthDatabase(), f.db);
  });
}

test("both lookup hooks propagate query failures and restore outer context", async () => {
  const failure = new Error("synthetic lookup failure"), f = fixture({ forbidPoolQueries: true, lookupError: failure });
  for (const [hook, value] of [[f.auth.databaseHooks.user.create.before, user], [f.auth.databaseHooks.session.create.before, session]]) {
    await assert.rejects(f.adapter.transaction(() => hook(value)), error => error === failure);
    assert.equal(f.scope.getAuthDatabase(), f.db);
  }
});

test("interleaved account transactions isolate hook queries and never leak scope to outside callers", async () => {
  const f = fixture({ forbidPoolQueries: true }), enteredA = deferred(), enteredB = deferred(), releaseA = deferred(), releaseB = deferred();
  const beforeReads = f.poolReads;
  const execute = (id, entered, release) => f.adapter.transaction(async tx => {
    assert.equal(f.scope.getAuthDatabase(), tx);
    entered.resolve();
    await release.promise;
    assert.equal(f.scope.getAuthDatabase(), tx);
    await f.auth.databaseHooks.user.create.before({ ...user, id, email: `${id}@example.invalid` });
    await Promise.resolve();
    assert.equal(f.scope.getAuthDatabase(), tx);
    await f.auth.databaseHooks.session.create.before({ ...session, userId: id });
    return tx;
  });
  const a = execute("account-a", enteredA, releaseA);
  await enteredA.promise;
  const b = execute("account-b", enteredB, releaseB);
  await enteredB.promise;
  try {
    assert.equal(f.scope.getAuthDatabase(), f.db);
    releaseB.resolve();
    const bTx = await b;
    assert.equal(bTx, f.transactions[1].tx);
    assert.equal(f.scope.getAuthDatabase(), f.db);
    releaseA.resolve();
    assert.equal(await a, f.transactions[0].tx);
  } finally {
    releaseA.resolve(); releaseB.resolve();
    await a; await b;
  }
  assert.equal(f.poolReads, beforeReads + 2, "only outside callers may consult the pool");
  assert.deepEqual(f.queries.map(q => [q.label, q.condition.value]), [
    ["tx-2", "account-b@example.invalid"], ["tx-2", "account-b"],
    ["tx-1", "account-a@example.invalid"], ["tx-1", "account-a"]
  ]);
  assert.equal(f.scope.getAuthDatabase(), f.db);
});

test("nested proxy transactions restore enclosing connection after rejection and pass through properties", async () => {
  const f = fixture(), failure = new Error("synthetic rollback");
  assert.equal(f.adapter.label, "pool");
  assert.equal(f.adapter.select, f.db.select);
  await f.adapter.transaction(async outer => {
    await assert.rejects(f.adapter.transaction(async inner => {
      assert.notEqual(inner, outer);
      await Promise.resolve();
      assert.equal(f.scope.getAuthDatabase(), inner);
      throw failure;
    }), error => error === failure);
    assert.equal(f.scope.getAuthDatabase(), outer);
  });
  assert.equal(f.scope.getAuthDatabase(), f.db);
});
