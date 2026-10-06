import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticatedFounderDestination,
  checkoutSessionPromotionCodeIds,
  createFounderClaimGate,
  founderCheckoutDiscountParams,
  founderCheckoutSessionIsValid,
  founderClaimConflict,
  founderLoginCallbackUrl,
  founderSubscriptionEntitlementState,
  founderSubscriptionMetadataQualifies,
  founderWebhookCheckoutQualifies,
  resolveFounderOfferAvailability
} from "../lib/founder-offer.ts";

const activeFounding100 = {
  id: "promo_founder_100",
  code: "FOUNDING100",
  active: true,
  max_redemptions: 100,
  times_redeemed: 7
};

test("Founder intent survives signup, email-verification callback, login and authenticated resume", () => {
  assert.equal(
    founderLoginCallbackUrl("https://getcontentos.co", "pro_creator", true),
    "https://getcontentos.co/login?plan=pro_creator&founder=1"
  );
  assert.equal(
    founderLoginCallbackUrl("https://getcontentos.co", null, true),
    "https://getcontentos.co/login?plan=pro_creator&founder=1"
  );
  assert.equal(authenticatedFounderDestination(true), "/founder/checkout");
  assert.equal(authenticatedFounderDestination(false), "/dashboard");
});

test("existing Founder and paid users are blocked from consuming another Founder place", () => {
  assert.deepEqual(
    founderClaimConflict({
      plan: "founder",
      subscription_status: "active",
      entitlement_source: "founder_offer"
    }),
    {
      status: 409,
      error: "Your lifetime access already includes this plan.",
      redirectUrl: "/dashboard"
    }
  );
  assert.deepEqual(
    founderClaimConflict({
      plan: "pro_creator",
      subscription_status: "active"
    }),
    {
      status: 409,
      error: "Your active account already includes paid access.",
      redirectUrl: "/dashboard"
    }
  );
  assert.equal(founderClaimConflict({ plan: "free", subscription_status: "none" }), null);
});

test("FOUNDING100 must exist, be active, have a limit and have remaining redemptions", () => {
  assert.equal(resolveFounderOfferAvailability(activeFounding100).remaining, 93);

  assert.throws(
    () => resolveFounderOfferAvailability(null),
    /Founder promotion code is unavailable/
  );
  assert.throws(
    () => resolveFounderOfferAvailability({ ...activeFounding100, active: false }),
    /Founder promotion code is unavailable/
  );
  assert.throws(
    () => resolveFounderOfferAvailability({ ...activeFounding100, max_redemptions: null }),
    /missing a redemption limit/
  );
  assert.throws(
    () => resolveFounderOfferAvailability({ ...activeFounding100, times_redeemed: 100 }),
    /All Founder places have been claimed/
  );
});

test("configured coupon or promotion mismatches fail instead of applying a different discount", () => {
  assert.equal(
    resolveFounderOfferAvailability(activeFounding100, {
      configuredPromotionCodeId: "promo_founder_100"
    }).promotionCodeId,
    "promo_founder_100"
  );
  assert.equal(
    resolveFounderOfferAvailability(activeFounding100, {
      configuredCouponId: "promo_founder_100"
    }).promotionCodeId,
    "promo_founder_100"
  );

  assert.throws(
    () => resolveFounderOfferAvailability(activeFounding100, {
      configuredPromotionCodeId: "promo_other"
    }),
    /does not match FOUNDING100/
  );
  assert.throws(
    () => resolveFounderOfferAvailability(activeFounding100, {
      configuredCouponId: "coupon_direct_100_percent"
    }),
    /not a direct coupon/
  );
  assert.throws(
    () => resolveFounderOfferAvailability(activeFounding100, {
      configuredCouponId: "promo_other"
    }),
    /different promotion code/
  );
});

test("the checked FOUNDING100 promotion code is the one applied to checkout", () => {
  const availability = resolveFounderOfferAvailability(activeFounding100);
  const params = founderCheckoutDiscountParams(availability.promotionCodeId);

  assert.equal(params["discounts[0][promotion_code]"], "promo_founder_100");
  assert.equal(params.payment_method_collection, "if_required");
  assert.equal(params["expand[]"], "discounts.promotion_code");
  assert.equal(params["metadata[offer]"], "founder");
  assert.equal(params["metadata[expected_total]"], "0");
});

test("checkout inspection requires a zero total and the exact checked promotion code", () => {
  const validSession = {
    amount_total: 0,
    customer: "cus_test",
    subscription: "sub_test",
    metadata: { offer: "founder", founder_offer: "true", expected_total: "0" },
    discounts: [{ promotion_code: { id: "promo_founder_100" } }]
  };

  assert.equal(founderCheckoutSessionIsValid(validSession, "promo_founder_100"), true);
  assert.deepEqual([...checkoutSessionPromotionCodeIds(validSession)], ["promo_founder_100"]);
  assert.equal(founderCheckoutSessionIsValid({ ...validSession, amount_total: 900 }, "promo_founder_100"), false);
  assert.equal(founderCheckoutSessionIsValid({ ...validSession, discounts: [{ promotion_code: "promo_other" }] }, "promo_founder_100"), false);
  assert.equal(founderCheckoutSessionIsValid({ ...validSession, subscription: null }, "promo_founder_100"), false);
});

test("repeated and concurrent Founder attempts for one account are gated and released after failure", async () => {
  let now = 1_000;
  const gate = createFounderClaimGate(() => now);
  const first = gate.run("user_test", () => new Promise((resolve) => setTimeout(() => resolve("ok"), 20)));

  await assert.rejects(
    gate.run("user_test", async () => "duplicate"),
    /already being prepared/
  );

  assert.equal(await first, "ok");

  await assert.rejects(
    gate.run("user_test", async () => {
      throw new Error("Stripe checkout failed");
    }),
    /Stripe checkout failed/
  );

  assert.equal(await gate.run("user_test", async () => "retry-ok"), "retry-ok");

  now += 3 * 60 * 1000;
  assert.equal(await gate.run("user_test", async () => "after-expiry"), "after-expiry");
});

test("webhook qualification activates only valid £0 Founder checkouts", () => {
  const valid = {
    amount_total: 0,
    customer: "cus_test",
    subscription: "sub_test",
    metadata: { offer: "founder", founder_offer: "true", expected_total: "0" }
  };

  assert.equal(founderWebhookCheckoutQualifies(valid), true);
  assert.equal(founderWebhookCheckoutQualifies({ ...valid, amount_total: 1 }), false);
  assert.equal(founderWebhookCheckoutQualifies({ ...valid, metadata: { offer: "founder" } }), false);
  assert.equal(founderWebhookCheckoutQualifies({ ...valid, customer: null }), false);
});

test("Founder subscription retries and cancellations preserve lifetime entitlement state", () => {
  const metadata = { offer: "founder", founder_offer: "true", expected_total: "0" };

  assert.equal(founderSubscriptionMetadataQualifies(metadata), true);
  assert.deepEqual(
    founderSubscriptionEntitlementState({
      customer: "cus_test",
      subscription: "sub_test",
      sessionId: "cs_test"
    }),
    {
      plan: "founder",
      status: "active",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      stripeCheckoutSessionId: "cs_test",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      entitlementSource: "founder_offer",
      amountPaid: 0
    }
  );
});
