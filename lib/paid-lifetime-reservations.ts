import "server-only";
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
};

type ReservationRow = {
  id: string;
  user_id: string;
  price_pence: number;
  early_bird_slot: number | null;
  attempt_key: string;
  status: string;
};

function mapReservation(row: ReservationRow): PaidLifetimeReservation {
  return {
    id: row.id,
    userId: row.user_id,
    pricePence: row.price_pence,
    earlyBirdSlot: row.early_bird_slot,
    attemptKey: row.attempt_key,
    status: row.status
  };
}

/**
 * Creates a reserved price without calling Stripe. A single advisory lock
 * serializes simultaneous requests for all 25 early-bird slots. Checkout
 * activation is deliberately not wired until all payment paths are reviewed.
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
    const previous = await client.query<ReservationRow>(
      `SELECT * FROM contentos_app.paid_creator_lifetime_purchases
       WHERE user_id=$1 AND status IN ('preparing','open','completed','refunded','disputed')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId]
    );
    if (previous.rows[0]) {
      if (!['preparing', 'open'].includes(previous.rows[0].status)) {
        throw new Error("This account has already purchased lifetime access.");
      }
      await client.query("COMMIT");
      return mapReservation(previous.rows[0]);
    }
    const occupied = await client.query<{ early_bird_slot: number }>(
      `SELECT early_bird_slot FROM contentos_app.paid_creator_lifetime_purchases
       WHERE status IN ('preparing','open','completed','refunded','disputed')
       AND early_bird_slot IS NOT NULL ORDER BY early_bird_slot`
    );
    const occupiedSlots = new Set(occupied.rows.map(row => row.early_bird_slot));
    let slot: number | null = null;
    for (let number = 1; number <= PAID_LIFETIME_OFFER.earlyBirdPlaces; number += 1) {
      if (!occupiedSlots.has(number)) { slot = number; break; }
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
