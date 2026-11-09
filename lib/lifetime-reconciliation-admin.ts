import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";

export async function reconciliationStatus() {
  const jobs=await getPool().query(`SELECT kind,entity_id,attempts,state,next_attempt_at,lease_until,last_error_code,updated_at
    FROM contentos_app.lifetime_reconciliation_jobs WHERE state='attention' OR last_error_code IS NOT NULL
    ORDER BY updated_at DESC LIMIT 100`);
  const alerts=await getPool().query(`SELECT a.kind,a.entity_id,a.code,a.created_at,a.updated_at,j.state AS current_state
    FROM contentos_app.lifetime_reconciliation_alerts a LEFT JOIN contentos_app.lifetime_reconciliation_jobs j
      ON j.kind=a.kind AND j.entity_id=a.entity_id ORDER BY a.updated_at DESC LIMIT 100`);
  const reviews=await getPool().query(`SELECT p.id,p.status,p.updated_at FROM contentos_app.paid_creator_lifetime_purchases p
    WHERE p.status IN ('review','disputed') OR EXISTS (
      SELECT 1 FROM contentos_app.paid_lifetime_payment_events e WHERE e.payment_intent_id=p.stripe_payment_intent_id AND e.reason='review'
      AND NOT EXISTS (SELECT 1 FROM contentos_app.paid_lifetime_adjudications a
        WHERE a.payment_intent_id=e.payment_intent_id AND e.event_id=ANY(a.covered_event_ids)))
    ORDER BY p.updated_at LIMIT 100`);
  const unmatched=await getPool().query(`SELECT e.event_id,e.payment_intent_id,e.reason,e.created_at
    FROM contentos_app.paid_lifetime_payment_events e LEFT JOIN contentos_app.paid_creator_lifetime_purchases p
      ON p.stripe_payment_intent_id=e.payment_intent_id WHERE p.id IS NULL ORDER BY e.created_at LIMIT 100`);
  return {jobs:jobs.rows,alerts:alerts.rows,reviews:reviews.rows,unmatchedEvents:unmatched.rows,
    note:"Unmatched payment events may belong to unrelated Stripe products.",limit:100};
}

/** Reset only a terminal, unleased job; never alter payment or entitlement state. */
export async function retryReconciliation(kind:string,id:string,admin:{id:string;email:string},reason:string) {
  const why=reason.trim();
  if(!["purchase","guard"].includes(kind) || !id || id.length>200 || !admin.id || !admin.email || why.length<10 || why.length>500) throw new Error("Invalid review request.");
  const c=await getPool().connect();
  try {
    await c.query("BEGIN");
    const updated=await c.query(`UPDATE contentos_app.lifetime_reconciliation_jobs
      SET attempts=0,state='pending',next_attempt_at=now(),lease_until=NULL,lease_token=NULL,last_error_code=NULL,updated_at=now()
      WHERE kind=$1 AND entity_id=$2 AND state='attention' AND (lease_until IS NULL OR lease_until<now()) RETURNING entity_id`,[kind,id]);
    if(!updated.rowCount)throw new Error("Job is not eligible for retry.");
    await c.query(`INSERT INTO contentos_app.lifetime_reconciliation_actions(id,kind,entity_id,administrator_id,administrator_email,reason)
      VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),kind,id,admin.id,admin.email.toLowerCase(),why]);
    await c.query("COMMIT");return {status:"queued"};
  } catch(error){await c.query("ROLLBACK").catch(()=>{});throw error;} finally {c.release();}
}
