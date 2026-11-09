import "server-only";
import { getPool } from "@/lib/db/client";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { validatePaidLifetimeCheckout, validateLifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import type { LifetimeStripeSession, LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import type { UserProfile } from "@/types/saas";
import { retrieveCheckoutSession, retrievePaidLifetimePaymentIntent, retrieveLifetimeDisputes } from "@/lib/stripe-rest";

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
async function decisionRevision(client: Pick<PoolClient,"query">, purchaseId:string) {
  const result=await client.query<{count:string}>("SELECT count(*)::text AS count FROM contentos_app.paid_lifetime_adjudications WHERE purchase_id=$1",[purchaseId]);
  return result.rows[0].count;
}
/** Read before fetching Stripe. A concurrent administrator decision invalidates
 * the earlier provider snapshot and forces the caller to fetch it again. */
export async function getLifetimeDecisionRevision(purchaseId:string) {
  const client=await getPool().connect();
  try {return await decisionRevision(client,purchaseId);} finally {client.release();}
}
async function risk(c: PoolClient, intent: string): Promise<Reason | undefined> {
  return (await c.query<{ reason: Reason }>(`SELECT reason FROM contentos_app.paid_lifetime_payment_events e
    WHERE payment_intent_id=$1 AND (reason='refunded' OR NOT EXISTS (
      SELECT 1 FROM contentos_app.paid_lifetime_adjudications a
      WHERE a.payment_intent_id=e.payment_intent_id AND e.event_id=ANY(a.covered_event_ids)))
    ORDER BY CASE reason WHEN 'refunded' THEN 0 WHEN 'disputed' THEN 1 ELSE 2 END LIMIT 1`,[intent])).rows[0]?.reason;
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
    const unresolved = await risk(c,intent);
    if (!unresolved) return {status:"already_reviewed"};
    return applyRisk(c,row,unresolved);
  });
}

/** Administrator approval is explicit and covers only already-recorded events.
 * Any later reversal remains actionable, including unknown delayed events. */
