import assert from "node:assert/strict";
import test from "node:test";
import { loadTs, createImageHarness } from "./image-test-helpers.mjs";

const env = {
  stripeSecretKey: "offline", stripeLitePriceId: "price_lite",
  stripeProCreatorPriceId: "price_creator", stripeProStudioPriceId: "price_studio",
  stripeLegacyProCreatorPriceIds: ["price_creator_legacy"], stripeLegacyProStudioPriceIds: [],
  appUrl: "https://example.invalid"
};
const quiet = { log() {}, warn() {}, error() {} };
const prices = { lite: "price_lite", pro_creator: "price_creator", pro_studio: "price_studio" };
const limits = { free: 3, lite: 10, pro_creator: 50, pro_studio: 250 };
const { monthlyLimitForPlan } = loadTs("lib/usage.ts");
function subscription(plan, original = plan, extra = {}) {
  return { id: "sub_synthetic", customer: "cus_synthetic", status: "active",
    metadata: { plan: original, user_id: "user-test" },
    items: { data: [{ quantity: 1, price: { id: prices[plan], active: true, type: "recurring", recurring: { usage_type: "licensed" } } }] },
    ...extra };
}
function harness(profile = {}) {
  const preserved = {
    workspace: { draft: "Keep this draft" }, brand_profiles_json: [{ name: "Synthetic" }],
    generation_history_json: [{ id: "original" }], usage_events_json: [{ id: "usage-one" }],
    generation_usage_json: { "2026-10-01T00:00:00.000Z": 8 }
  };
  const h = createImageHarness({ profile: { plan: "free", ...preserved, ...profile } });
  h.stripeRows = [subscription("lite")];
  h.stripeCalls = [];
  const api = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => env, isStripeConfigured: () => true } }, new Map(), {
    console: quiet, fetch: async (raw, init) => {
      assert.equal(init.method, "GET", "webhooks must not create purchases or provider calls");
      h.stripeCalls.push(String(raw));
      if (h.failStripe) throw new Error("Synthetic Stripe outage");
      const url = new URL(raw);
      if (url.pathname === "/v1/subscriptions") {
        assert.equal(url.searchParams.get("customer"), "cus_synthetic");
        return Response.json({ data: h.stripeRows });
      }
      const row = h.stripeRows.find(s => url.pathname.endsWith(`/${s.id}`));
      return row ? Response.json(row) : Response.json({ error: { message: "Missing" } }, { status: 404 });
    }
  });
  const { POST } = loadTs("app/api/billing/webhook/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/founder-claim-repository": {},
    "@/lib/stripe-rest": { ...api, verifyStripeSignature: () => true },
    "@/lib/repository": { updateSubscriptionStatus: h.repository.updateSubscriptionStatus }
  }, new Map(), { console: quiet });
  h.send = (object, type = "customer.subscription.updated") => POST(new Request("https://example.invalid/webhook", {
    method: "POST", body: JSON.stringify({ id: "evt_synthetic", type, data: { object } })
  }));
  h.api = api;
  h.checkPreserved = () => { for (const [key, value] of Object.entries(preserved)) assert.deepEqual(h.data[key], value, key); };
  return h;
}

for (const path of [
  ["lite", "pro_creator", "lite"], ["pro_studio", "lite", "pro_creator"],
  ["pro_creator", "lite", "pro_studio"], ["pro_creator", "pro_studio", "lite"]
]) test(`complete webhook transition ${path.join(" -> ")} ignores original metadata`, async () => {
  const h = harness();
  const other = structuredClone(h.rows.get("other-user"));
  for (const plan of path) {
    h.stripeRows = [subscription(plan, path[0])];
    const staleEvent = subscription(path[0]);
    for (let duplicate = 0; duplicate < 2; duplicate++) {
      assert.equal((await h.send(staleEvent)).status, 200);
      assert.equal(h.data.plan, plan);
      assert.equal(monthlyLimitForPlan(h.data.plan), limits[plan]);
      h.checkPreserved();
      assert.deepEqual(h.rows.get("other-user"), other);
    }
  }
});

