import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";

export type LifetimeCheckoutClaim = {
  id: string;
  userId: string;
  attemptKey: string;
  pricePence: number;
  stripeCheckoutSessionId?: string | null;
};

export type LifetimeStripeSession = {
  id?: string;
  url?: string | null;
  expires_at?: number | null;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
  currency?: string | null;
  amount_total?: number | null;
  amount_subtotal?: number | null;
  client_reference_id?: string | null;
  payment_intent?: string | { id: string } | null;
  customer?: string | null;
  metadata?: Record<string, string>;
  line_items?: { has_more?: boolean; data?: Array<{
    quantity?: number;
    amount_total?: number;
    price?: { currency?: string; unit_amount?: number | null; type?: string; recurring?: unknown };
  }> };
  total_details?: { amount_discount?: number | null };
};

export type LifetimePaymentIntent = {
  id?: string;
  status?: string;
  currency?: string;
  amount?: number;
  amount_received?: number;
  latest_charge?: {
    id?: string;
    paid?: boolean;
    refunded?: boolean;
    disputed?: boolean;
    amount_refunded?: number;
  } | null;
};

/** A paid Checkout session alone remains paid after some later reversals. */
export function validateLifetimePaymentIntent(intent: LifetimePaymentIntent, session: LifetimeStripeSession, pricePence: number, allowPartial = false) {
  const expectedId = typeof session.payment_intent === "string"
    ? session.payment_intent : session.payment_intent?.id;
  const charge = intent.latest_charge;
  return Boolean(expectedId && intent.id === expectedId && intent.status === "succeeded" &&
    intent.currency === PAID_LIFETIME_OFFER.currency && intent.amount === pricePence &&
    intent.amount_received === pricePence && charge?.id?.startsWith("ch_") &&
    charge.paid === true && charge.refunded === false && charge.disputed === false &&
    (charge.amount_refunded === 0 || allowPartial && Number.isSafeInteger(charge.amount_refunded) &&
      charge.amount_refunded! > 0 && charge.amount_refunded! < pricePence));
}

export function buildLifetimeCheckoutParams(claim: LifetimeCheckoutClaim, successUrl: string, cancelUrl: string) {
  if (!claim.userId || !claim.id || !claim.attemptKey ||
      claim.pricePence !== PAID_LIFETIME_OFFER.earlyBirdPricePence && claim.pricePence !== PAID_LIFETIME_OFFER.standardPricePence) {
    throw new Error("Invalid paid lifetime purchase reservation.");
  }
  return new URLSearchParams({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: claim.userId,
    "line_items[0][price_data][currency]": PAID_LIFETIME_OFFER.currency,
    "line_items[0][price_data][unit_amount]": String(claim.pricePence),
    "line_items[0][price_data][product_data][name]": "GetContentOS Creator Lifetime",
    "line_items[0][quantity]": "1",
    "metadata[offer]": PAID_LIFETIME_OFFER.code,
    "metadata[user_id]": claim.userId,
    "metadata[purchase_id]": claim.id,
    "metadata[attempt_key]": claim.attemptKey
  });
}

/** Verify a fresh server-retrieved Stripe session, never browser or webhook fields alone. */
export function validatePaidLifetimeCheckout(session: LifetimeStripeSession, claim: LifetimeCheckoutClaim): boolean {
  const item = session.line_items?.data;
  const intent = session.payment_intent;
  return Boolean(
    session.id && session.id.startsWith("cs_") &&
    session.id === claim.stripeCheckoutSessionId &&
    session.mode === "payment" && session.status === "complete" &&
    session.payment_status === "paid" &&
    session.currency === PAID_LIFETIME_OFFER.currency &&
    session.amount_total === claim.pricePence &&
    session.amount_subtotal === claim.pricePence &&
    session.total_details?.amount_discount === 0 &&
    session.client_reference_id === claim.userId &&
    session.metadata?.offer === PAID_LIFETIME_OFFER.code &&
    session.metadata?.user_id === claim.userId &&
    session.metadata?.purchase_id === claim.id &&
    session.metadata?.attempt_key === claim.attemptKey &&
    (typeof intent === "string" ? intent.startsWith("pi_") : Boolean(intent?.id?.startsWith("pi_"))) &&
    typeof session.customer === "string" && session.customer.startsWith("cus_") &&
    session.line_items?.has_more !== true && item?.length === 1 && item[0]?.quantity === 1 &&
    item[0]?.amount_total === claim.pricePence &&
    item[0]?.price?.currency === PAID_LIFETIME_OFFER.currency &&
    item[0]?.price?.unit_amount === claim.pricePence &&
    item[0]?.price?.type === "one_time" && !item[0]?.price?.recurring
  );
}

export function validateOpenPaidLifetimeCheckout(session: LifetimeStripeSession, claim: LifetimeCheckoutClaim) {
  const item = session.line_items?.data;
  return Boolean(session.id?.startsWith("cs_") && session.url?.startsWith("https://checkout.stripe.com/") &&
    session.mode === "payment" && session.status === "open" && session.payment_status === "unpaid" &&
    session.currency === PAID_LIFETIME_OFFER.currency && session.amount_total === claim.pricePence &&
    session.amount_subtotal === claim.pricePence && session.total_details?.amount_discount === 0 &&
    session.client_reference_id === claim.userId && session.metadata?.offer === PAID_LIFETIME_OFFER.code &&
    session.metadata?.user_id === claim.userId && session.metadata?.purchase_id === claim.id &&
    session.metadata?.attempt_key === claim.attemptKey && session.line_items?.has_more !== true &&
    item?.length === 1 && item[0]?.quantity === 1 && item[0]?.amount_total === claim.pricePence &&
    item[0]?.price?.currency === PAID_LIFETIME_OFFER.currency &&
    item[0]?.price?.unit_amount === claim.pricePence &&
    item[0]?.price?.type === "one_time" && !item[0]?.price?.recurring &&
    typeof session.expires_at === "number" && session.expires_at * 1000 > Date.now());
}

/** A signed async failure may release a slot only after a fresh, account-bound Stripe lookup. */
export function validateFailedPaidLifetimeCheckout(session: LifetimeStripeSession, claim: LifetimeCheckoutClaim) {
  const item = session.line_items?.data;
  return Boolean(session.id === claim.stripeCheckoutSessionId && session.status === "complete" &&
    session.payment_status === "unpaid" && session.mode === "payment" &&
    session.currency === PAID_LIFETIME_OFFER.currency &&
    session.amount_total === claim.pricePence && session.amount_subtotal === claim.pricePence &&
    session.total_details?.amount_discount === 0 &&
    session.client_reference_id === claim.userId &&
    session.metadata?.offer === PAID_LIFETIME_OFFER.code &&
    session.metadata?.purchase_id === claim.id && session.metadata?.user_id === claim.userId &&
    session.metadata?.attempt_key === claim.attemptKey &&
    session.line_items?.has_more === false && item?.length === 1 && item[0]?.quantity === 1 &&
    item[0]?.amount_total === claim.pricePence && item[0]?.price?.unit_amount === claim.pricePence &&
    item[0]?.price?.currency === PAID_LIFETIME_OFFER.currency &&
    item[0]?.price?.type === "one_time" && !item[0]?.price?.recurring);
}
