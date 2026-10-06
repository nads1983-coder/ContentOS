import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticatedFounderDestination,
  checkoutSessionPromotionCodeIds,
  founderCheckoutDiscountParams,
  founderCompletedCheckoutSessionQualifies,
  founderOpenCheckoutSessionIsValid,
  founderClaimConflict,
  founderLoginCallbackUrl,
  founderSubscriptionEntitlementState,
  founderSubscriptionMetadataQualifies,
  resolveFounderOfferAvailability
} from "../lib/founder-offer.ts";
import {
  FounderPermanentActivationError,
  founderWebhookActivationStatus,
  handleFounderCheckoutCompleted,
  handleFounderSubscriptionEvent,
  startFounderCheckout
} from "../lib/founder-checkout-service.ts";

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

test("open checkout inspection allows null customer/subscription before completion", () => {
  const validSession = {
    id: "cs_open_valid",
    url: "https://checkout.test/open",
    amount_total: 0,
    mode: "subscription",
    status: "open",
    customer: null,
    subscription: null,
    metadata: { offer: "founder", founder_offer: "true", expected_total: "0" },
    discounts: [{ promotion_code: { id: "promo_founder_100" } }]
  };

  assert.equal(founderOpenCheckoutSessionIsValid(validSession, "promo_founder_100"), true);
  assert.deepEqual([...checkoutSessionPromotionCodeIds(validSession)], ["promo_founder_100"]);
  assert.equal(founderOpenCheckoutSessionIsValid({ ...validSession, amount_total: 900 }, "promo_founder_100"), false);
  assert.equal(founderOpenCheckoutSessionIsValid({ ...validSession, discounts: [{ promotion_code: "promo_other" }] }, "promo_founder_100"), false);
  assert.equal(founderOpenCheckoutSessionIsValid({ ...validSession, status: "complete" }, "promo_founder_100"), false);
});

