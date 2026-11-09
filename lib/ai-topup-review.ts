import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { commercialTransaction } from "@/lib/commercial-ledger";
import { retrieveCheckoutSession, retrievePaidLifetimePaymentIntent, retrieveLifetimeDisputes } from "@/lib/stripe-rest";
import type { LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";
import { validateTopupPayment } from "@/lib/ai-topup-payments";

type Client = Pick<PoolClient,"query">;
export type TopupEvidence = { reason:"review"|"full_refund"|"dispute"; key:string };
export type TopupDispute = {id:string;status?:string;payment_intent?:string|null;charge?:string};
export function topupEvidence(intent:LifetimePaymentIntent, disputes:TopupDispute[]):TopupEvidence[] {
  const charge=intent.latest_charge;
  if(!charge || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded!<0 || !Number.isSafeInteger(intent.amount))throw new Error("Incomplete payment evidence.");
  const evidence:TopupEvidence[]=[];
  if(charge.refunded || charge.amount_refunded!>=intent.amount!)return [{reason:"full_refund",key:"full_refund"}];
  else if(charge.amount_refunded!>0)evidence.push({reason:"review",key:`refund:${charge.amount_refunded}`});
  for(const d of disputes) {
    if(d.payment_intent!==intent.id || d.charge!==charge.id || !d.id?.startsWith("du_") || !d.status)throw new Error("Dispute identity mismatch.");
    evidence.push({reason:"dispute",key:`dispute:${d.id}:${d.status}`});
  }
  if(charge.disputed && !disputes.length)throw new Error("Dispute evidence unavailable.");
  return evidence;
}
export async function topupDecisionRevision(c:Client,id:string) {
  return (await c.query<{n:string}>("SELECT count(*)::text n FROM contentos_app.ai_topup_adjudications WHERE purchase_id=$1",[id])).rows[0].n;
}
export async function getTopupDecisionRevision(id:string){return topupDecisionRevision(getPool(),id);}
export async function recordTopupEvidence(c:Client,pi:string,event:string,type:string,evidence:TopupEvidence) {
  await c.query(`INSERT INTO contentos_app.ai_topup_reversals(event_id,payment_intent_id,event_type,reason,evidence_key)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[`${event}:${evidence.reason}:${evidence.key}`,pi,type,evidence.reason,evidence.key]);
}
export async function unresolvedTopupRisk(c:Client,pi:string) {
  return (await c.query<{reason:string}>(`SELECT e.reason FROM contentos_app.ai_topup_reversals e WHERE payment_intent_id=$1
    AND (reason='full_refund' OR NOT EXISTS(SELECT 1 FROM contentos_app.ai_topup_adjudications a
      WHERE a.payment_intent_id=e.payment_intent_id AND a.decision='reinstate'
      AND (e.event_id=ANY(a.covered_event_ids) OR e.evidence_key=ANY(a.covered_evidence_keys))))
    ORDER BY CASE reason WHEN 'full_refund' THEN 0 ELSE 1 END LIMIT 1`,[pi])).rows[0]?.reason;
}
export async function freezeTopup(c:Client,row:{id:string;account_id:string;status:string},full:boolean) {
  const status=full || row.status==="revoked"?"revoked":"reversed";
  await c.query("UPDATE contentos_app.ai_topup_purchases SET status=$2,updated_at=now() WHERE id=$1",[row.id,status]);
  const holds=await c.query<{account_id:string;request_id:string}>("UPDATE contentos_app.ai_topup_reservations SET state='void',updated_at=now() WHERE purchase_id=$1 AND state='reserved' RETURNING account_id,request_id",[row.id]);
  for(const h of holds.rows)await c.query("INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,request_id,action,credits) VALUES($1,$2,$3,$4,'void',1)",[randomUUID(),row.id,h.account_id,h.request_id]);
  if(row.status!==status)await c.query("INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,action,credits) VALUES($1,$2,$3,'reverse',0)",[randomUUID(),row.id,row.account_id]);
  return {status};
}
/** Explicit decisions cover only a verified snapshot. Concurrent new events abort approval. */
export async function reviewTopup(purchaseId:string,administrator:{id:string;email:string},reason:string,decision:"reinstate"|"retain_freeze") {
  const { isAdminEmail }=await import("@/lib/auth");
  if(!administrator.id || !isAdminEmail(administrator.email) || !/^[0-9a-f-]{36}$/i.test(purchaseId) ||
    reason.trim().length<10 || reason.trim().length>500 || !["reinstate","retain_freeze"].includes(decision))throw new Error("Invalid administrator decision.");
  const db=getPool();
  const row=(await db.query("SELECT * FROM contentos_app.ai_topup_purchases WHERE id=$1",[purchaseId])).rows[0];
  if(!row || row.status!=="reversed" || !row.stripe_payment_intent_id || !row.stripe_session_id)throw new Error("Purchase is not reviewable.");
  const pi=row.stripe_payment_intent_id;
  const revision=await topupDecisionRevision(db,purchaseId);
  const events=(await db.query("SELECT event_id,reason,evidence_key FROM contentos_app.ai_topup_reversals WHERE payment_intent_id=$1 ORDER BY event_id",[pi])).rows;
  const session=await retrieveCheckoutSession(row.stripe_session_id);
  const intent=await retrievePaidLifetimePaymentIntent(pi);
  const disputes=await retrieveLifetimeDisputes(pi);
  const evidence=topupEvidence(intent,disputes);
  if(!validateTopupPayment(row,session,intent,true) || !events.length || events.some(e=>e.reason==="full_refund") || evidence.some(e=>e.reason==="full_refund"))throw new Error("Payment cannot be reinstated.");
  if(decision==="reinstate" && (disputes.some(d=>d.status!=="won") || events.some(e=>e.reason==="dispute") && !disputes.length || events.some(e=>!e.evidence_key || e.evidence_key.startsWith("unknown:"))))throw new Error("Resolve all disputes and legacy evidence first.");
  return commercialTransaction(async c=>{
    const current=(await c.query("SELECT * FROM contentos_app.ai_topup_purchases WHERE id=$1 FOR UPDATE",[purchaseId])).rows[0];
    const fresh=(await c.query("SELECT event_id,reason,evidence_key FROM contentos_app.ai_topup_reversals WHERE payment_intent_id=$1 ORDER BY event_id",[pi])).rows;
    if(current?.status!=="reversed" || current.stripe_payment_intent_id!==pi || current.stripe_session_id!==row.stripe_session_id ||
      revision!==await topupDecisionRevision(c,purchaseId) || JSON.stringify(events)!==JSON.stringify(fresh))throw new Error("Payment evidence changed during review.");
    const id=randomUUID();
    await c.query(`INSERT INTO contentos_app.ai_topup_adjudications(id,purchase_id,payment_intent_id,administrator_id,administrator_email,decision,reason,covered_event_ids,covered_evidence_keys,stripe_charge_id,stripe_refunded_pence,dispute_ids)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,row.id,pi,administrator.id,administrator.email.toLowerCase(),decision,reason.trim(),events.map(e=>e.event_id),[...new Set(evidence.map(e=>e.key))],intent.latest_charge!.id,intent.latest_charge!.amount_refunded,disputes.map(d=>d.id)]);
    if(decision==="reinstate") {
      // Only unconsumed units become available. Existing voided requests stay void.
      await c.query("INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,action,credits) VALUES($1,$2,$3,'grant',$4) ON CONFLICT DO NOTHING",[randomUUID(),row.id,row.account_id,row.credits]);
      await c.query("UPDATE contentos_app.ai_topup_purchases SET status='paid',updated_at=now() WHERE id=$1",[row.id]);
    }
    return {status:decision,decisionId:id};
  });
}
