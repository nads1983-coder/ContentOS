import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const { buildLifetimeCheckoutParams, validatePaidLifetimeCheckout, validateLifetimePaymentIntent, validateFailedPaidLifetimeCheckout } = loadTs("lib/paid-lifetime-stripe.ts");
const claim = { id: "purchase123", userId: "user123", attemptKey: "lifetime:one", pricePence: 9900, stripeCheckoutSessionId: "cs_test_abc" };
const session = {
  id: "cs_test_abc", mode: "payment", status: "complete", payment_status: "paid",
  currency: "gbp", amount_total: 9900, amount_subtotal: 9900,
  total_details: { amount_discount: 0 }, client_reference_id: "user123",
  customer: "cus_123", payment_intent: "pi_123",
  metadata: { offer: "creator_lifetime_2026", user_id: "user123", purchase_id: "purchase123", attempt_key: "lifetime:one" },
  line_items: { data: [{ quantity: 1, amount_total: 9900, price: { currency: "gbp", unit_amount: 9900, type: "one_time" } }] }
};

test("lifetime Checkout has exactly one payment-mode item and account-bound metadata", () => {
  const body = buildLifetimeCheckoutParams(claim, "https://example.com/success", "https://example.com/cancel");
  assert.equal(body.get("mode"), "payment");
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "9900");
  assert.equal(body.get("metadata[attempt_key]"), claim.attemptKey);
  assert.equal(body.get("allow_promotion_codes"), null);
  assert.equal(body.get("subscription_data[metadata][offer]"), null);
  assert.equal(body.get("payment_method_types[0]"), null, "Stripe selects eligible payment methods dynamically");
});

test("asynchronous failure releases only the matching unpaid one-time checkout", () => {
  const failed = { ...session, payment_status: "unpaid", line_items: { ...session.line_items, has_more: false } };
  assert.equal(validateFailedPaidLifetimeCheckout(failed, claim), true);
  for (const patch of [
    { payment_status: "paid" }, { status: "open" }, { amount_total: 14900 },
    { client_reference_id: "other" }, { metadata: { ...session.metadata, attempt_key: "other" } },
    { line_items: { data: [] } }
  ]) assert.equal(validateFailedPaidLifetimeCheckout({ ...failed, ...patch }, claim), false);
});

test("only fully paid, exact-amount account-bound one-time sessions qualify", () => {
  assert.equal(validatePaidLifetimeCheckout(session, claim), true);
  assert.equal(validatePaidLifetimeCheckout(session, { ...claim, stripeCheckoutSessionId: "cs_other" }), false);
  const alterations = [
    { status: "open" }, { payment_status: "unpaid" }, { mode: "subscription" },
    { amount_total: 0 }, { amount_subtotal: 14900 }, { currency: "usd" },
    { client_reference_id: "attacker" }, { customer: null }, { payment_intent: null },
    { metadata: { ...session.metadata, purchase_id: "other" } },
    { metadata: { ...session.metadata, offer: "founder" } },
    { total_details: { amount_discount: 500 } },
    { line_items: { data: [] } },
    { line_items: { ...session.line_items, has_more: true } },
    { line_items: { data: [{ ...session.line_items.data[0], quantity: 2 }] } },
    { line_items: { data: [{ ...session.line_items.data[0], price: { ...session.line_items.data[0].price, recurring: { interval: "month" } } }] } }
  ];
  for (const altered of alterations) assert.equal(validatePaidLifetimeCheckout({ ...session, ...altered }, claim), false, JSON.stringify(altered));
});

test("later refunds, disputes, partial payments and charge mismatches block activation", () => {
  const charge = { id: "ch_123", paid: true, refunded: false, disputed: false, amount_refunded: 0 };
  const intent = { id: "pi_123", status: "succeeded", currency: "gbp", amount: 9900,
    amount_received: 9900, latest_charge: charge };
  assert.equal(validateLifetimePaymentIntent(intent,session,9900),true);
  for (const changed of [
    { status: "requires_payment_method" }, { currency: "usd" },
    { amount_received: 4900 }, { id: "pi_other" },
    { latest_charge: { ...charge, refunded: true } },
    { latest_charge: { ...charge, disputed: true } },
    { latest_charge: { ...charge, amount_refunded: 500 } },
    { latest_charge: null }
  ]) assert.equal(validateLifetimePaymentIntent({ ...intent,...changed },session,9900),false,JSON.stringify(changed));
});
