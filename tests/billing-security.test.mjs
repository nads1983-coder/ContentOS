import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { sql } from "drizzle-orm";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
function loadTs(relative, mocks = {}, cache = new Map()) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`, mocks, cache) : nativeRequire(id);
  const fetch = mocks.__fetch ?? (() => { throw Error("Unexpected network access in offline billing test"); });
  new Function("require", "module", "exports", "fetch", "console", outputText)(require, module, module.exports, fetch, mocks.__console ?? console);
  return module.exports;
}
const secret = "offline-synthetic-signing-key";
const stripe = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => ({ stripeWebhookSecret: secret }) } });
const payload = JSON.stringify({ type: "review.fixture", data: { object: {} } });
const clock = 1_800_000_000;
const signature = (body, time, key = secret) => createHmac("sha256", key).update(`${time}.${body}`).digest("hex");
const header = (body, time) => `t=${time},v1=${signature(body, time)}`;

test("webhook signature requires fresh integer timestamp and exact signed bytes", () => {
  for (const offset of [-300, 0, 300]) assert.equal(stripe.verifyStripeSignature(payload, header(payload, clock + offset), clock), true);
  for (const time of [1, clock - 301, clock + 301, 0, -1, 1.5, "NaN", "1e9", "9007199254740993", ""]) {
    assert.equal(stripe.verifyStripeSignature(payload, header(payload, time), clock), false, String(time));
  }
  assert.equal(stripe.verifyStripeSignature(`${payload} `, header(payload, clock), clock), false);
  assert.equal(stripe.verifyStripeSignature(payload, null, clock), false);
  assert.equal(stripe.verifyStripeSignature(payload, `t=${clock},t=${clock},v1=${signature(payload, clock)}`, clock), false);
  assert.equal(stripe.verifyStripeSignature(payload, `v1=${signature(payload, clock)}`, clock), false);
  assert.equal(stripe.verifyStripeSignature(payload, `t=${clock},v0=${signature(payload, clock)}`, clock), false);
  assert.equal(stripe.verifyStripeSignature(payload, "x".repeat(8193), clock), false);
  assert.equal(stripe.verifyStripeSignature(payload, header(payload, clock), NaN), false);
  const noSecret = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => ({}) } });
  assert.equal(noSecret.verifyStripeSignature(payload, header(payload, clock), clock), false);
});

test("multiple v1 values support rotation in either order without accepting malformed hex", () => {
  const valid = signature(payload, clock), wrong = signature(payload, clock, "different-synthetic-key");
  for (const values of [[valid, wrong], [wrong, valid], ["bad", valid], [valid, "bad"]]) {
    assert.equal(stripe.verifyStripeSignature(payload, `t=${clock}, ${values.map(x => `v1=${x}`).join(", ")}`, clock), true);
  }
  for (const value of [wrong, valid.slice(0, -1), `${valid}junk`, "g".repeat(64), ""]) {
    assert.equal(stripe.verifyStripeSignature(payload, `t=${clock},v1=${value}`, clock), false);
  }
});

const profile = (extra = {}) => ({ id: "review-user", email: "review@example.test", plan: "pro_studio", subscription_status: "active", stripe_subscription_id: "sub_current", ...extra });
function repositoryHarness(initial = profile()) {
  let data = structuredClone(initial), queue = Promise.resolve(), beforeLock;
  const tx = {
    select: () => ({ from: () => ({ where: predicate => ({
      limit: async () => data[predicate.field] === predicate.value ? [{ data: structuredClone(data) }] : [],
      for: async mode => { assert.equal(mode, "update"); beforeLock?.(); beforeLock = undefined; return [{ data: structuredClone(data) }]; }
    }) }) }),
    update: () => ({ set: update => ({ where: async () => { data = structuredClone(update.data); } }) })
  };
  const db = { ...tx, transaction: fn => { const job = queue.then(() => fn(tx)); queue = job.catch(() => {}); return job; } };
  const repo = loadTs("lib/postgres-repository.ts", {
    "server-only": {}, "drizzle-orm": { sql, eq: (field, value) => ({ field, value }) },
    "@/lib/db/client": { getDb: () => db }, "@/lib/db/app-schema": { profiles: { id: "id", email: "email" } }
  });
  return { repo, get data() { return data; }, changeAtLock(next) { beforeLock = () => { data = structuredClone(next); }; } };
}
const deletion = { userId: "review-user", plan: "free", status: "canceled", stripeSubscriptionId: "sub_old", expectedStripeSubscriptionId: "sub_old" };

test("stale deletion is ignored using current locked profile, not a pre-lock snapshot", async () => {
  const h = repositoryHarness(profile({ stripe_subscription_id: "sub_old" }));
  h.changeAtLock(profile());
  await h.repo.updateSubscriptionStatus(deletion);
  assert.equal(h.data.stripe_subscription_id, "sub_current");
  assert.equal(h.data.plan, "pro_studio");
  assert.equal(h.data.subscription_status, "active");
});

test("current deletion still revokes recurring access and duplicate delivery is entitlement-idempotent", async () => {
  const h = repositoryHarness(profile({ stripe_subscription_id: "sub_old" }));
  await h.repo.updateSubscriptionStatus(deletion);
  assert.equal(h.data.plan, "free");
  assert.equal(h.data.subscription_status, "canceled");
  await h.repo.updateSubscriptionStatus(deletion);
  assert.equal(h.data.plan, "free");
  await h.repo.updateSubscriptionStatus({ userId: "review-user", plan: "pro_studio", status: "active", stripeSubscriptionId: "sub_new" });
  await h.repo.updateSubscriptionStatus(deletion);
  assert.equal(h.data.stripe_subscription_id, "sub_new");
  assert.equal(h.data.plan, "pro_studio");
});

test("lifetime entitlements and unrelated profile data survive guarded and ordinary billing updates", async () => {
  for (const extra of [{ plan: "founder", entitlement_source: "founder_offer" }, { entitlement_source: "manual_lifetime_upgrade_cousin" }]) {
    const original = profile({ ...extra, stripe_subscription_id: "sub_old", studio_state_json: { preserved: true }, text_generation_attempts_json: [100] });
    const h = repositoryHarness(original);
    await h.repo.updateSubscriptionStatus(deletion);
    await h.repo.updateSubscriptionStatus({ ...deletion, expectedStripeSubscriptionId: undefined });
    assert.deepEqual(h.data, original);
  }
  const h = repositoryHarness(profile({ studio_state_json: { preserved: true }, image_generation_usage_json: { month: 5 } }));
  await h.repo.updateSubscriptionStatus({ ...deletion, expectedStripeSubscriptionId: "sub_current" });
  assert.deepEqual(h.data.studio_state_json, { preserved: true });
  assert.deepEqual(h.data.image_generation_usage_json, { month: 5 });
});

function webhookHarness(initial = profile(), stripeOverrides = {}) {
  const h = repositoryHarness(initial), calls = [];
  const route = loadTs("app/api/billing/webhook/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/stripe-rest": { ...stripe, getStripeSubscriptionState: async () => { throw Error("Unexpected external lookup"); }, ...stripeOverrides },
    "@/lib/repository": { updateSubscriptionStatus: async input => { calls.push(input); return h.repo.updateSubscriptionStatus(input); } },
    "@/lib/founder-claim-repository": { founderClaimRepository: {} }
  });
  return { h, calls, async send(body, timestamp = Math.floor(Date.now() / 1000)) {
    return route.POST(new Request("https://review.invalid/api/billing/webhook", { method: "POST", headers: { "stripe-signature": header(body, timestamp) }, body }));
  } };
}
const deletedEvent = id => JSON.stringify({ type: "customer.subscription.deleted", data: { object: { id, customer: "cus_review", metadata: { user_id: "review-user" } } } });

test("webhook propagates deletion identity guard and does not downgrade a newer subscription", async () => {
  const { h, calls, send } = webhookHarness();
  assert.equal((await send(deletedEvent("sub_old"))).status, 200);
  assert.equal(calls[0].expectedStripeSubscriptionId, "sub_old");
  assert.equal(h.data.plan, "pro_studio");
  assert.equal(h.data.stripe_subscription_id, "sub_current");
  assert.equal((await send(deletedEvent("sub_current"))).status, 200);
  assert.equal(h.data.plan, "free");
});

test("webhook rejects expired signatures, invalid event JSON and absent deletion identity before mutation", async () => {
  const { calls, send } = webhookHarness();
  assert.equal((await send(deletedEvent("sub_old"), 1)).status, 400);
  for (const body of ["{", "null", "{}", deletedEvent(undefined)]) assert.equal((await send(body)).status, 400);
  assert.equal(calls.length, 0);
});

test("created and updated events reconcile current customer subscriptions instead of stale snapshots", async () => {
  const oldSubscription = { id: "sub_old", customer: "cus_review", status: "canceled", metadata: { plan: "pro_creator" } };
  const currentSubscription = { id: "sub_current", customer: "cus_review", status: "active", metadata: { plan: "pro_studio" } };
  const reads = [];
  const reconciler = loadTs("lib/stripe-rest.ts", {
    "@/lib/env": { getEnv: () => ({ stripeWebhookSecret: secret, stripeSecretKey: "offline-fixture" }), isStripeConfigured: () => true },
    __fetch: async (url, options) => {
      assert.equal(options.method, "GET");
      reads.push(url.pathname);
      if (url.pathname === "/v1/subscriptions/sub_old") return Response.json(oldSubscription);
      assert.equal(url.pathname, "/v1/subscriptions");
      assert.equal(url.searchParams.get("customer"), "cus_review");
      return Response.json({ data: [oldSubscription, currentSubscription] });
    }
  });
  const { h, send } = webhookHarness(profile(), reconciler);
  for (const type of ["customer.subscription.created", "customer.subscription.updated"]) {
    const body = JSON.stringify({ type, data: { object: { ...oldSubscription, metadata: { user_id: "review-user" } } } });
    assert.equal((await send(body)).status, 200);
    assert.equal(h.data.plan, "pro_studio");
    assert.equal(h.data.stripe_subscription_id, "sub_current");
  }
  assert.deepEqual(reads, ["/v1/subscriptions/sub_old", "/v1/subscriptions", "/v1/subscriptions/sub_old", "/v1/subscriptions"]);
});

test("failed current-state reconciliation cannot fall back to stale webhook entitlements", async () => {
  const { h, calls, send } = webhookHarness(profile(), { getStripeSubscriptionState: async () => { throw Error("synthetic lookup outage"); } });
  const body = JSON.stringify({ type: "customer.subscription.updated", data: { object: { id: "sub_old", status: "canceled", metadata: { user_id: "review-user" } } } });
  await assert.rejects(send(body), /synthetic lookup outage/);
  assert.equal(calls.length, 0);
  assert.deepEqual(h.data, profile());
});

function captureBillingLogs() {
  const logs = [];
  const logger = Object.fromEntries(["log", "warn", "error"].map(level => [level, (...args) => logs.push([level, ...args])]));
  return { logs, logger };
}
function assertSafeBillingLogs(logs, forbidden) {
  assert.ok(logs.length > 0);
  for (const [level, category, fields, ...extra] of logs) {
    assert.ok(["log", "warn", "error"].includes(level));
    assert.match(category, /^billing\.[a-z_]+$/);
    assert.deepEqual(Object.keys(fields).sort(), ["count", "status"]);
    assert.ok(["resolved", "activated", "permanently_rejected", "retryable_failure", "unconfirmed_ignored", "invalid_session_failed", "nonzero_session_failed"].includes(fields.status));
    assert.ok(Number.isSafeInteger(fields.count) && fields.count >= 0);
    assert.deepEqual(extra, []);
  }
  const serialized = JSON.stringify(logs);
  for (const value of forbidden) assert.equal(serialized.includes(value), false, "Sensitive fixture value appeared in billing logs");
}

test("all billing console sites permit only fixed categories, fixed outcomes and numeric counts", () => {
  let sites = 0;
  for (const file of ["lib/stripe-rest.ts", "app/api/billing/webhook/route.ts"]) {
    const source = ts.createSourceFile(file, readFileSync(resolve(root, file), "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === "console") {
        sites++;
        assert.equal(node.arguments.length, 2);
        const [category, fields] = node.arguments;
        assert.ok(ts.isStringLiteral(category) && /^billing\.[a-z_]+$/.test(category.text));
        assert.ok(ts.isObjectLiteralExpression(fields));
        assert.deepEqual(fields.properties.map(p => p.name?.getText(source)).sort(), ["count", "status"]);
        for (const property of fields.properties) {
          assert.ok(ts.isPropertyAssignment(property));
          if (property.name.getText(source) === "status") assert.ok(ts.isStringLiteral(property.initializer));
          else assert.ok(ts.isNumericLiteral(property.initializer) || property.initializer.getText(source) === "subscriptions.length");
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.equal(sites, 10);
});

test("webhook success, ignored and error logs never include identity, Stripe IDs or raw errors", async () => {
  const { logs, logger } = captureBillingLogs();
  const sensitive = { id: "cs_private_fixture", customer: "cus_private_fixture", subscription: "sub_private_fixture", customer_email: "private@example.test", client_reference_id: "user_private_fixture", status: "raw_private_status", payment_status: "raw_private_payment", amount_total: 918273, metadata: { user_id: "user_private_fixture" } };
  const rawError = `private-provider-error ${secret} ${sensitive.customer_email} ${sensitive.customer}`;
  let founder = false, outcome = "success";
  const route = loadTs("app/api/billing/webhook/route.ts", {
    __console: logger,
    "next/server": { NextResponse: Response },
    "@/lib/stripe-rest": { ...stripe, getStripeSubscriptionState: async () => ({ ...sensitive, plan: "pro_studio", status: sensitive.status }) },
    "@/lib/repository": { updateSubscriptionStatus: async () => [] },
    "@/lib/founder-offer": { founderSubscriptionMetadataQualifies: () => founder },
    "@/lib/founder-claim-repository": { founderClaimRepository: {} },
    "@/lib/founder-checkout-service": {
      handleFounderCheckoutCompleted: async () => { if (outcome !== "success") throw Error(rawError); },
      handleFounderSubscriptionEvent: async () => false,
      isPermanentFounderActivationError: () => outcome === "permanent",
      founderWebhookActivationStatus: () => 503
    }
  });
  async function send(type) {
    const body = JSON.stringify({ type, data: { object: sensitive } });
    return route.POST(new Request("https://review.invalid/api/billing/webhook", { method: "POST", body, headers: { "stripe-signature": header(body, Math.floor(Date.now() / 1000)) } }));
  }
  for (const type of ["checkout.session.completed", "invoice.paid", "customer.subscription.updated", "customer.subscription.deleted"]) assert.equal((await send(type)).status, 200);
  founder = true;
  assert.equal((await send("checkout.session.completed")).status, 200);
  outcome = "permanent";
  assert.equal((await send("checkout.session.completed")).status, 200);
  outcome = "retryable";
  assert.equal((await send("checkout.session.completed")).status, 503);
  assert.equal((await send("customer.subscription.updated")).status, 200);
  assert.equal(logs.length, 8);
  assertSafeBillingLogs(logs, [secret, rawError, ...Object.values(sensitive).filter(x => typeof x === "string"), "918273"]);
});

test("Stripe lookup and failed checkout expiration logs omit customer data and provider errors", async () => {
  const { logs, logger } = captureBillingLogs();
  const env = { appUrl: "https://review.invalid", stripeSecretKey: "sk_test_private_fixture", stripeWebhookSecret: secret, stripeProCreatorPriceId: "price_private_fixture" };
  const identity = { id: "sub_private_fixture", customer: "cus_private_fixture", status: "private_raw_status", metadata: { plan: "pro_studio" } };
  const email = "private@example.test", rawError = `private-provider-error ${env.stripeSecretKey} ${email}`;
  let valid = false;
  const helpers = loadTs("lib/stripe-rest.ts", {
    __console: logger,
    "@/lib/env": { getEnv: () => env, isStripeConfigured: () => true },
    "@/lib/founder-offer": { founderOpenCheckoutSessionIsValid: () => valid, founderCheckoutDiscountParams: () => ({}), founderCheckoutMetadata: () => ({}) },
    __fetch: async input => {
      const url = new URL(input);
      if (url.pathname.endsWith("/expire")) return Response.json({ error: { message: rawError } }, { status: 500 });
      if (url.pathname.startsWith("/v1/checkout/sessions")) return Response.json({ id: "cs_private_fixture", amount_total: 918273 });
      if (url.pathname === "/v1/customers") return Response.json({ data: [{ id: identity.customer, email }] });
      if (url.pathname === "/v1/subscriptions") return Response.json({ data: [identity] });
      assert.equal(url.pathname, `/v1/subscriptions/${identity.id}`);
      return Response.json(identity);
    }
  });
  await helpers.getStripeSubscriptionState({ stripeSubscriptionId: identity.id, stripeCustomerId: identity.customer, email });
  for (const pass of [false, true]) {
    valid = pass;
    await assert.rejects(helpers.createCheckoutSession({ plan: "pro_creator", userId: "user_private_fixture", email, founderOffer: true, founderPromotionCodeId: "promo_private_fixture" }), helpers.FounderCheckoutError);
  }
  assert.deepEqual(logs.map(entry => entry[2].status), ["resolved", "invalid_session_failed", "nonzero_session_failed"]);
  assertSafeBillingLogs(logs, [secret, env.stripeSecretKey, email, rawError, identity.id, identity.customer, identity.status, "cs_private_fixture", "user_private_fixture", "918273"]);
});
