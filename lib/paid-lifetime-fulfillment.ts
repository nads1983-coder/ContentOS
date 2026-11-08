import "server-only";
import { getPool } from "@/lib/db/client";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { validatePaidLifetimeCheckout, validateLifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import type { LifetimeStripeSession } from "@/lib/paid-lifetime-stripe";
import type { LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import type { UserProfile } from "@/types/saas";

type Purchase = {
  id: string;
  user_id: string;
  price_pence: number;
  attempt_key: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: string;
};

function paymentIntentId(session: LifetimeStripeSession) {
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
}

export async function isPaidCreatorLifetimePaymentIntent(paymentIntent: string) {
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntent)) return false;
  const row = await getPool().query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM contentos_app.paid_creator_lifetime_purchases
      WHERE stripe_payment_intent_id=$1) AS exists`,[paymentIntent]
  );
  return row.rows[0]?.exists === true;
}

/**
 * The caller must freshly retrieve Stripe Checkout AND verify current refund,
 * dispute and charge state before calling this. No webhook route is wired yet.
 * Grant and purchase completion are in one transaction to withstand retries.
 */
export async function completePaidCreatorLifetimePurchase(purchaseId: string, session: LifetimeStripeSession, intent: LifetimePaymentIntent) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1949019031)");
    const row = (await client.query<Purchase>(
      `SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id=$1 FOR UPDATE`, [purchaseId]
    )).rows[0];
    if (!row || !validatePaidLifetimeCheckout(session, {
      id: row.id, userId: row.user_id, attemptKey: row.attempt_key,
      pricePence: row.price_pence, stripeCheckoutSessionId: row.stripe_checkout_session_id
    }) || !validateLifetimePaymentIntent(intent,session,row.price_pence)) {
      throw new Error("Completed lifetime payment could not be verified.");
    }
    const intentId = paymentIntentId(session);
    const profileRow = (await client.query<{ data: UserProfile }>(
      `SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE`, [row.user_id]
    )).rows[0];
    if (!profileRow) throw new Error("Lifetime purchaser profile was not found.");
    const profile = profileRow.data;
    if (row.status === "completed") {
      if (profile.paid_creator_lifetime_status !== "active" ||
          profile.paid_creator_lifetime_purchase_id !== row.id ||
          row.stripe_payment_intent_id !== intentId) throw new Error("Lifetime fulfillment reconciliation required.");
      await client.query("COMMIT");
      return { status: "replay" as const };
    }
    if (!['preparing', 'open'].includes(row.status) || hasLifetimeEntitlement(profile) ||
        profile.paid_creator_lifetime_purchase_id) throw new Error("Lifetime purchase cannot be activated.");
    const next = {
      ...profile, paid_creator_lifetime_status: "active",
      paid_creator_lifetime_purchase_id: row.id, updated_at: new Date().toISOString()
    };
    await client.query(`UPDATE contentos_app.paid_creator_lifetime_purchases
      SET status='completed',stripe_payment_intent_id=$2,stripe_customer_id=$3,
          completed_at=now(),updated_at=now() WHERE id=$1`, [row.id,intentId,session.customer]);
    await client.query(`UPDATE contentos_app.profiles SET data=$2::jsonb,updated_at=now() WHERE id=$1`,
      [row.user_id,JSON.stringify(next)]);
    await client.query("COMMIT");
    return { status: "activated" as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

/** Only invoke after independently verified full refund or active dispute. */
export async function reversePaidCreatorLifetimePurchase(paymentIntent: string, reason: "refunded" | "disputed") {
  if (!paymentIntent.startsWith("pi_")) throw new Error("Invalid payment intent.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1949019031)");
    const row = (await client.query<Purchase>(
      `SELECT * FROM contentos_app.paid_creator_lifetime_purchases
       WHERE stripe_payment_intent_id=$1 FOR UPDATE`, [paymentIntent]
    )).rows[0];
    if (!row) throw new Error("Lifetime payment reversal needs manual reconciliation.");
    if (row.status === reason) { await client.query("COMMIT"); return { status: "replay" as const }; }
    if (row.status !== "completed") throw new Error("Lifetime payment reversal requires manual reconciliation.");
    const profileRow = (await client.query<{ data: UserProfile }>(
      `SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE`,[row.user_id]
    )).rows[0];
    if (!profileRow || profileRow.data.paid_creator_lifetime_purchase_id !== row.id) {
      throw new Error("Lifetime reversal account mismatch.");
    }
    const next = { ...profileRow.data, paid_creator_lifetime_status: reason,
      updated_at: new Date().toISOString() };
    await client.query(`UPDATE contentos_app.paid_creator_lifetime_purchases
      SET status=$2,reversed_at=now(),updated_at=now() WHERE id=$1`,[row.id,reason]);
    await client.query(`UPDATE contentos_app.profiles SET data=$2::jsonb,updated_at=now() WHERE id=$1`,
      [row.user_id,JSON.stringify(next)]);
    await client.query("COMMIT");
    return { status: "reversed" as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
