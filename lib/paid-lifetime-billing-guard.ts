import "server-only";
import { getPool } from "@/lib/db/client";
import { hasPaidCreatorLifetimeEntitlement } from "@/lib/entitlements";
import type { UserProfile } from "@/types/saas";

// A durable marker is written BEFORE the external POST. A lost response must
// block a conflicting lifetime purchase, not become permission to charge twice.
export async function reserveRecurringCheckout(userId: string, plan: string) {
  const c = await getPool().connect();
  try {
    await c.query("BEGIN"); await c.query("SELECT pg_advisory_xact_lock(1949019031)");
    const p=(await c.query<{data:UserProfile}>("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE",[userId])).rows[0];
    if (!p || (hasPaidCreatorLifetimeEntitlement(p.data) && plan !== "pro_studio")) throw new Error("This plan is already covered by lifetime access.");
    const pending=await c.query("SELECT 1 FROM contentos_app.paid_creator_lifetime_purchases WHERE user_id=$1 AND status IN ('preparing','open','review')",[userId]);
    if (pending.rowCount) throw new Error("Resolve your lifetime purchase before starting another payment.");
    await c.query("INSERT INTO contentos_app.lifetime_recurring_checkout_guards(user_id) VALUES ($1)",[userId]);
    await c.query("COMMIT");
  } catch(error) {await c.query("ROLLBACK");throw error;} finally {c.release();}
}
export async function recordRecurringCheckout(userId:string, sessionId:string) {
  await getPool().query("UPDATE contentos_app.lifetime_recurring_checkout_guards SET session_id=$2 WHERE user_id=$1",[userId,sessionId]);
}
