import "server-only";
import { getPool } from "@/lib/db/client";
import { getPaidLifetimeReservation, recordPaidLifetimeCheckoutSession, terminatePaidLifetimeReservation } from "@/lib/paid-lifetime-reservations";
import { retrieveCheckoutSession, retrieveStripeSubscription, retrievePaidLifetimePaymentIntent, findLifetimeCheckoutSessions } from "@/lib/stripe-rest";
import { completePaidCreatorLifetimePurchase } from "@/lib/paid-lifetime-fulfillment";
import type { LifetimeStripeSession, LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";

export function safelyExpired(session: LifetimeStripeSession, intent?: LifetimePaymentIntent) {
  if (session.status !== "expired" || session.payment_status !== "unpaid") return false;
  if (!session.payment_intent) return true;
  return Boolean(intent && intent.status === "canceled" && intent.amount_received === 0 && !intent.latest_charge?.paid);
}
// Bounded work. Oldest checked rows rotate to the back, so a stuck attempt
// cannot starve newer ones. Missing/failed Stripe reads never free capacity.
export async function reconcileLifetimeCheckouts() {
  const guards = await getPool().query<{user_id:string;session_id:string}>(
    "SELECT user_id,session_id FROM contentos_app.lifetime_recurring_checkout_guards WHERE session_id IS NOT NULL LIMIT 50");
  for (const guard of guards.rows) {
    try {
    const session = await retrieveCheckoutSession(guard.session_id);
    const subscriptionId = session.subscription;
    const ended = session.status === "complete" && typeof subscriptionId === "string" &&
      ["canceled","incomplete_expired"].includes((await retrieveStripeSubscription(subscriptionId)).status);
    if (session.id === guard.session_id && (safelyExpired(session) || ended)) await getPool().query(
      "DELETE FROM contentos_app.lifetime_recurring_checkout_guards WHERE user_id=$1 AND session_id=$2",[guard.user_id,guard.session_id]);
    } catch { /* Unknown recurring payment remains guarded; continue other work. */ }
  }
  // A NULL request proves no external POST could have occurred. The conditional
  // update races safely with immutable request persistence before Stripe POST.
  await getPool().query(`UPDATE contentos_app.paid_creator_lifetime_purchases SET status='expired',updated_at=now()
    WHERE status='preparing' AND checkout_params IS NULL AND stripe_checkout_session_id IS NULL
    AND created_at < now() - interval '23 hours'`);
  const rows = await getPool().query<{id:string}>(`SELECT id FROM contentos_app.paid_creator_lifetime_purchases
    WHERE status IN ('preparing','open','completed') ORDER BY updated_at LIMIT 50`);
  const result = {checked:0, terminal:0, uncertain:0};
  for (const row of rows.rows) {
    try {
      const claim = await getPaidLifetimeReservation(row.id);
      if (!claim) continue;
      const candidates = claim.stripeCheckoutSessionId ? [await retrieveCheckoutSession(claim.stripeCheckoutSessionId)]
        : await findLifetimeCheckoutSessions(claim);
      if (candidates.length !== 1) { result.uncertain++; continue; }
      const session = candidates[0];
      if (!session.id || session.metadata?.purchase_id !== claim.id || session.metadata?.attempt_key !== claim.attemptKey ||
          session.client_reference_id !== claim.userId || session.metadata?.offer !== "creator_lifetime_2026") throw new Error("Reconciliation identity mismatch.");
      if (!claim.stripeCheckoutSessionId) {
        // Recover even a completed/expired session after a lost create/save response.
        await recordPaidLifetimeCheckoutSession(claim.id,session.id,session.url ?? "",new Date((session.expires_at ?? 0)*1000).toISOString());
      }
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      const intent = pi ? await retrievePaidLifetimePaymentIntent(pi) : undefined;
      if (safelyExpired(session,intent)) { await terminatePaidLifetimeReservation(claim.id,"expired"); result.terminal++; }
      else if (session.status === "complete" && session.payment_status === "paid" && intent) {
        await completePaidCreatorLifetimePurchase(claim.id,session,intent); result.terminal++;
      } else result.uncertain++;
    } catch { result.uncertain++; }
    finally {
      result.checked++;
      await getPool().query("UPDATE contentos_app.paid_creator_lifetime_purchases SET updated_at=now() WHERE id=$1",[row.id]);
    }
  }
  return result;
}
