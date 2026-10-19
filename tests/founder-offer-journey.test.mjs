import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as founderOfferModule from "../lib/founder-offer.ts";

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
  assert.equal(
    founderCompletedCheckoutSessionQualifies(
      { ...valid, client_reference_id: "other_user", metadata: { ...valid.metadata, user_id: "user_test" } },
      "promo_founder_100",
      "user_test"
    ),
    false
  );
  assert.equal(
    founderCompletedCheckoutSessionQualifies(
      { ...valid, client_reference_id: null, metadata: { ...valid.metadata, user_id: undefined } },
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
      if (options.noProfileUpdated) {
        throw new Error("Founder entitlement profile update did not match an account.");
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

test("missing entitlement target remains retryable for Stripe webhooks", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");

  const failure = await captureError(() =>
    handleFounderCheckoutCompleted(
      { sessionId: "cs_1", userId: "user_test" },
      serviceDeps(repo, stripe, entitlements, { noProfileUpdated: true })
    )
  );

  assert.match(failure.message, /profile update did not match/);
  assert.equal(founderWebhookActivationStatus(failure), 500);
  assert.equal(repo.claims[0].status, "open");
  assert.equal(entitlements.length, 0);
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

test("terminal non-completed Founder claims cannot be activated later", async () => {
  const repo = createMemoryRepository();
  const stripe = createMockStripe();
  const entitlements = [];

  await startFounderCheckout(checkoutInput, serviceDeps(repo, stripe, entitlements));
  repo.claims[0].status = "invalid";
  stripe.retrieveCheckoutSession = async () => completedSession("cs_1");

  const failure = await captureError(() =>
    handleFounderCheckoutCompleted({ sessionId: "cs_1", userId: "user_test" }, serviceDeps(repo, stripe, entitlements))
  );

  assert.ok(failure instanceof FounderPermanentActivationError);
  assert.equal(founderWebhookActivationStatus(failure), 200);
  assert.equal(repo.claims[0].status, "invalid");
  assert.equal(entitlements.length, 0);
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

// Execute the production Stripe adapter with an isolated HTTP transport, not live Stripe.
function customerRecoveryTransport(options = {}) {
  const requests = [], sessions = new Map(), byKey = new Map();
  const env = { appUrl: "https://test.invalid", stripeSecretKey: "synthetic-not-a-key",
    stripeProCreatorPriceId: "price_creator_test", stripeProStudioPriceId: "price_studio_test",
    stripeFounderCouponId: options.configuredCouponId ?? "promo_founder_100" };
  const module = { exports: {} }, require = createRequire(import.meta.url);
  const code = ts.transpileModule(readFileSync(new URL("../lib/stripe-rest.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const fetch = async (url, init) => {
    const path = new URL(url).pathname, body = new URLSearchParams(init.body);
    requests.push({ path, method: init.method, body, key: init.headers["Idempotency-Key"] });
    if (path.startsWith("/v1/customers/")) {
      if (options.customerThrows) throw new Error("Synthetic connection failure");
      if (options.customerStatus) return Response.json({ error: { message: "Synthetic customer lookup refused" } }, { status: options.customerStatus });
      return Response.json(options.customer ?? { id: "cus_deleted_test", deleted: true });
    }
    if (path === "/v1/promotion_codes") return Response.json({ data: [{ ...activeFounding100,
      times_redeemed: options.exhausted ? 100 : 12 }] });
    if (path === "/v1/checkout/sessions" && init.method === "POST") {
      if (options.checkoutThrows) throw new Error("Synthetic uncertain checkout");
      if (body.get("customer") === "cus_deleted_test") {
        return Response.json({ error: { message: "No such customer: synthetic deleted reference" } }, { status: 400 });
      }
      const key = init.headers["Idempotency-Key"];
      if (byKey.has(key)) {
        assert.equal(byKey.get(key).body, body.toString(), "idempotency payload must stay stable");
        return Response.json(byKey.get(key).session);
      }
      const session = { ...openSession(`cs_recovered_${sessions.size + 1}`),
        ...(options.nonzero ? { amount_total: 100 } : {}),
        ...(options.wrongPromotion ? { discounts: [{ promotion_code: "promo_wrong" }] } : {}) };
      sessions.set(session.id, session); byKey.set(key, { body: body.toString(), session });
      return Response.json(session);
    }
    const id = path.split("/")[4];
    if (path.endsWith("/expire")) { sessions.get(id).status = "expired"; return Response.json(sessions.get(id)); }
    if (sessions.has(id)) return Response.json(sessions.get(id));
    throw new Error("Unexpected synthetic Stripe request");
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === "@/lib/env") return { getEnv: () => env, isStripeConfigured: () => true };
    if (name === "@/lib/founder-offer") return founderOfferModule;
    return require(name);
  }, fetch, URL, URLSearchParams, AbortSignal, Buffer, console: { error() {}, log() {} } });
  const api = module.exports;
  return { api, requests, sessions, stripe: {
    resolvePromotionCode: api.getFounderOfferAvailability,
    createCheckoutSession: i => api.createCheckoutSession({ plan: "pro_creator", userId: i.userId,
      email: i.email, stripeCustomerId: i.stripeCustomerId, founderOffer: true,
      founderPromotionCodeId: i.promotionCodeId, idempotencyKey: i.idempotencyKey }),
    retrieveCheckoutSession: api.retrieveCheckoutSession, expireCheckoutSession: api.expireCheckoutSession,
    scheduleCancellation: async () => { throw new Error("No live activation in this transport test"); }
  } };
}
const deletedCustomerInput = { ...checkoutInput, stripeCustomerId: "cus_deleted_test" };

test("deleted Stripe customer recovers to authenticated email with exact Founder discount and stable claim key", async () => {
  const t = customerRecoveryTransport(), repo = createMemoryRepository();
  const result = await startFounderCheckout(deletedCustomerInput, serviceDeps(repo, t.stripe));
  assert.ok(result.url);
  const post = t.requests.find(r => r.method === "POST");
  assert.equal(post.body.has("customer"), false);
  assert.equal(post.body.get("customer_email"), checkoutInput.email);
  assert.equal(post.body.get("client_reference_id"), checkoutInput.userId);
  assert.equal(post.body.get("metadata[user_id]"), checkoutInput.userId);
  assert.equal(post.body.get("discounts[0][promotion_code]"), "promo_founder_100");
  assert.equal(post.body.has("discounts[0][coupon]"), false);
  assert.equal(post.body.has("allow_promotion_codes"), false);
  assert.equal(post.key, repo.claims[0].attemptKey);
  assert.equal(repo.claims[0].status, "open");
  assert.equal(repo.claims[0].amountTotal, 0);
  const before = t.requests.length;
  await startFounderCheckout(deletedCustomerInput, serviceDeps(repo, t.stripe));
  assert.ok(t.requests.slice(before).every(r => r.method === "GET" && r.path.includes("checkout/sessions")));
  assert.equal(t.sessions.size, 1);
});

test("deleted-customer concurrency and crash recovery reuse one idempotent session", async () => {
  for (const crash of [false, true]) {
    const t = customerRecoveryTransport(), repo = createMemoryRepository({ saveOpenFailures: crash ? 1 : 0 });
    const run = () => startFounderCheckout(deletedCustomerInput, serviceDeps(repo, t.stripe));
    if (crash) await assert.rejects(run());
    await Promise.all([run(), run()]);
    assert.equal(repo.claims.length, 1);
    assert.equal(repo.claims[0].status, "open");
    assert.equal(t.sessions.size, 1);
    assert.equal(new Set(t.requests.filter(r => r.method === "POST").map(r => r.key)).size, 1);
  }
});

test("valid customers are retained and ordinary paid checkout behaviour is unchanged", async () => {
  const t = customerRecoveryTransport({ customer: { id: "cus_valid_test", email: checkoutInput.email } });
  await startFounderCheckout({ ...checkoutInput, stripeCustomerId: "cus_valid_test" }, serviceDeps(createMemoryRepository(), t.stripe));
  assert.equal(t.requests.find(r => r.method === "POST").body.get("customer"), "cus_valid_test");
  const paid = customerRecoveryTransport();
  await paid.api.createCheckoutSession({ plan: "pro_creator", stripeCustomerId: "cus_paid_test" });
  assert.equal(paid.requests.length, 1);
  assert.equal(paid.requests[0].body.get("customer"), "cus_paid_test");
  assert.equal(paid.requests[0].body.get("allow_promotion_codes"), "true");
});

test("customer lookup failures or mismatched identities never fall back or create Checkout", async () => {
  for (const opts of [{ customerThrows: true }, ...[401, 403, 404, 429, 500].map(customerStatus => ({ customerStatus })),
    { customer: { id: "cus_other_test", deleted: true } }]) {
    const t = customerRecoveryTransport(opts);
    await assert.rejects(startFounderCheckout(deletedCustomerInput, serviceDeps(createMemoryRepository(), t.stripe)));
    assert.equal(t.requests.filter(r => r.method === "POST").length, 0);
  }
});

test("deleted customer recovery requires authenticated account, email and coordinated claim key", async () => {
  for (const missing of ["userId", "email", "idempotencyKey"]) {
    const t = customerRecoveryTransport();
    await assert.rejects(t.api.createCheckoutSession({ plan: "pro_creator", founderOffer: true,
      founderPromotionCodeId: "promo_founder_100", stripeCustomerId: "cus_deleted_test",
      userId: "user_test", email: "test@example.invalid", idempotencyKey: "attempt_test", [missing]: "" }));
    assert.equal(t.requests.filter(r => r.method === "POST").length, 0);
  }
});

test("customer recovery does not bypass exhausted offers, configuration mismatch, existing Founder or paid access", async () => {
  for (const opts of [{ exhausted: true }, { configuredCouponId: "coupon_not_a_promotion" }]) {
    const t = customerRecoveryTransport(opts);
    await assert.rejects(startFounderCheckout(deletedCustomerInput, serviceDeps(createMemoryRepository(), t.stripe)));
    assert.equal(t.requests.filter(r => r.method === "POST").length, 0);
  }
  for (const gate of ["alreadyEntitled", "alreadyPaid"]) {
    const t = customerRecoveryTransport();
    await assert.rejects(startFounderCheckout({ ...deletedCustomerInput, [gate]: true }, serviceDeps(createMemoryRepository(), t.stripe)));
    assert.equal(t.requests.length, 0);
  }
});

test("wrong promotion or nonzero recovered sessions are refused and expired; uncertain POST never retries", async () => {
  for (const opts of [{ nonzero: true }, { wrongPromotion: true }, { checkoutThrows: true }]) {
    const t = customerRecoveryTransport(opts);
    await assert.rejects(startFounderCheckout(deletedCustomerInput, serviceDeps(createMemoryRepository(), t.stripe)));
    assert.equal(t.requests.filter(r => r.path === "/v1/checkout/sessions" && r.method === "POST").length, 1);
    if (!opts.checkoutThrows) assert.ok([...t.sessions.values()].every(s => s.status === "expired"));
  }
});
