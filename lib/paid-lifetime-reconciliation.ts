import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { getPaidLifetimeReservation, recordPaidLifetimeCheckoutSession, terminatePaidLifetimeReservation } from "@/lib/paid-lifetime-reservations";
import { retrieveCheckoutSession, retrieveStripeSubscription, retrievePaidLifetimePaymentIntent, findLifetimeCheckoutSessions } from "@/lib/stripe-rest";
import { completePaidCreatorLifetimePurchase, getLifetimeDecisionRevision } from "@/lib/paid-lifetime-fulfillment";
import type { LifetimeStripeSession, LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";

type JobKind = "guard" | "purchase";
type Job = {kind:JobKind;entity_id:string;lease_token:string;attempts:number};
export function safelyExpired(session: LifetimeStripeSession, intent?: LifetimePaymentIntent) {
  if (session.status !== "expired" || session.payment_status !== "unpaid") return false;
  if (!session.payment_intent) return true;
  return Boolean(intent && intent.status === "canceled" && intent.amount_received === 0 && !intent.latest_charge?.paid);
}
async function seedJobs() {
  const db=getPool();
  await db.query(`INSERT INTO contentos_app.lifetime_reconciliation_jobs(kind,entity_id)
    SELECT 'guard',g.user_id FROM contentos_app.lifetime_recurring_checkout_guards g
    WHERE g.session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contentos_app.lifetime_reconciliation_jobs j WHERE j.kind='guard' AND j.entity_id=g.user_id)
    ORDER BY g.checked_at ASC NULLS FIRST,g.user_id LIMIT 50 ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO contentos_app.lifetime_reconciliation_jobs(kind,entity_id)
    SELECT 'purchase',p.id::text FROM contentos_app.paid_creator_lifetime_purchases p
    WHERE p.status IN ('preparing','open','completed') AND NOT EXISTS (SELECT 1 FROM contentos_app.lifetime_reconciliation_jobs j WHERE j.kind='purchase' AND j.entity_id=p.id::text)
    ORDER BY p.updated_at,p.id LIMIT 50 ON CONFLICT DO NOTHING`);
}
async function claim(kind:JobKind):Promise<Job | undefined> {
  const token=randomUUID();
  // Recover even if a worker died after marking attention but before alerting.
  await getPool().query(`INSERT INTO contentos_app.lifetime_reconciliation_alerts(kind,entity_id,code)
    SELECT j.kind,j.entity_id,'retry_limit' FROM contentos_app.lifetime_reconciliation_jobs j
    WHERE j.kind=$1 AND j.state='attention' AND NOT EXISTS (
      SELECT 1 FROM contentos_app.lifetime_reconciliation_alerts a WHERE a.kind=j.kind AND a.entity_id=j.entity_id AND a.code='retry_limit')
    ORDER BY j.updated_at LIMIT 50 ON CONFLICT DO NOTHING`,[kind]);
  // A crashed final attempt becomes a durable operator alert after its lease.
  const exhausted=await getPool().query<{entity_id:string}>(`WITH expired AS (
    SELECT kind,entity_id FROM contentos_app.lifetime_reconciliation_jobs
    WHERE kind=$1 AND state='pending' AND attempts>=8 AND lease_until<now()
    ORDER BY lease_until FOR UPDATE SKIP LOCKED LIMIT 50)
    UPDATE contentos_app.lifetime_reconciliation_jobs j
    SET state='attention',lease_until=NULL,lease_token=NULL,last_error_code='retry_limit',updated_at=now()
    FROM expired e WHERE j.kind=e.kind AND j.entity_id=e.entity_id RETURNING j.entity_id`,[kind]);
  for(const row of exhausted.rows) await alert(kind,row.entity_id,"retry_limit");
  return (await getPool().query<Job>(`WITH candidate AS (
    SELECT kind,entity_id FROM contentos_app.lifetime_reconciliation_jobs
    WHERE kind=$1 AND state='pending' AND attempts<8 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_attempt_at,entity_id FOR UPDATE SKIP LOCKED LIMIT 1)
    UPDATE contentos_app.lifetime_reconciliation_jobs j SET attempts=j.attempts+1,lease_until=now()+interval '40 seconds',lease_token=$2,updated_at=now()
    FROM candidate c WHERE j.kind=c.kind AND j.entity_id=c.entity_id RETURNING j.kind,j.entity_id,j.lease_token,j.attempts`,[kind,token])).rows[0];
}
async function alert(kind:JobKind,id:string,code:string) {
  await getPool().query(`INSERT INTO contentos_app.lifetime_reconciliation_alerts(kind,entity_id,code)
    VALUES($1,$2,$3) ON CONFLICT(kind,entity_id,code) DO UPDATE SET updated_at=now()`,[kind,id,code]);
}
async function finish(job:Job,outcome:"done"|"pending"|"completed"|"error",code?:string) {
  const db=getPool();
  if(outcome==="done") {
    await db.query("DELETE FROM contentos_app.lifetime_reconciliation_jobs WHERE kind=$1 AND entity_id=$2 AND lease_token=$3",[job.kind,job.entity_id,job.lease_token]);
    return;
  }
  if(outcome==="error") {
    const updated=await db.query(`UPDATE contentos_app.lifetime_reconciliation_jobs SET
      state=CASE WHEN attempts>=8 THEN 'attention' ELSE 'pending' END,
      next_attempt_at=now()+make_interval(secs=>LEAST(3600,30*power(2,attempts-1))::double precision),
      lease_until=NULL,lease_token=NULL,last_error_code=$4,updated_at=now()
      WHERE kind=$1 AND entity_id=$2 AND lease_token=$3 RETURNING state`,[job.kind,job.entity_id,job.lease_token,code ?? "reconciliation_failed"]);
    if(updated.rows[0]?.state==="attention")await alert(job.kind,job.entity_id,"retry_limit");
    return;
  }
  await db.query(`UPDATE contentos_app.lifetime_reconciliation_jobs SET attempts=0,state='pending',
    next_attempt_at=now()+CASE WHEN $4='completed' THEN interval '1 day' ELSE interval '5 minutes' END,
    lease_until=NULL,lease_token=NULL,last_error_code=NULL,updated_at=now()
    WHERE kind=$1 AND entity_id=$2 AND lease_token=$3`,[job.kind,job.entity_id,job.lease_token,outcome]);
}

// Leased one item at a time: crashes leave an expiring lease, while retries are
// bounded and delayed. Unknown Stripe states never release a purchase or slot.
export async function reconcileLifetimeCheckouts() {
  const deadline=AbortSignal.timeout(20_000);
  const guardDeadline=AbortSignal.any([deadline,AbortSignal.timeout(6_000)]);
  const result={checked:0,terminal:0,uncertain:0,guardsChecked:0,guardFailures:0,guardDeadlineExceeded:false,timedOut:false};
  await getPool().query(`UPDATE contentos_app.paid_creator_lifetime_purchases SET status='expired',updated_at=now()
    WHERE id IN (SELECT id FROM contentos_app.paid_creator_lifetime_purchases
      WHERE status='preparing' AND checkout_params IS NULL AND stripe_checkout_session_id IS NULL AND created_at < now()-interval '23 hours'
      ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED)`);
  await seedJobs();
  for(let n=0;n<10;n++) {
    if(guardDeadline.aborted){result.guardDeadlineExceeded=true;break;}
    const job=await claim("guard");if(!job)break;
    result.guardsChecked++;
    try {
      const guard=(await getPool().query<{session_id:string|null}>("SELECT session_id FROM contentos_app.lifetime_recurring_checkout_guards WHERE user_id=$1",[job.entity_id])).rows[0];
      if(!guard?.session_id){await finish(job,"done");continue;}
      await getPool().query("UPDATE contentos_app.lifetime_recurring_checkout_guards SET checked_at=now() WHERE user_id=$1 AND session_id=$2",[job.entity_id,guard.session_id]);
      const session=await retrieveCheckoutSession(guard.session_id,guardDeadline);
      const subscriptionId=session.subscription;
      const ended=session.status==="complete" && typeof subscriptionId==="string" && ["canceled","incomplete_expired"].includes((await retrieveStripeSubscription(subscriptionId,guardDeadline)).status);
      if(session.id!==guard.session_id)throw Error("Identity mismatch");
      if(safelyExpired(session)||ended){
        await getPool().query("DELETE FROM contentos_app.lifetime_recurring_checkout_guards WHERE user_id=$1 AND session_id=$2",[job.entity_id,guard.session_id]);
        await finish(job,"done");
      } else await finish(job,"pending");
    } catch {result.guardFailures++;await finish(job,"error",guardDeadline.aborted?"deadline":"stripe_or_database_error");}
  }
  for(let n=0;n<50;n++) {
    if(deadline.aborted){result.timedOut=true;break;}
    const job=await claim("purchase");if(!job)break;
    result.checked++;
    try {
      const claimRow=await getPaidLifetimeReservation(job.entity_id);
      if(!claimRow || !["preparing","open","completed"].includes(claimRow.status)){await finish(job,"done");continue;}
      const revision=await getLifetimeDecisionRevision(claimRow.id);
      const candidates=claimRow.stripeCheckoutSessionId?[await retrieveCheckoutSession(claimRow.stripeCheckoutSessionId,deadline)]:await findLifetimeCheckoutSessions(claimRow,deadline);
      if(candidates.length!==1)throw Error("Uncertain session");
      const session=candidates[0];
      if(!session.id || session.metadata?.purchase_id!==claimRow.id || session.metadata?.attempt_key!==claimRow.attemptKey || session.client_reference_id!==claimRow.userId || session.metadata?.offer!=="creator_lifetime_2026")throw Error("Identity mismatch");
      if(!claimRow.stripeCheckoutSessionId)await recordPaidLifetimeCheckoutSession(claimRow.id,session.id,session.url ?? "",new Date((session.expires_at ?? 0)*1000).toISOString());
      const pi=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
      const intent=pi?await retrievePaidLifetimePaymentIntent(pi,deadline):undefined;
      if(safelyExpired(session,intent)){await terminatePaidLifetimeReservation(claimRow.id,"expired");result.terminal++;await finish(job,"done");}
      else if(session.status==="complete" && session.payment_status==="paid" && intent){
        const outcome=await completePaidCreatorLifetimePurchase(claimRow.id,session,intent,revision);
        if(outcome.status==="stale_snapshot")throw Error("Administrator decision changed; refresh Stripe state");
        result.terminal++;await finish(job,"completed");
      }
      else if(session.status==="open" && session.payment_status==="unpaid"){await finish(job,"pending");}
      else throw Error("Payment status uncertain");
    } catch {result.uncertain++;if(deadline.aborted)result.timedOut=true;await finish(job,"error",deadline.aborted?"deadline":"payment_uncertain");}
  }
  if(result.uncertain||result.guardFailures||result.guardDeadlineExceeded||result.timedOut)console.warn("[Lifetime reconciliation] Operator review required",result);
  return result;
}
