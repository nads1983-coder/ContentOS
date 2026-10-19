import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTs, createImageHarness } from "./image-test-helpers.mjs";

const entitlements = loadTs("lib/entitlements.ts");
const owner = { plan: "pro_studio", subscription_status: "active", subscription_current_period_end: null,
  entitlement_source: "owner_complimentary_lifetime", amount_paid: 0 };

test("retired checkout refuses every Founder flag before auth, DB, Stripe or usage calls", async () => {
  const forbidden = () => { throw new Error("Must not call dependencies"); };
  const { POST } = loadTs("app/api/billing/checkout/route.ts", {
    "server-only": {}, "next/server": { NextResponse: Response },
    "@/lib/request-security": { rejectUnsafeWrite: () => null },
    "@/lib/auth": { getCurrentUser: forbidden }, "@/lib/backend": {},
    "@/lib/repository": {}, "@/lib/founder-claim-repository": {}, "@/lib/stripe-rest": {}
  });
  for (const founderOffer of [true, "true", "1", 1]) {
    const response = await POST(new Request("https://example.invalid/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ plan: "pro_creator", founderOffer })
    }));
    assert.equal(response.status, 410);
    assert.match((await response.json()).error, /closed/);
  }
});

test("Stripe acquisition helpers independently refuse retired Founder offers without transport", async () => {
  const api = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => ({}), isStripeConfigured: () => true } });
  await assert.rejects(api.getFounderOfferAvailability(), /closed/);
  await assert.rejects(api.createCheckoutSession({ plan: "pro_creator", founderOffer: true, founderPromotionCodeId: "promo_synthetic" }), /closed/);
});

test("owner complimentary Premium has normal limits; similar or incomplete markers do not grant lifetime access", () => {
  assert.equal(entitlements.hasLifetimeEntitlement(owner), true);
  const usage = loadTs("lib/usage.ts");
  assert.equal(usage.monthlyLimitForPlan(owner.plan), 250);
  for (const change of [{ plan: "free" }, { subscription_status: "canceled" }, { entitlement_source: "owner" },
    { subscription_current_period_end: "2030-01-01" }]) {
    assert.equal(entitlements.hasLifetimeEntitlement({ ...owner, ...change }), false);
  }
});

test("actual repository preserves owner and Founder lifetime data across duplicate/reordered billing writes", async () => {
  for (const entitlement of [owner, { plan: "founder", subscription_status: "active", entitlement_source: "founder_offer" }]) {
    const h = createImageHarness({ profile: { ...entitlement, stripe_customer_id: "cus_synthetic",
      stripe_subscription_id: "sub_synthetic", stripe_checkout_session_id: "cs_synthetic",
      generation_history_json: [{ id: "history" }], usage_events_json: [{ id: "usage" }], workspace: { draft: "preserve" } } });
    const before = structuredClone(h.data), other = structuredClone(h.rows.get("other-user"));
    for (const state of [{ plan: "free", status: "canceled" }, { plan: "pro_creator", status: "past_due" },
      { plan: "pro_creator", status: "active", stripeSubscriptionId: "sub_old" }, { plan: "free", status: "canceled" }]) {
      await h.repository.updateSubscriptionStatus({ userId: "user-test", ...state });
      assert.deepEqual(h.data, before);
    }
    assert.deepEqual(h.rows.get("other-user"), other);
  }
});

test("ordinary subscription cancellations still update normally", async () => {
  const h = createImageHarness();
  await h.repository.updateSubscriptionStatus({ userId: "user-test", plan: "free", status: "canceled" });
  assert.equal(h.data.plan, "free");
  assert.equal(h.data.subscription_status, "canceled");
});

test("public offer removed without changing paid plan prices or product limits", () => {
  const { pricingPlans } = loadTs("lib/pricing.ts");
  assert.deepEqual(pricingPlans.map(p => p.price), ["£0", "£9/month", "£39/month"]);
  assert.ok(pricingPlans.every(p => !p.offerNote));
  for (const file of ["app/page.tsx", "app/pricing/page.tsx", "app/dashboard/page.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /FoundingOffer|Continue Founder claim|Claim Founder Access/);
  }
  assert.doesNotMatch(readFileSync("app/sitemap.ts", "utf8"), /path: "\/founder"/);
});
