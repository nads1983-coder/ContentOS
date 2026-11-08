import "server-only";
import { assertLifetimeCapacity } from "@/lib/paid-lifetime-capacity";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";

export type PaidLifetimeReservation = {
  id: string;
  userId: string;
  pricePence: number;
  earlyBirdSlot: number | null;
  attemptKey: string;
  status: string;
  stripeCheckoutSessionId: string | null;
  stripeCheckoutUrl: string | null;
  createdAt: string;
};

type ReservationRow = {
  id: string;
  user_id: string;
  price_pence: number;
  early_bird_slot: number | null;
  attempt_key: string;
  status: string;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  created_at: string | Date;
};

function mapReservation(row: ReservationRow): PaidLifetimeReservation {
  return {
    id: row.id,
    userId: row.user_id,
    pricePence: row.price_pence,
    earlyBirdSlot: row.early_bird_slot,
    attemptKey: row.attempt_key,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripeCheckoutUrl: row.stripe_checkout_url,
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function getPaidLifetimeReservation(purchaseId: string) {
  const row = (await getPool().query<ReservationRow>(
    `SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id=$1`, [purchaseId]
  )).rows[0];
  return row ? mapReservation(row) : null;
}

export async function recordPaidLifetimeCheckoutSession(purchaseId: string, sessionId: string, url: string, expiresAt: string) {
  const row = (await getPool().query<ReservationRow>(
    `UPDATE contentos_app.paid_creator_lifetime_purchases
     SET status='open',stripe_checkout_session_id=$2,stripe_checkout_url=$3,
         expires_at=$4,updated_at=now()
     WHERE id=$1 AND status IN ('preparing','open')
       AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=$2)
     RETURNING *`, [purchaseId,sessionId,url,expiresAt]
  )).rows[0];
  if (!row) throw new Error("Checkout reservation could not be recorded.");
  return mapReservation(row);
}

/** Caller must prove Stripe session is terminal (or that no POST was attempted). */
export async function terminatePaidLifetimeReservation(purchaseId: string, status: "expired" | "canceled" | "invalid" | "failed") {
  const row = (await getPool().query<ReservationRow>(
    `UPDATE contentos_app.paid_creator_lifetime_purchases
     SET status=$2,updated_at=now()
     WHERE id=$1 AND (status IN ('preparing','open') OR status=$2) RETURNING *`, [purchaseId,status]
  )).rows[0];
  if (!row) throw new Error("Checkout reservation may have been completed or reversed.");
  return mapReservation(row);
}

/**
 * Creates a reserved price without calling Stripe. A single advisory lock
 * serializes simultaneous requests for all 25 early-bird slots. Checkout
 * capacity is checked inside the same allocation transaction.
 * Never expire an open attempt without first verifying Stripe's state.
 */
export async function reservePaidLifetimePurchase(userId: string, email: string): Promise<PaidLifetimeReservation> {
  if (!userId || !email.trim()) throw new Error("Authenticated account required.");
  if (!PAID_LIFETIME_OFFER.checkoutEnabled) {
    throw new Error("Paid lifetime reservations are not open.");
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1949019031)");
    const profile = (await client.query<{data:{subscription_status?:string;stripe_subscription_id?:string}}>(
      "SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[userId])).rows[0];
    if (!profile) throw new Error("Account profile is missing.");
    if (profile.data.stripe_subscription_id && ["active","trialing","past_due","incomplete"].includes(profile.data.subscription_status ?? "")) {
      throw new Error("Resolve the existing subscription before purchasing lifetime access.");
    }
    const previous = await client.query<ReservationRow>(
      `SELECT * FROM contentos_app.paid_creator_lifetime_purchases
       WHERE user_id=$1 AND status IN ('preparing','open','completed','refunded','disputed','review')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId]
    );
    if (previous.rows[0]) {
      if (!['preparing', 'open'].includes(previous.rows[0].status)) {
        throw new Error("This account has already purchased lifetime access.");
      }
      await client.query("COMMIT");
      return mapReservation(previous.rows[0]);
    }
    const recurring = await client.query("SELECT 1 FROM contentos_app.lifetime_recurring_checkout_guards WHERE user_id=$1",[userId]);
    if (recurring.rowCount) throw new Error("An existing subscription checkout requires reconciliation.");
    const commitments = await client.query<{ count: string }>(
      `SELECT count(*) FROM contentos_app.paid_creator_lifetime_purchases
       WHERE status IN ('preparing','open','completed','review','disputed')`
    );
    assertLifetimeCapacity(Number(commitments.rows[0].count));
    const occupied = await client.query<{ early_bird_slot: number }>(
      `SELECT early_bird_slot FROM contentos_app.paid_creator_lifetime_purchases
       WHERE status IN ('preparing','open','completed','refunded','disputed','review')
       AND early_bird_slot IS NOT NULL ORDER BY early_bird_slot`
    );
    const occupiedSlots = new Set(occupied.rows.map(row => row.early_bird_slot));
    let slot: number | null = null;
    for (let number = 1; number <= PAID_LIFETIME_OFFER.earlyBirdPlaces; number += 1) {
      if (!occupiedSlots.has(number)) { slot = number; break; }
    }
    if (slot === null) {
      const sales = await client.query<{count:string}>(`SELECT count(*) FROM contentos_app.paid_creator_lifetime_purchases
        WHERE early_bird_slot IS NOT NULL AND status IN ('completed','refunded','disputed','review')`);
      if (Number(sales.rows[0].count) < PAID_LIFETIME_OFFER.earlyBirdPlaces) {
        throw new Error("Early-bird places are temporarily held by pending payments. Please try again after they settle or expire.");
      }
    }
    const price = slot === null
      ? PAID_LIFETIME_OFFER.standardPricePence
      : PAID_LIFETIME_OFFER.earlyBirdPricePence;
    const record = await client.query<ReservationRow>(
      `INSERT INTO contentos_app.paid_creator_lifetime_purchases
       (id,user_id,email,offer_code,status,price_pence,early_bird_slot,attempt_key)
       VALUES ($1,$2,$3,$4,'preparing',$5,$6,$7) RETURNING *`,
      [randomUUID(),userId,email.trim().toLowerCase(),PAID_LIFETIME_OFFER.code,
        price,slot,`lifetime:${userId}:${randomUUID()}`]
    );
    await client.query("COMMIT");
    return mapReservation(record.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