test("completed checkout activation requires account association, customer and subscription", () => {
  const valid = completedSession();

  assert.equal(founderCompletedCheckoutSessionQualifies(valid, "promo_founder_100", "user_test"), true);
  assert.equal(
    founderCompletedCheckoutSessionQualifies(
      { ...valid, client_reference_id: "other_user", metadata: { ...valid.metadata, user_id: "other_user" } },
      "promo_founder_100",
      "user_test"
    ),
    false
  );
  assert.equal(founderCompletedCheckoutSessionQualifies({ ...valid, customer: null }, "promo_founder_100", "user_test"), false);
  assert.equal(founderCompletedCheckoutSessionQualifies({ ...valid, amount_total: 1 }, "promo_founder_100", "user_test"), false);
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

function openSession(id = "cs_open_valid") {
  return {
    id,
    url: `https://checkout.test/${id}`,
    amount_total: 0,
    mode: "subscription",
    status: "open",
    payment_status: "unpaid",
    client_reference_id: "user_test",
    customer: null,
    subscription: null,
    metadata: { offer: "founder", founder_offer: "true", expected_total: "0", user_id: "user_test" },
    discounts: [{ promotion_code: { id: "promo_founder_100" } }],
    expires_at: 1_900_000_000
  };
}

function completedSession(id = "cs_open_valid") {
  return {
    ...openSession(id),
    status: "complete",
    payment_status: "paid",
    customer: "cus_test",
    subscription: "sub_test"
  };
}

function createMemoryRepository(options = {}) {
  const claims = [];
  let saveOpenFailures = options.saveOpenFailures ?? 0;
  let completeClaimFailures = options.completeClaimFailures ?? 0;

  const active = (userId) =>
    claims.find((claim) => claim.userId === userId && ["preparing", "open"].includes(claim.status)) ?? null;

  return {
    claims,
    async getActiveClaim(userId) {
      return active(userId);
    },
    async reserveClaim(input) {
      const existing = active(input.userId);
      if (existing) return existing;
      const claim = {
        id: `claim_${claims.length + 1}`,
        userId: input.userId,
        email: input.email,
        status: "preparing",
        attemptKey: `attempt_${input.userId}_${claims.length + 1}`,
        promotionCodeId: input.promotionCodeId,
        stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        amountTotal: null,
        expiresAt: null
      };
      claims.push(claim);
      return claim;
    },
    async saveOpenSession(input) {
      if (saveOpenFailures > 0) {
        saveOpenFailures -= 1;
        throw new Error("simulated database crash after Stripe creation");
      }
      const claim = claims.find((item) => item.id === input.claimId);
      Object.assign(claim, {
        status: "open",
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripeCheckoutUrl: input.stripeCheckoutUrl,
        amountTotal: input.amountTotal,
        expiresAt: input.expiresAt
      });
      return claim;
    },
    async markTerminal(input) {
      const claim = claims.find((item) => item.id === input.claimId);
      Object.assign(claim, { status: input.status, error: input.error });
    },
    async findClaimBySession(sessionId) {
      return claims.find((claim) => claim.stripeCheckoutSessionId === sessionId) ?? null;
    },
    async findActiveClaimForUser(userId) {
      return active(userId);
    },
    async findCompletedClaimBySubscription(subscriptionId) {
      return claims.find((claim) => claim.status === "completed" && claim.stripeSubscriptionId === subscriptionId) ?? null;
    },
    async completeClaim(input) {
      if (completeClaimFailures > 0) {
        completeClaimFailures -= 1;
        throw new Error("simulated claim completion failure");
      }
      const claim = claims.find((item) => item.id === input.claimId);
      Object.assign(claim, {
        status: "completed",
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        amountTotal: input.amountTotal
      });
    }
  };
}

function createMockStripe(options = {}) {
  const sessionsByKey = new Map();
  const sessionsById = new Map();
  const stripe = {
    created: 0,
    expired: [],
    canceled: [],
    async resolvePromotionCode() {
      if (options.exhausted) throw new Error("All Founder places have been claimed.");
      return { promotionCodeId: "promo_founder_100" };
    },
    async createCheckoutSession(input) {
      stripe.created += 1;
      if (options.createFails) throw new Error("Stripe failed");
      if (sessionsByKey.has(input.idempotencyKey)) return sessionsByKey.get(input.idempotencyKey);
      const session = options.createSession?.(input, stripe.created) ?? openSession(`cs_${stripe.created}`);
      sessionsByKey.set(input.idempotencyKey, session);
      sessionsById.set(session.id, session);
      return session;
    },
    async retrieveCheckoutSession(sessionId) {
      const session = options.retrieveSession?.(sessionId, sessionsById.get(sessionId));
      return session ?? sessionsById.get(sessionId);
    },
    async expireCheckoutSession(sessionId) {
      stripe.expired.push(sessionId);
      const session = sessionsById.get(sessionId);
      if (session) session.status = "expired";
    },
    async scheduleCancellation(subscriptionId) {
      stripe.canceled.push(subscriptionId);
    }
  };
  return stripe;
}

function serviceDeps(repository, stripe, entitlements = [], options = {}) {
  const persistedSessions = new Set();
  return {
    repository,
    stripe,
    validateOpenSession: founderOpenCheckoutSessionIsValid,
    validateCompletedSession: founderCompletedCheckoutSessionQualifies,
    async persistFounderEntitlement(input) {
      if (options.persistFails) {
        throw new Error("simulated entitlement persistence failure");
      }
      if (options.idempotentPersist) {
        if (persistedSessions.has(input.sessionId)) return;
        persistedSessions.add(input.sessionId);
      }
      entitlements.push(input);
    }
  };
}

const checkoutInput = {
  userId: "user_test",
  email: "member@example.test",
  alreadyEntitled: false,
  alreadyPaid: false
};

async function captureError(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  assert.fail("Expected action to throw");
}

test("checkout orchestration returns a valid open £0 session with null customer/subscription", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();

  const result = await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe));

  assert.equal(result.url, "https://checkout.test/cs_1");
  assert.equal(repo.claims[0].status, "open");
  assert.equal(repo.claims[0].stripeCheckoutSessionId, "cs_1");
});

test("separate instances requesting concurrently share the persistent claim and Stripe idempotency key", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();

  const [first, second] = await Promise.all([
    startFounderCheckout(checkoutInput, serviceDeps(repo, stripe)),
    startFounderCheckout(checkoutInput, serviceDeps(repo, stripe))
  ]);

  assert.equal(first.url, second.url);
  assert.equal(repo.claims.length, 1);
  assert.equal(repo.claims[0].attemptKey, "attempt_user_test_1");
});

test("sequential requests reuse the same valid open session", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();

  const first = await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe));
  const second = await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe));

  assert.equal(first.url, second.url);
  assert.equal(stripe.created, 1);
});

test("crash recovery reuses Stripe idempotency after creation but before database persistence", async () => {
  const repo = createMemoryRepository({ saveOpenFailures: 1 });
  const stripe = createMockStripe();

  await assert.rejects(startFounderCheckout(checkoutInput, serviceDeps(repo, stripe)), /simulated database crash/);
  const recovered = await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe));

  assert.equal(recovered.url, "https://checkout.test/cs_1");
  assert.equal(repo.claims.length, 1);
  assert.equal(repo.claims[0].stripeCheckoutSessionId, "cs_1");
});

test("expired sessions become terminal and retry with a new logical attempt", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe({
    createSession: (_input, count) => count === 1
      ? { ...openSession("cs_expired"), status: "expired" }
      : openSession("cs_retry")
  });

  const retry = await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe));

  assert.equal(retry.url, "https://checkout.test/cs_retry");
  assert.equal(repo.claims[0].status, "expired");
  assert.equal(repo.claims[1].status, "open");
});

