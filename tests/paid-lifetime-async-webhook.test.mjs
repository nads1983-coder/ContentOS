import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const metadata = { offer: "creator_lifetime_2026", purchase_id: "purchase123", user_id: "user123", attempt_key: "lifetime:one" };
const session = {
  id: "cs_test_abc", status: "complete", mode: "payment", payment_status: "unpaid",
  currency: "gbp", amount_total: 9900, amount_subtotal: 9900,
  total_details: { amount_discount: 0 }, client_reference_id: "user123", metadata,
  line_items: { has_more: false, data: [{ quantity: 1, amount_total: 9900,
    price: { currency: "gbp", unit_amount: 9900, type: "one_time" } }] },
  payment_intent: "pi_test123", customer: "cus_test123"
};
const claim = {
  id: "purchase123", userId: "user123", attemptKey: "lifetime:one", pricePence: 9900,
  stripeCheckoutSessionId: "cs_test_abc"
};

function harness(overrides = {}) {
  const calls = [];
  const current = { ...session, ...overrides };
  const { POST } = loadTs("app/api/billing/webhook/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/paid-lifetime-offer": { PAID_LIFETIME_OFFER: { code: "creator_lifetime_2026", currency: "gbp", fulfillmentEnabled: true } },
    "@/lib/stripe-rest": {
      verifyStripeSignature: () => true,
      retrieveCheckoutSession: async () => current,
      retrievePaidLifetimePaymentIntent: async () => { calls.push("retrieveIntent"); return { id: "pi_test123",status:"requires_payment_method",amount_received:0 }; }
    },
    "@/lib/repository": { updateSubscriptionStatus: async () => { throw new Error("Unexpected subscription update"); } },
    "@/lib/founder-claim-repository": { founderClaimRepository: {} },
    "@/lib/founder-checkout-service": {},
    "@/lib/paid-lifetime-fulfillment": {
      completePaidCreatorLifetimePurchase: async () => { calls.push("activate"); },
      reversePaidCreatorLifetimePurchase: async () => { throw new Error("Unexpected reversal"); },
      isPaidCreatorLifetimePaymentIntent: async () => false
    },
    "@/lib/paid-lifetime-reservations": {
      getPaidLifetimeReservation: async () => claim,
      terminatePaidLifetimeReservation: async () => { calls.push("terminate"); }
    }
  }, new Map(), { console: { log() {}, warn() {}, error() {} } });
  const send = async type => POST(new Request("https://example.invalid/api/billing/webhook", {
    method: "POST", body: JSON.stringify({ type, data: { object: { id: current.id, metadata } } })
  }));
  return { calls, send };
}

test("a completed but unpaid lifetime session stays pending without granting access", async () => {
  const h = harness();
  const response = await h.send("checkout.session.completed");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).pending, true);
  assert.deepEqual(h.calls, []);
});

test("a subsequent asynchronous payment success activates through verified Stripe retrieval", async () => {
  const h = harness({ payment_status: "paid" });
  const response = await h.send("checkout.session.async_payment_succeeded");
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ["retrieveIntent", "activate"]);
});

test("an asynchronous failure releases only a matching unpaid reservation", async () => {
  const h = harness();
  assert.equal((await h.send("checkout.session.async_payment_failed")).status, 200);
  assert.deepEqual(h.calls, ["retrieveIntent", "terminate"]);
  const invalid = harness({ amount_total: 14900 });
  assert.equal((await invalid.send("checkout.session.async_payment_failed")).status, 503);
  assert.deepEqual(invalid.calls, []);
});