test("unknown, missing, mixed and ambiguous prices never inherit paid metadata or stored tiers", () => {
  const h = harness();
  const base = subscription("lite", "pro_studio");
  const item = price => ({ price });
  for (const items of [undefined, { data: [] }, { data: [{}] },
    { data: [item({ id: "unknown", active: false })] },
    { data: [item({ id: "price_lite", type: "one_time" })] },
    { data: [item({ id: "price_lite", recurring: null })] },
    { data: [item({ id: "price_lite", recurring: { usage_type: "metered" } })] },
    { data: [{ ...item({ id: "price_studio" }), quantity: 0 }] },
    { data: [item({ id: "price_lite" }), item({ id: "price_studio" })] },
    { data: [item({ id: "price_studio" })], has_more: true }
  ]) {
    const state = h.api.stripeSubscriptionToState({ ...base, items });
    assert.equal(state.plan, "free");
    assert.equal(h.api.reconcileActiveSubscriptionPlan(state, "pro_studio").plan, "free");
    assert.equal(h.api.hasActiveUnknownPaidSubscription(state), true, "must not sell a duplicate subscription");
  }
  const ambiguous = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => ({ ...env, stripeProStudioPriceId: "price_lite" }) } });
  assert.equal(ambiguous.stripeSubscriptionToState(base).plan, "free");
});

test("archived recognised prices preserve the purchased tier, never stale higher metadata", () => {
  const h = harness();
  for (const [id, expected] of [["price_lite", "lite"], ["price_creator_legacy", "pro_creator"]]) {
    const s = subscription("lite", "pro_studio", { items: { data: [{ price: { id, active: false } }] } });
    assert.equal(h.api.stripeSubscriptionToState(s).plan, expected);
  }
  assert.equal(h.api.stripeSubscriptionToState(subscription("lite", "pro_studio", { status: "incomplete" })).plan, "free");
});

test("scheduled downgrade and pending prorated upgrade do not change entitlements before current item changes", async () => {
  const h = harness();
  const s = subscription("pro_studio", "pro_creator", {
    schedule: { phases: [{ items: [{ price: "price_lite" }] }] },
    pending_update: { subscription_items: [{ price: "price_lite" }] }
  });
  h.stripeRows = [s];
  await h.send(s);
  assert.equal(h.data.plan, "pro_studio");
  h.stripeRows = [subscription("lite", "pro_creator")];
  await h.send(s);
  assert.equal(h.data.plan, "lite");
  h.stripeRows = [subscription("lite", "pro_creator", { pending_update: { subscription_items: [{ price: "price_studio" }] } })];
  await h.send(s, "invoice.paid");
  assert.equal(h.data.plan, "lite");
  h.stripeRows = [subscription("pro_studio", "pro_creator")];
  await h.send(s);
  assert.equal(h.data.plan, "pro_studio");
  h.checkPreserved();
});

test("cancellation, renewal and reordered deletion reconcile current subscriptions, not stale event snapshots", async () => {
  const h = harness();
  const end = Math.floor(Date.now() / 1000) + 86400;
  const cancel = subscription("lite", "pro_studio", { cancel_at_period_end: true, current_period_end: end });
  h.stripeRows = [cancel];
  await h.send(cancel);
  assert.equal(h.data.plan, "lite");
  assert.equal(h.data.subscription_cancel_at_period_end, true);
  h.stripeRows = [subscription("lite", "pro_studio", { current_period_end: end + 86400 })];
  await h.send({ ...cancel, subscription: cancel.id }, "invoice.paid");
  assert.equal(h.data.subscription_cancel_at_period_end, false);
  const deleted = { ...cancel, status: "canceled", current_period_end: 1 };
  h.stripeRows = [deleted];
  await h.send(deleted, "customer.subscription.deleted");
  assert.equal(h.data.plan, "free");
  const replacement = subscription("pro_creator", "pro_studio", { id: "sub_replacement" });
  h.stripeRows = [deleted, replacement];
  for (const type of ["customer.subscription.deleted", "customer.subscription.updated", "customer.subscription.deleted"]) {
    await h.send(deleted, type);
    assert.equal(h.data.plan, "pro_creator");
    assert.equal(h.data.stripe_subscription_id, "sub_replacement");
  }
  h.checkPreserved();
});

test("lookup failures never persist historical cancellation snapshots; webhook processing fails for retry", async () => {
  const h = harness({ plan: "pro_creator" });
  const before = structuredClone(h.data);
  h.failStripe = true;
  await assert.rejects(() => h.send(subscription("lite"), "customer.subscription.deleted"), /Stripe outage/);
  assert.deepEqual(h.data, before);
});