test("invalid discount or non-zero total is expired where possible and not converted to paid checkout", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe({
    createSession: () => ({ ...openSession("cs_bad"), amount_total: 900 })
  });

  await assert.rejects(startFounderCheckout(checkoutInput, serviceDeps(repo, stripe)), /could not be validated/);
  assert.deepEqual(stripe.expired, ["cs_bad"]);
  assert.equal(repo.claims[0].status, "invalid");
});

test("offer exhaustion and Stripe failures mark attempts safely", async () => {
  await assert.rejects(
    startFounderCheckout(checkoutInput, serviceDeps(createMemoryRepository(), createMockStripe({ exhausted: true }))),
    /All Founder places have been claimed/
  );

  const repo = createMemoryRepository();
  await assert.rejects(
    startFounderCheckout(checkoutInput, serviceDeps(repo, createMockStripe({ createFails: true }))),
    /Stripe failed/
  );
  assert.equal(repo.claims[0].status, "failed");
});

test("completed checkout activates Founder access with qualifying evidence", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");

  await handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe, entitlements));

  assert.equal(repo.claims[0].status, "completed");
  assert.deepEqual(stripe.canceled, ["sub_test"]);
  assert.equal(entitlements.length, 1);
  assert.equal(entitlements[0].subscriptionId, "sub_test");
});

test("permanently invalid completed checkout is acknowledged without entitlement", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  stripe.retrieveCheckoutSession = async () => ({ ...completedSession("cs_1"), amount_total: 900 });

  const failure = await captureError(() =>
    handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe, entitlements))
  );

  assert.ok(failure instanceof FounderPermanentActivationError);
  assert.equal(founderWebhookActivationStatus(failure), 200);
  assert.equal(repo.claims[0].status, "invalid");
  assert.equal(entitlements.length, 0);
  assert.equal(stripe.canceled.length, 0);
});

test("entitlement persistence failure remains retryable for Stripe webhooks", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");

  const failure = await captureError(() =>
    handleFounderCheckoutCompleted(
      { sessionId: "cs_1", userId: "user_test" },
      serviceDeps(repo, stripe, entitlements, { persistFails: true })
    )
  );

  assert.match(failure.message, /simulated entitlement persistence failure/);
  assert.equal(founderWebhookActivationStatus(failure), 500);
  assert.equal(repo.claims[0].status, "open");
  assert.equal(entitlements.length, 0);
  assert.equal(stripe.canceled.length, 0);
});

test("Stripe checkout retrieval failure remains retryable for Stripe webhooks", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe));
  stripe.retrieveCheckoutSession = async () => {
    throw new Error("simulated Stripe retrieval failure");
  };

  const failure = await captureError(() =>
    handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe))
  );

  assert.match(failure.message, /simulated Stripe retrieval failure/);
  assert.equal(founderWebhookActivationStatus(failure), 500);
  assert.equal(repo.claims[0].status, "open");
});

test("claim completion failure after entitlement persistence is safe on retry", async () => {
  const repo = createMemoryRepository({ completeClaimFailures: 1 });
  const stripe = createMockStripe();
  const entitlements = [];
  const deps = serviceDeps(repo, stripe, entitlements, { idempotentPersist: true });

  await startFounderCheckout(checkoutInput, deps);
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");

  const failure = await captureError(() =>
    handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, deps)
  );

  assert.match(failure.message, /simulated claim completion failure/);
  assert.equal(founderWebhookActivationStatus(failure), 500);
  assert.equal(repo.claims[0].status, "open");
  assert.equal(entitlements.length, 1);
  assert.equal(stripe.canceled.length, 0);

  await handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, deps);

  assert.equal(repo.claims[0].status, "completed");
  assert.equal(entitlements.length, 1);
  assert.deepEqual(stripe.canceled, ["sub_test"]);
});

test("duplicate or reordered webhook events are idempotent", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");

  await handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe, entitlements));
  await handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe, entitlements));

  assert.equal(entitlements.length, 1);
  assert.equal(stripe.canceled.length, 2);
});

test("subscription events before checkout confirmation do not newly grant Founder access", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  assert.equal(await handleFounderSubscriptionEvent({ subscriptionId: "sub_test" }, serviceDeps(repo, stripe, entitlements)), false);
  assert.equal(entitlements.length, 0);
});

test("lifetime access survives later subscription cancellation events after checkout confirmation", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");
  await handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe, entitlements));

  assert.equal(await handleFounderSubscriptionEvent({ subscriptionId: "sub_test" }, serviceDeps(repo, stripe, entitlements)), true);
  assert.equal(entitlements.length, 1);
});
