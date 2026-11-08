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
  line_items?: { data?: Array<{
    quantity?: number;
    amount_total?: number;
    price?: { currency?: string; unit_amount?: number | null; type?: string; recurring?: unknown };
  }> };
  total_details?: { amount_discount?: number | null };
};

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
    item?.length === 1 && item[0]?.quantity === 1 &&
    item[0]?.amount_total === claim.pricePence &&
    item[0]?.price?.currency === PAID_LIFETIME_OFFER.currency &&
    item[0]?.price?.unit_amount === claim.pricePence &&
    item[0]?.price?.type === "one_time" && !item[0]?.price?.recurring
  );
}