test("Founder and complimentary owner profiles survive paid-plan and cancellation events unchanged", async () => {
  for (const protection of [
    { plan: "founder", entitlement_source: "founder_offer" },
    { plan: "pro_studio", entitlement_source: "owner_complimentary_lifetime" }
  ]) {
    const h = harness({ ...protection, subscription_status: "active" });
    const before = structuredClone(h.data);
    for (const status of ["active", "canceled"]) {
      const s = subscription("lite", "pro_creator", { status, cancel_at: 1796083200, cancel_at_period_end: false });
      h.stripeRows = [s];
      await h.send(s, status === "active" ? "customer.subscription.updated" : "customer.subscription.deleted");
      assert.deepEqual(h.data, before);
    }
  }
});

test("captured portal cancel_at is pending without changing the authoritative billing period", () => {
  const h = harness();
  // Relevant fields from the real test-clock portal cancellation captured on 26 October.
  const captured = subscription("pro_creator", "lite", {
    status: "active", cancel_at_period_end: false, cancel_at: 1796083200,
    current_period_end: 1796083200, canceled_at: 1793498400
  });
  const state = h.api.stripeSubscriptionToState(captured);
  assert.equal(state.cancelAtPeriodEnd, true);
  assert.equal(state.cancelAt, "2026-12-01T00:00:00.000Z");
  assert.equal(state.currentPeriodEnd, "2026-12-01T00:00:00.000Z");
  assert.equal(state.canceledAt, "2026-11-01T02:00:00.000Z", "canceled_at is initiation, not effective cancellation");
  assert.equal(state.plan, "pro_creator");
  const earlier = h.api.stripeSubscriptionToState({ ...captured, cancel_at: 1794787200 });
  assert.equal(earlier.cancelAt, "2026-11-16T00:00:00.000Z");
  assert.equal(earlier.currentPeriodEnd, state.currentPeriodEnd, "do not change quota windows or entitlement expiry");
});

test("period-end flag falls back to period end; explicit cancel_at takes precedence", () => {
  const h = harness();
  const s = subscription("lite", "pro_studio", { cancel_at_period_end: true, current_period_end: 1796083200 });
  assert.equal(h.api.stripeSubscriptionToState(s).cancelAt, "2026-12-01T00:00:00.000Z");
  assert.equal(h.api.stripeSubscriptionToState({ ...s, cancel_at: 1794787200 }).cancelAt, "2026-11-16T00:00:00.000Z");
  assert.equal(h.api.stripeSubscriptionToState({ ...s, current_period_end: undefined }).cancelAt, null);
  for (const cancel_at of [null, undefined, 0, -1, NaN, Infinity, "1796083200"]) {
    const state = h.api.stripeSubscriptionToState({ ...s, cancel_at_period_end: false, cancel_at });
    assert.equal(state.cancelAtPeriodEnd, false);
    assert.equal(state.cancelAt, null);
  }
});

for (const plan of ["lite", "pro_creator", "pro_studio"]) {
  test(`${plan}: webhook persists both cancellation forms, reversal clears date, renewal keeps usage`, async () => {
    const h = harness();
    const other = structuredClone(h.rows.get("other-user"));
    const end = 1796083200;
    for (const extra of [
      { cancel_at: 1794787200, cancel_at_period_end: false },
      { cancel_at: null, cancel_at_period_end: true }
    ]) {
      h.stripeRows = [subscription(plan, "pro_studio", { current_period_end: end, ...extra })];
      for (let n = 0; n < 2; n++) await h.send(h.stripeRows[0]);
      assert.equal(h.data.plan, plan);
      assert.equal(h.data.subscription_cancel_at_period_end, true);
      assert.equal(h.data.subscription_cancel_at, new Date((extra.cancel_at ?? end) * 1000).toISOString());
      assert.equal(h.data.subscription_current_period_end, new Date(end * 1000).toISOString());
      assert.equal((await h.repository.getUserProfile("user-test")).subscription_cancel_at, h.data.subscription_cancel_at);
      h.checkPreserved();
    }
    const staleCancellation = h.stripeRows[0];
    h.stripeRows = [subscription(plan, "lite", { cancel_at: null, cancel_at_period_end: false, current_period_end: end })];
    await h.send(staleCancellation);
    assert.equal(h.data.subscription_cancel_at_period_end, false);
    assert.equal(h.data.subscription_cancel_at, null);
    h.stripeRows = [subscription(plan, "lite", { current_period_end: end + 31 * 86400 })];
    await h.send(h.stripeRows[0], "invoice.paid");
    assert.equal(h.data.plan, plan);
    assert.equal(h.data.subscription_cancel_at, null);
    assert.equal(h.data.subscription_cancel_at_period_end, false);
    assert.deepEqual(h.rows.get("other-user"), other);
    h.checkPreserved();
  });
}