export async function approveLifetimeReinstatement(purchaseId:string, administrator:{id:string;email:string}, reason:string) {
  const trimmed = reason.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseId) ||
      !administrator.id || !administrator.email || trimmed.length<10 || trimmed.length>500) throw new Error("Invalid review request.");
  const pool=getPool();
  const initial=(await pool.query<Purchase>("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id=$1",[purchaseId])).rows[0];
  if (!initial?.stripe_payment_intent_id || !initial.stripe_checkout_session_id || !["disputed","review"].includes(initial.status)) throw new Error("Purchase is not eligible for review.");
  const intentId=initial.stripe_payment_intent_id;
  const events=(await pool.query<{event_id:string;reason:Reason;event_type:string}>("SELECT event_id,reason,event_type FROM contentos_app.paid_lifetime_payment_events WHERE payment_intent_id=$1 ORDER BY event_id",[intentId])).rows;
  if (!events.length || events.some(e=>e.reason==="refunded" || e.reason==="review" && !["charge.refunded","payment_snapshot"].includes(e.event_type))) throw new Error("Purchase requires separate refund or conflict review.");
  const session=await retrieveCheckoutSession(initial.stripe_checkout_session_id);
  const intent=await retrievePaidLifetimePaymentIntent(intentId);
  const charge=intent.latest_charge;
  if (!validatePaidLifetimeCheckout(session,{id:initial.id,userId:initial.user_id,attemptKey:initial.attempt_key,pricePence:initial.price_pence,stripeCheckoutSessionId:initial.stripe_checkout_session_id}) ||
      intent.id!==intentId || intent.status!=="succeeded" || intent.currency!=="gbp" || intent.amount!==initial.price_pence ||
      intent.amount_received!==initial.price_pence || !charge?.id?.startsWith("ch_") || charge.paid!==true ||
      charge.refunded!==false || charge.disputed!==false || !Number.isSafeInteger(charge.amount_refunded) ||
      charge.amount_refunded!<0 || charge.amount_refunded!>=initial.price_pence) throw new Error("Payment cannot be verified for reinstatement.");
  const chargeId=intent.latest_charge!.id!;
  const disputes=await retrieveLifetimeDisputes(intentId);
  if (events.some(e=>e.reason==="disputed") && !disputes.length ||
      events.some(e=>e.reason==="review") && charge.amount_refunded===0 ||
      disputes.some(d=>d.status!=="won" || d.payment_intent!==intentId || d.charge!==chargeId || !d.id?.startsWith("du_"))) throw new Error("All disputes must be won and match this payment.");
  return transaction(async c=>{
    const current=(await c.query<Purchase>("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id=$1 FOR UPDATE",[purchaseId])).rows[0];
    if (!current || current.stripe_payment_intent_id!==intentId || current.stripe_checkout_session_id!==initial.stripe_checkout_session_id ||
        current.user_id!==initial.user_id || current.price_pence!==initial.price_pence || !["disputed","review"].includes(current.status)) throw new Error("Purchase changed during review.");
    const fresh=(await c.query<{event_id:string;reason:Reason;event_type:string}>("SELECT event_id,reason,event_type FROM contentos_app.paid_lifetime_payment_events WHERE payment_intent_id=$1 ORDER BY event_id",[intentId])).rows;
    if (JSON.stringify(fresh)!==JSON.stringify(events)) throw new Error("New payment evidence arrived during review.");
    const profile=(await c.query<{data:UserProfile}>("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[current.user_id])).rows[0];
    if (!profile || profile.data.paid_creator_lifetime_purchase_id!==current.id) throw new Error("Account requires reconciliation.");
    if (profile.data.stripe_subscription_id && ["active","trialing","past_due","incomplete"].includes(profile.data.subscription_status) && profile.data.plan!=="pro_studio") throw new Error("Resolve the existing subscription before reinstatement.");
    const id=randomUUID();
    await c.query(`INSERT INTO contentos_app.paid_lifetime_adjudications
      (id,purchase_id,payment_intent_id,administrator_id,administrator_email,reason,dispute_ids,covered_event_ids,stripe_charge_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,current.id,intentId,administrator.id,administrator.email.toLowerCase(),trimmed,disputes.map(d=>d.id),fresh.map(e=>e.event_id),chargeId]);
    await c.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET status='completed',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=$1",[current.id]);
    await c.query("UPDATE contentos_app.profiles SET data=$2::jsonb,updated_at=now() WHERE id=$1",[current.user_id,JSON.stringify({...profile.data,paid_creator_lifetime_status:"active"})]);
    return {status:"reinstated",decisionId:id};
  });
}

export async function completePaidCreatorLifetimePurchase(purchaseId: string, session: LifetimeStripeSession, intent: LifetimePaymentIntent, observedRevision?:string) {
  return transaction(async c => {
    const row = (await c.query<Purchase>("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id=$1 FOR UPDATE",[purchaseId])).rows[0];
    if (!row || !validatePaidLifetimeCheckout(session,{id:row.id,userId:row.user_id,attemptKey:row.attempt_key,pricePence:row.price_pence,stripeCheckoutSessionId:row.stripe_checkout_session_id})) throw new Error("Unverified lifetime session.");
    if (observedRevision !== undefined && observedRevision !== await decisionRevision(c,purchaseId)) return {status:"stale_snapshot"};
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intentId || intent.id !== intentId || intent.amount !== row.price_pence || intent.currency !== "gbp") throw new Error("Payment identity mismatch.");
    if (row.stripe_payment_intent_id && row.stripe_payment_intent_id !== intentId) throw new Error("Payment binding conflict.");
    await c.query("UPDATE contentos_app.paid_creator_lifetime_purchases SET stripe_payment_intent_id=$2,stripe_customer_id=$3 WHERE id=$1",[row.id,intentId,session.customer]);
    const charge = intent.latest_charge;
    const observed: Reason | undefined = charge?.refunded ? "refunded" : charge?.disputed ? "disputed" : (charge?.amount_refunded ?? 0) > 0 ? "review" : undefined;
    if (observed) {
      // Each live disputed observation is fresh evidence; a previous approval
      // must not mask a later dispute. Partial refunds have cumulative amounts.
      const suffix = observed === "disputed" ? randomUUID() : observed === "review" ? String(charge?.amount_refunded) : "terminal";
      await record(c,intentId,observed,`snapshot:${intentId}:${observed}:${suffix}`,"payment_snapshot");
    }
    const blocked = await risk(c,intentId);
    if (blocked) return applyRisk(c,row,blocked);
    if (["refunded","disputed","review"].includes(row.status)) return {status:"reversed"};
    if (!validateLifetimePaymentIntent(intent,session,row.price_pence)) {
      const approvedPartial = row.status === "completed" && validateLifetimePaymentIntent(intent,session,row.price_pence,true) &&
        Boolean((await c.query("SELECT 1 FROM contentos_app.paid_lifetime_adjudications WHERE purchase_id=$1 AND payment_intent_id=$2 LIMIT 1",[row.id,intentId])).rowCount);
      if (!approvedPartial) throw new Error("Unverified lifetime payment.");
    }
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
