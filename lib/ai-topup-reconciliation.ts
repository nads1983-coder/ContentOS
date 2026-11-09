import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { retrieveCheckoutSession, retrievePaidLifetimePaymentIntent, retrieveLifetimeDisputes } from "@/lib/stripe-rest";
import { fulfillTopup, terminateTopup } from "@/lib/ai-topup-payments";

import { getTopupDecisionRevision } from "@/lib/ai-topup-review";

type Job={purchase_id:string;lease_token:string;attempts:number};
async function claim():Promise<Job | undefined> {
  const pool=getPool();
  await pool.query(`UPDATE contentos_app.ai_topup_reconciliation_jobs SET state='attention',lease_until=NULL,lease_token=NULL,error_code='retry_limit',updated_at=now()
    WHERE state='pending' AND attempts>=8 AND lease_until<now()`);
  await pool.query(`INSERT INTO contentos_app.ai_topup_reconciliation_alerts(purchase_id,code)
    SELECT purchase_id,'retry_limit' FROM contentos_app.ai_topup_reconciliation_jobs WHERE state='attention' ON CONFLICT DO NOTHING`);
  return (await pool.query<Job>(`WITH candidate AS (SELECT purchase_id FROM contentos_app.ai_topup_reconciliation_jobs
    WHERE state='pending' AND attempts<8 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_attempt_at,purchase_id FOR UPDATE SKIP LOCKED LIMIT 1)
    UPDATE contentos_app.ai_topup_reconciliation_jobs j SET attempts=j.attempts+1,lease_token=$1,lease_until=now()+interval '40 seconds',updated_at=now()
    FROM candidate c WHERE j.purchase_id=c.purchase_id RETURNING j.purchase_id,j.lease_token,j.attempts`,[randomUUID()])).rows[0];
}
async function finish(j:Job,outcome:"done"|"pending"|"paid"|"error") {
  const db=getPool();
  if(outcome==="done") {await db.query("DELETE FROM contentos_app.ai_topup_reconciliation_jobs WHERE purchase_id=$1 AND lease_token=$2",[j.purchase_id,j.lease_token]);return;}
  await db.query(`UPDATE contentos_app.ai_topup_reconciliation_jobs SET
    state=CASE WHEN $3='error' AND attempts>=8 THEN 'attention' ELSE 'pending' END,
    next_attempt_at=now()+CASE WHEN $3='error' THEN make_interval(secs=>LEAST(3600,30*power(2,attempts-1))::double precision)
      WHEN $3='paid' THEN interval '1 day' ELSE interval '5 minutes' END,
    attempts=CASE WHEN $3='error' THEN attempts ELSE 0 END,lease_until=NULL,lease_token=NULL,
    error_code=CASE WHEN $3='error' THEN 'payment_uncertain' ELSE NULL END,updated_at=now()
    WHERE purchase_id=$1 AND lease_token=$2`,[j.purchase_id,j.lease_token,outcome]);
  await db.query(`INSERT INTO contentos_app.ai_topup_reconciliation_alerts(purchase_id,code)
    SELECT purchase_id,'retry_limit' FROM contentos_app.ai_topup_reconciliation_jobs WHERE purchase_id=$1 AND state='attention' ON CONFLICT DO NOTHING`,[j.purchase_id]);
}

