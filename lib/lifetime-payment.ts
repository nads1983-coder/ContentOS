import "server-only";
import { randomUUID } from "node:crypto";
import { commercialTransaction } from "@/lib/commercial-ledger";
import { COST_POLICY } from "@/lib/ai-cost";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { lifetimeAccess } from "@/lib/lifetime-access";

// Public sales remain disabled; signed fulfillment must still honor existing payments.
export type LifetimePrice = { id: string; active: boolean; currency: string; unit_amount: number; type: string; livemode: boolean };
export type LifetimeSession = {
  id: string; mode: string; status: string; payment_status: string; currency: string; amount_total: number;
  client_reference_id: string; metadata: { purchase: string; user_id: string; attempt_id: string };
  customer: string | null; subscription: null; url: string | null; expires_at: number; livemode: boolean;
  line_items: { data: { quantity: number; price: { id: string } }[]; has_more?: boolean };
  payment_intent: null | { id: string; status: string; amount_received: number; currency: string; customer: string;
    latest_charge: { id?: string; paid: boolean; refunded: boolean; amount_refunded: number; disputed: boolean } };
};
export type LifetimePaymentProvider = {
  price: () => Promise<LifetimePrice>;
  create: (input: { accountId: string; attemptId: string; priceId: string; idempotencyKey: string; customerId?: string; email: string }) => Promise<LifetimeSession>;
  retrieve: (id: string) => Promise<LifetimeSession>;
};
export class LifetimePaymentRejected extends Error {}
export type LifetimePaymentSnapshot = { accountId: string; attemptId: string; version: string };
async function assertCurrentSnapshot(c: import("pg").PoolClient, snapshot?: LifetimePaymentSnapshot) {
  if(snapshot && (await c.query("SELECT 1 FROM contentos_app.lifetime_purchases WHERE account_id=$1 AND attempt_id=$2 AND updated_at=$3::timestamptz FOR UPDATE",[snapshot.accountId,snapshot.attemptId,snapshot.version])).rowCount!==1) {
    throw new Error("Lifetime purchase changed during Stripe reconciliation; retry with fresh evidence.");
  }
}
function assertPrice(price: LifetimePrice, mustBeActive = true) {
  if (!price.id || (mustBeActive && !price.active) || price.type !== "one_time" || price.currency !== "gbp" || price.unit_amount !== 4900) throw new Error("Lifetime price configuration is invalid.");
}
export function validateLifetimeSessionIdentity(s: LifetimeSession, accountId: string, attemptId: string, price: LifetimePrice) {
  assertPrice(price, false);
  if (!s.id || s.mode !== "payment" || s.subscription !== null || s.livemode !== price.livemode || s.currency !== "gbp" || s.amount_total !== 4900 ||
      s.client_reference_id !== accountId || s.metadata?.user_id !== accountId || s.metadata?.attempt_id !== attemptId || s.metadata?.purchase !== "lifetime_access_v1" ||
      s.line_items?.has_more || s.line_items?.data?.length !== 1 || s.line_items.data[0].quantity !== 1 || s.line_items.data[0].price?.id !== price.id) throw new LifetimePaymentRejected("Lifetime checkout evidence does not match the account and price.");
}
export function validateLifetimeSession(s: LifetimeSession, accountId: string, attemptId: string, price: LifetimePrice, completed: boolean) {
  assertPrice(price, !completed);
  validateLifetimeSessionIdentity(s,accountId,attemptId,price);
  if (!completed) {
    if (s.status !== "open" || !s.url || new URL(s.url).origin !== "https://checkout.stripe.com" || s.expires_at * 1000 <= Date.now()) throw new LifetimePaymentRejected("Lifetime checkout is not open.");
    return;
  }
  const p=s.payment_intent, charge=p?.latest_charge;
  if (s.status !== "complete" || s.payment_status !== "paid" || !s.customer || !p?.id || p.status !== "succeeded" ||
      p.amount_received !== 4900 || p.currency !== "gbp" || p.customer !== s.customer || !charge?.paid || charge.refunded || charge.amount_refunded !== 0 || charge.disputed) throw new LifetimePaymentRejected("Lifetime payment is not eligible for fulfillment.");
}
export async function prepareLifetimePurchase(accountId: string, provider: LifetimePaymentProvider, admit?: (c: import("pg").PoolClient) => Promise<void>) {
  const price=await provider.price(); assertPrice(price);
  const attempt=await commercialTransaction(async c=>{
    const profile=(await c.query("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[accountId])).rows[0]?.data;
    if (!profile || hasLifetimeEntitlement(profile) || lifetimeAccess(profile) || (profile.plan !== "free" && ["active","trialing","past_due","incomplete"].includes(profile.subscription_status))) throw new LifetimePaymentRejected("Existing membership must be resolved before a Lifetime purchase. No subscription was changed.");
    const row=(await c.query("SELECT * FROM contentos_app.lifetime_purchases WHERE account_id=$1 FOR UPDATE",[accountId])).rows[0];
    if (row && !["expired","failed"].includes(row.state)) {
      if (!["creating","open"].includes(row.state)) throw new LifetimePaymentRejected("This account already has a Lifetime purchase record requiring review.");
      if (!row.checkout_session_id && Date.now()-Date.parse(row.created_at)>23*3600_000) throw new LifetimePaymentRejected("Uncertain checkout requires reconciliation before another attempt.");
      return {...row, customerId:profile.stripe_customer_id, email:profile.email};
    }
    await admit?.(c);
    const id=randomUUID();
    const created=(await c.query(`INSERT INTO contentos_app.lifetime_purchases(account_id,attempt_id,state)
      VALUES($1,$2,'creating') ON CONFLICT(account_id) DO UPDATE SET
      attempt_history=lifetime_purchases.attempt_history || jsonb_build_array(to_jsonb(lifetime_purchases)-'attempt_history'),
      attempt_id=$2,state='creating',checkout_session_id=null,checkout_url=null,expires_at=null,created_at=now(),updated_at=now()
      RETURNING *`,[accountId,id])).rows[0];
    return {...created, customerId:profile.stripe_customer_id, email:profile.email};
  });
  const session=attempt.checkout_session_id ? await provider.retrieve(attempt.checkout_session_id) : await provider.create({accountId,attemptId:attempt.attempt_id,priceId:price.id,idempotencyKey:`contentos-lifetime-${attempt.attempt_id}`,customerId:attempt.customerId,email:attempt.email});
  if (session.status === "expired" && attempt.checkout_session_id === session.id) {
    await commercialTransaction(c=>c.query("UPDATE contentos_app.lifetime_purchases SET state='expired',updated_at=now() WHERE account_id=$1 AND attempt_id=$2 AND state IN ('creating','open')",[accountId,attempt.attempt_id]));
    throw new LifetimePaymentRejected("Checkout expired. Start a new checkout explicitly.");
  }
  validateLifetimeSession(session,accountId,attempt.attempt_id,price,false);
  if(attempt.customerId && session.customer!==attempt.customerId) throw new LifetimePaymentRejected("Checkout customer does not match the account.");
  await commercialTransaction(async c=>{
    const update=await c.query("UPDATE contentos_app.lifetime_purchases SET state='open',checkout_session_id=$3,checkout_url=$4,expires_at=to_timestamp($5),updated_at=now() WHERE account_id=$1 AND attempt_id=$2 AND state IN ('creating','open')",[accountId,attempt.attempt_id,session.id,session.url,session.expires_at]);
    if(update.rowCount!==1) throw new LifetimePaymentRejected("Checkout state changed; do not start another payment.");
  });
  return {url:session.url};
}
export async function fulfillLifetimePurchase(eventId: string, sessionId: string, provider: LifetimePaymentProvider) {
  if(!eventId || !sessionId) throw new LifetimePaymentRejected("Missing payment evidence.");
  // Fresh current payment/charge evidence prevents reordered completion from undoing refunds.
  const price=await provider.price(), session=await provider.retrieve(sessionId);
  if(session.id!==sessionId) throw new LifetimePaymentRejected("Checkout identity mismatch.");
  validateLifetimeSession(session,session.client_reference_id,session.metadata?.attempt_id,price,true);
  return commercialTransaction(async c=>{
    const account=session.client_reference_id;
    const profile=(await c.query("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[account])).rows[0]?.data;
    const purchase=(await c.query("SELECT * FROM contentos_app.lifetime_purchases WHERE account_id=$1 FOR UPDATE",[account])).rows[0];
    if(!profile || !purchase || purchase.attempt_id!==session.metadata.attempt_id || (purchase.checkout_session_id && purchase.checkout_session_id!==sessionId) ||
      !["creating","open","paid"].includes(purchase.state) || (profile.stripe_customer_id && profile.stripe_customer_id!==session.customer)) throw new LifetimePaymentRejected("Purchase/account binding is invalid.");
    const payment=session.payment_intent!.id;
    const reversed=(await c.query(`SELECT 1 FROM contentos_app.lifetime_payment_events e WHERE payment_intent_id=$1 AND
      (event_type='refund' OR (event_type='dispute' AND NOT EXISTS
        (SELECT 1 FROM contentos_app.lifetime_payment_events r WHERE r.payment_intent_id=e.payment_intent_id AND r.event_type='dispute_resolved' AND r.created_at>=e.created_at))) LIMIT 1`,[payment])).rowCount;
    if(reversed) throw new LifetimePaymentRejected("Payment has a refund or dispute record.");
    if(purchase.state==="paid") return {activated:true,replay:true};
    const membership={source:"lifetime_purchase",status:"active",textCredits:COST_POLICY.textCredits,imageCredits:COST_POLICY.imageCredits};
    await c.query("UPDATE contentos_app.profiles SET data=data || jsonb_build_object('lifetime_access',$2::jsonb),updated_at=now() WHERE id=$1",[account,JSON.stringify(membership)]);
    await c.query("UPDATE contentos_app.lifetime_purchases SET state='paid',checkout_session_id=$2,payment_intent_id=$3,evidence=$4::jsonb,updated_at=now() WHERE account_id=$1",[account,sessionId,payment,JSON.stringify({eventId,priceId:price.id,amount:4900,currency:"gbp",creditPolicy:COST_POLICY.version})]);
    await c.query("INSERT INTO contentos_app.lifetime_payment_events(event_id,payment_intent_id,event_type) VALUES($1,$2,'completed') ON CONFLICT DO NOTHING",[eventId,payment]);
    return {activated:true,replay:false};
  });
}

// Reconcile only this purchase using current Stripe evidence, never the event's stale status.
// Reinstatement preserves balances because credits are counted in the immutable spend ledger.
export async function reconcileLifetimePayment(eventId: string, paymentId: string, state: "refund" | "dispute" | "clear", snapshot?: LifetimePaymentSnapshot) {
  if(state!=="clear") return suspendLifetimePurchase(eventId,paymentId,state,snapshot);
  return commercialTransaction(async c=>{
    await assertCurrentSnapshot(c,snapshot);
    const purchase=(await c.query("SELECT * FROM contentos_app.lifetime_purchases WHERE payment_intent_id=$1 FOR UPDATE",[paymentId])).rows[0];
    if((await c.query("SELECT 1 FROM contentos_app.lifetime_payment_events WHERE payment_intent_id=$1 AND event_type='refund' LIMIT 1",[paymentId])).rowCount) return {restored:false};
    await c.query("INSERT INTO contentos_app.lifetime_payment_events(event_id,payment_intent_id,event_type) VALUES($1,$2,'dispute_resolved') ON CONFLICT DO NOTHING",[eventId,paymentId]);
    if(!purchase || purchase.state!=="disputed") return {restored:false};
    const updated=await c.query("UPDATE contentos_app.profiles SET data=jsonb_set(data,'{lifetime_access,status}','\"active\"'::jsonb),updated_at=now() WHERE id=$1 AND data->'lifetime_access'->>'source'='lifetime_purchase' AND data->'lifetime_access'->>'status'='disputed'",[purchase.account_id]);
    if(updated.rowCount!==1) throw new Error("Lifetime dispute recovery profile is missing.");
    await c.query("UPDATE contentos_app.lifetime_purchases SET state='paid',updated_at=now() WHERE account_id=$1",[purchase.account_id]);
    return {restored:true};
  });
}
// Caller must verify the Stripe signature and retrieve current refund/dispute evidence.
// This operation changes only the new membership, never Founder/owner/subscription fields.
export async function suspendLifetimePurchase(eventId: string, paymentId: string, reason: "refund" | "dispute", snapshot?: LifetimePaymentSnapshot) {
  if(!eventId || !paymentId || !["refund","dispute"].includes(reason)) throw new LifetimePaymentRejected("Invalid reversal evidence.");
  return commercialTransaction(async c=>{
    await assertCurrentSnapshot(c,snapshot);
    await c.query("INSERT INTO contentos_app.lifetime_payment_events(event_id,payment_intent_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[eventId,paymentId,reason]);
    const row=(await c.query("UPDATE contentos_app.lifetime_purchases SET state=$2,updated_at=now() WHERE payment_intent_id=$1 RETURNING account_id",[paymentId,reason==="refund"?"revoked":"disputed"])).rows[0];
    if(row) await c.query("UPDATE contentos_app.profiles SET data=jsonb_set(data,'{lifetime_access,status}',to_jsonb($2::text)),updated_at=now() WHERE id=$1 AND data->'lifetime_access'->>'source'='lifetime_purchase'",[row.account_id,reason==="refund"?"revoked":"disputed"]);
    return {suspended:Boolean(row)};
  });
}
