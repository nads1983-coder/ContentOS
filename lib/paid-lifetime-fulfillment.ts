import "server-only";
import { getPool } from "@/lib/db/client";
import type { PoolClient } from "pg";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { validatePaidLifetimeCheckout, validateLifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import type { LifetimeStripeSession, LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import type { UserProfile } from "@/types/saas";

type Reason = "refunded" | "disputed" | "review";
type Purchase = { id: string; user_id: string; price_pence: number; attempt_key: string;
  stripe_checkout_session_id: string | null; stripe_payment_intent_id: string | null; status: string };
async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await getPool().connect();
  try { await c.query("BEGIN"); await c.query("SELECT pg_advisory_xact_lock(1949019031)");
    const result = await fn(c); await c.query("COMMIT"); return result;
  } catch (error) { await c.query("ROLLBACK").catch(() => {}); throw error; }
  finally { c.release(); }
}
async function risk(c: PoolClient, intent: string): Promise<Reason | undefined> {
  return (await c.query<{ reason: Reason }>(`SELECT reason FROM contentos_app.paid_lifetime_payment_events
    WHERE payment_intent_id=$1 ORDER BY CASE reason WHEN 'refunded' THEN 0 WHEN 'disputed' THEN 1 ELSE 2 END LIMIT 1`,[intent])).rows[0]?.reason;
}
async function record(c: PoolClient, intent: string, reason: Reason, eventId: string, type: string) {
  await c.query(`INSERT INTO contentos_app.paid_lifetime_payment_events(event_id,payment_intent_id,reason,event_type)
    VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[eventId,intent,reason,type]);
}
async function revoke(c: PoolClient, row: Purchase, reason: Reason) {
  const p = (await c.query<{data: UserProfile}>("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[row.user_id])).rows[0];
  if (!p) throw new Error("Lifetime purchaser profile missing.");
  // Do not overwrite a different entitlement or recurring subscription.
  if (p.data.paid_creator_lifetime_purchase_id && p.data.paid_creator_lifetime_purchase_id !== row.id) throw new Error("Lifetime account conflict.");
  await c.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET status=$2,reversed_at=now(),updated_at=now() WHERE id=$1",[row.id,reason]);
  const next = {...p.data, paid_creator_lifetime_status: reason, paid_creator_lifetime_purchase_id: row.id};
  await c.query("UPDATE contentos_app.profiles SET data=$2::jsonb,updated_at=now() WHERE id=$1",[row.user_id,JSON.stringify(next)]);
}

// A partial refund requires review but does not, by itself, change existing
// access. A review recorded before activation must never grant access.
async function applyRisk(c: PoolClient, row: Purchase, reason: Reason) {
  if (reason === "review" && row.status === "completed") {
    const profile = (await c.query<{data:UserProfile}>(
      "SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[row.user_id])).rows[0];
    if (profile?.data.paid_creator_lifetime_status === "active" &&
        profile.data.paid_creator_lifetime_purchase_id === row.id) return {status:"review"};
  }
  await revoke(c,row,reason);
  return {status:"reversed"};
}

// Signed Stripe events are retained even before the purchase's PI is bound.
// The inbox and activation use the SAME lock. Terminal risk never auto-clears.
export async function reversePaidCreatorLifetimePurchase(intent: string, reason: Reason, eventId = `reconciliation:${intent}:${reason}`, type = "reconciliation") {
  if (!/^pi_[A-Za-z0-9_]+$/.test(intent)) throw new Error("Invalid payment intent.");
  return transaction(async c => {
    await record(c,intent,reason,eventId,type);
    const row = (await c.query<Purchase>("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE stripe_payment_intent_id=$1 FOR UPDATE",[intent])).rows[0];
    if (!row) return {status: "retained"};
    return applyRisk(c,row,(await risk(c,intent))!);
  });
}

export async function completePaidCreatorLifetimePurchase(purchaseId: string, session: LifetimeStripeSession, intent: LifetimePaymentIntent) {
  return transaction(async c => {
    const row = (await c.query<Purchase>("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id=$1 FOR UPDATE",[purchaseId])).rows[0];
    if (!row || !validatePaidLifetimeCheckout(session,{id:row.id,userId:row.user_id,attemptKey:row.attempt_key,pricePence:row.price_pence,stripeCheckoutSessionId:row.stripe_checkout_session_id})) throw new Error("Unverified lifetime session.");
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intentId || intent.id !== intentId || intent.amount !== row.price_pence || intent.currency !== "gbp") throw new Error("Payment identity mismatch.");
    if (row.stripe_payment_intent_id && row.stripe_payment_intent_id !== intentId) throw new Error("Payment binding conflict.");
    await c.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET stripe_payment_intent_id=$2,stripe_customer_id=$3 WHERE id=$1",[row.id,intentId,session.customer]);
    const charge = intent.latest_charge;
    const observed: Reason | undefined = charge?.refunded ? "refunded" : charge?.disputed ? "disputed" : (charge?.amount_refunded ?? 0) > 0 ? "review" : undefined;
    if (observed) await record(c,intentId,observed,`snapshot:${intentId}:${observed}`,"payment_snapshot");
    const blocked = await risk(c,intentId);
    if (blocked) return applyRisk(c,row,blocked);
    if (["refunded","disputed","review"].includes(row.status)) return {status:"reversed"};
    if (!validateLifetimePaymentIntent(intent,session,row.price_pence)) throw new Error("Unverified lifetime payment.");
    const p = (await c.query<{data:UserProfile}>("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[row.user_id])).rows[0];
    if (!p) throw new Error("Lifetime purchaser profile missing.");
    if (row.status === "completed") {
      if (p.data.paid_creator_lifetime_status !== "active" || p.data.paid_creator_lifetime_purchase_id !== row.id) throw new Error("Lifetime reconciliation required.");
      return {status:"replay"};
    }
    if (!["preparing","open"].includes(row.status) || hasLifetimeEntitlement(p.data) || p.data.paid_creator_lifetime_purchase_id) throw new Error("Lifetime activation conflict.");
    if (["active","trialing","past_due","incomplete"].includes(p.data.subscription_status) && p.data.stripe_subscription_id) {
      await record(c,intentId,"review",`subscription-conflict:${intentId}`,"subscription_conflict");
      await revoke(c,row,"review"); return {status:"review"};
    }
    const next = {...p.data,paid_creator_lifetime_status:"active",paid_creator_lifetime_purchase_id:row.id,
      stripe_customer_id:p.data.stripe_customer_id || session.customer,updated_at:new Date().toISOString()};
    await c.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1",[row.id]);
    await c.query("UPDATE contentos_app.profiles SET data=$2::jsonb,updated_at=now() WHERE id=$1",[row.user_id,JSON.stringify(next)]);
    return {status:"activated"};
  });
}