/** Optional delivery; persistent alerts remain visible if no destination exists. */
export async function deliverTopupAlerts() {
  const target=process.env.CONTENTOS_RECONCILIATION_ALERT_URL;
  if(!target)return {configured:false,delivered:0};
  const url=new URL(target);if(url.protocol!=="https:")throw new Error("Alert delivery must use HTTPS.");
  const db=getPool();
  const alerts=await db.query<{purchase_id:string;code:string}>(`SELECT purchase_id,code FROM contentos_app.ai_topup_reconciliation_alerts
    WHERE delivered_at IS NULL ORDER BY last_attempt_at ASC NULLS FIRST,created_at LIMIT 10`);
  let delivered=0;
  for(const a of alerts.rows) {
    let ok=false;
    try {const result=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"topup_reconciliation",purchaseId:a.purchase_id,code:a.code}),signal:AbortSignal.timeout(2000),redirect:"error"});ok=result.ok;}catch{/* keep for retry */}
    await db.query(`UPDATE contentos_app.ai_topup_reconciliation_alerts SET delivery_attempts=delivery_attempts+1,last_attempt_at=now(),
      delivered_at=CASE WHEN $3 THEN now() ELSE delivered_at END WHERE purchase_id=$1 AND code=$2`,[a.purchase_id,a.code,ok]);
    if(ok)delivered++;
  }
  const lifetime=await db.query<{kind:string;entity_id:string;code:string}>(`SELECT kind,entity_id,code FROM contentos_app.lifetime_reconciliation_alerts
    WHERE delivered_at IS NULL ORDER BY last_attempt_at ASC NULLS FIRST,created_at LIMIT 10`);
  for(const a of lifetime.rows) {
    let ok=false;
    try {const result=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:`lifetime_${a.kind}`,entityId:a.entity_id,code:a.code}),signal:AbortSignal.timeout(2000),redirect:"error"});ok=result.ok;}catch{/* keep for retry */}
    await db.query(`UPDATE contentos_app.lifetime_reconciliation_alerts SET delivery_attempts=delivery_attempts+1,last_attempt_at=now(),
      delivered_at=CASE WHEN $4 THEN now() ELSE delivered_at END WHERE kind=$1 AND entity_id=$2 AND code=$3`,[a.kind,a.entity_id,a.code,ok]);
    if(ok)delivered++;
  }
  return {configured:true,delivered};
}

export async function reconcileTopups() {
  const db=getPool(),signal=AbortSignal.timeout(20_000);
  await db.query(`INSERT INTO contentos_app.ai_topup_reconciliation_jobs(purchase_id)
    SELECT id FROM contentos_app.ai_topup_purchases p WHERE status IN ('preparing','open','paid')
    AND NOT EXISTS (SELECT 1 FROM contentos_app.ai_topup_reconciliation_jobs j WHERE j.purchase_id=p.id)
    ORDER BY p.updated_at,p.id LIMIT 50 ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO contentos_app.ai_topup_reconciliation_alerts(purchase_id,code)
    SELECT DISTINCT purchase_id,'credit_reservation_uncertain' FROM contentos_app.ai_topup_reservations
    WHERE state='reserved' AND created_at<now()-interval '15 minutes' ON CONFLICT DO NOTHING`);
  let checked=0,uncertain=0;
  for(let n=0;n<25 && !signal.aborted;n++) {
    const job=await claim();if(!job)break;checked++;
    try {
      const row=(await db.query("SELECT * FROM contentos_app.ai_topup_purchases WHERE id=$1",[job.purchase_id])).rows[0];
      if(!row || !["preparing","open","paid"].includes(row.status)){await finish(job,"done");continue;}
      if(!row.stripe_session_id)throw new Error("Unknown Checkout session; operator reconciliation required.");
      const revision=await getTopupDecisionRevision(row.id);
      const session=await retrieveCheckoutSession(row.stripe_session_id,signal);
      if(session.status==="expired" && session.payment_status==="unpaid" && !session.payment_intent){await terminateTopup(row.id,session,"expired");await finish(job,"done");continue;}
      if(session.status==="open" && session.payment_status==="unpaid"){await finish(job,"pending");continue;}
      const pi=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
      if(!pi)throw new Error("Payment status unknown.");
      const intent=await retrievePaidLifetimePaymentIntent(pi,signal);
      if(session.status==="complete" && session.payment_status==="unpaid") {
        await terminateTopup(row.id,session,"failed",intent);await finish(job,"done");continue;
      }
      const disputes=intent.latest_charge?.disputed && !intent.latest_charge.refunded ? await retrieveLifetimeDisputes(pi,signal) : [];
      const result=await fulfillTopup(row.id,session,intent,revision,disputes);
      await finish(job,["reversed","revoked","terminal"].includes(result.status)?"done":"paid");
    } catch {uncertain++;await finish(job,"error");}
  }
  const delivery=await deliverTopupAlerts().catch(()=>({configured:false,delivered:0}));
  return {checked,uncertain,deadlineExceeded:signal.aborted,alertDelivery:delivery};
}
