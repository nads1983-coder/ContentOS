import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { GenerationReservationError } from "@/lib/generation-reservation";

// Caller holds commercialTransaction's global advisory lock. Both monetary and
// credit reservations therefore commit or roll back in the same transaction.
export async function reserveTopupCredit(c:PoolClient,accountId:string,requestId:string) {
  const row=(await c.query<{id:string}>(`SELECT p.id FROM contentos_app.ai_topup_purchases p
    WHERE p.account_id=$1 AND p.status='paid' AND p.credits >
      (SELECT count(*) FROM contentos_app.ai_topup_reservations r
       WHERE r.purchase_id=p.id AND r.state IN ('reserved','consumed'))
      AND EXISTS (SELECT 1 FROM contentos_app.ai_topup_ledger l WHERE l.purchase_id=p.id AND l.account_id=p.account_id AND l.action='grant' AND l.credits=p.credits)
    ORDER BY p.created_at,p.id LIMIT 1 FOR UPDATE`,[accountId])).rows[0];
  if(!row)throw new GenerationReservationError("Your monthly included and purchased text credits are exhausted.",429,"quota_exceeded");
  await c.query(`INSERT INTO contentos_app.ai_topup_reservations(account_id,request_id,purchase_id,state)
    VALUES($1,$2,$3,'reserved')`,[accountId,requestId,row.id]);
  await c.query(`INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,request_id,action,credits)
    VALUES($1,$2,$3,$4,'reserve',1)`,[randomUUID(),row.id,accountId,requestId]);
}

export async function assertTopupDispatch(c:PoolClient,accountId:string,requestId:string) {
  const row=(await c.query<{state:string;purchase_status:string}>(`SELECT r.state,p.status AS purchase_status
    FROM contentos_app.ai_topup_reservations r JOIN contentos_app.ai_topup_purchases p ON p.id=r.purchase_id
    WHERE r.account_id=$1 AND r.request_id=$2 FOR UPDATE OF r,p`,[accountId,requestId])).rows[0];
  if(!row || row.state!=="reserved" || row.purchase_status!=="paid")throw new GenerationReservationError("This purchased credit is under payment review. Contact support.",409,"credit_reversed");
}

export async function finishTopupCredit(c:PoolClient,accountId:string,requestId:string,delivered:boolean,required:boolean) {
  const row=(await c.query<{purchase_id:string;state:string;purchase_status:string}>(`SELECT r.purchase_id,r.state,p.status AS purchase_status
    FROM contentos_app.ai_topup_reservations r JOIN contentos_app.ai_topup_purchases p ON p.id=r.purchase_id
    WHERE r.account_id=$1 AND r.request_id=$2 FOR UPDATE OF r,p`,[accountId,requestId])).rows[0];
  if(!row) {if(required)throw new GenerationReservationError("Purchased-credit accounting is unavailable.",503,"credit_unavailable");return;}
  if(!required)throw new GenerationReservationError("Purchased-credit accounting does not match this request.",503,"credit_unavailable");
  if(delivered && (row.state!=="reserved" || row.purchase_status!=="paid")) {
    if(row.state==="consumed")return;
    throw new GenerationReservationError("This purchased credit is under payment review. Contact support.",409,"credit_reversed");
  }
  if(row.state!=="reserved")return;
  const next=delivered?"consumed":"released";
  await c.query("UPDATE contentos_app.ai_topup_reservations SET state=$3,updated_at=now() WHERE account_id=$1 AND request_id=$2",[accountId,requestId,next]);
  await c.query(`INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,request_id,action,credits)
    VALUES($1,$2,$3,$4,$5,1)`,[randomUUID(),row.purchase_id,accountId,requestId,delivered?"consume":"release"]);
}
