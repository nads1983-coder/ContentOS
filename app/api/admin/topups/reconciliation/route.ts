import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { getPool } from "@/lib/db/client";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { readAdminJson } from "@/lib/admin-json";
import { randomUUID } from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  const user=await getCurrentUser();if(!user || !isAdminEmail(user.email))return Response.json({error:"Forbidden"},{status:403});
  try {
    const db=getPool();
    const [jobs,alerts,holds,reviews,decisions]=await Promise.all([
      db.query("SELECT purchase_id,attempts,state,next_attempt_at,error_code,updated_at FROM contentos_app.ai_topup_reconciliation_jobs WHERE state='attention' OR error_code IS NOT NULL ORDER BY updated_at LIMIT 100"),
      db.query("SELECT purchase_id,code,created_at,delivered_at,delivery_attempts,last_attempt_at FROM contentos_app.ai_topup_reconciliation_alerts ORDER BY created_at DESC LIMIT 100"),
      db.query("SELECT purchase_id,account_id,request_id,created_at FROM contentos_app.ai_topup_reservations WHERE state='reserved' AND created_at<now()-interval '15 minutes' ORDER BY created_at LIMIT 100"),
      db.query("SELECT id,account_id,status,stripe_payment_intent_id,updated_at FROM contentos_app.ai_topup_purchases WHERE status IN ('reversed','revoked') ORDER BY updated_at LIMIT 100"),
      db.query("SELECT purchase_id,administrator_id,administrator_email,decision,reason,created_at FROM contentos_app.ai_topup_adjudications ORDER BY created_at DESC LIMIT 100")
    ]);
    return Response.json({jobs:jobs.rows,alerts:alerts.rows,staleReservations:holds.rows,paymentReviews:reviews.rows,decisions:decisions.rows},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Reconciliation status is unavailable."},{status:503});}
}
export async function POST(request:Request) {
  const rejected=rejectUnsafeWrite(request);if(rejected)return rejected;
  const user=await getCurrentUser();if(!user || !isAdminEmail(user.email))return Response.json({error:"Forbidden"},{status:403});
  try {
    const body=await readAdminJson(request) as {purchaseId?:unknown;reason?:unknown};
    if(typeof body?.purchaseId!=="string" || !/^[0-9a-f-]{36}$/i.test(body.purchaseId) || typeof body.reason!=="string" || body.reason.trim().length<10 || body.reason.trim().length>500)throw new Error("Invalid request.");
    const c=await getPool().connect();
    try {
      await c.query("BEGIN");
      const result=await c.query(`UPDATE contentos_app.ai_topup_reconciliation_jobs SET state='pending',attempts=0,next_attempt_at=now(),lease_token=NULL,lease_until=NULL,error_code=NULL,updated_at=now()
        WHERE purchase_id=$1 AND state='attention' AND (lease_until IS NULL OR lease_until<now()) RETURNING purchase_id`,[body.purchaseId]);
      if(!result.rowCount)throw new Error("Job cannot be retried.");
      await c.query(`INSERT INTO contentos_app.ai_topup_reconciliation_actions(id,purchase_id,administrator_id,administrator_email,reason)
        VALUES($1,$2,$3,$4,$5)`,[randomUUID(),body.purchaseId,user.id,user.email.toLowerCase(),body.reason.trim()]);
      await c.query("UPDATE contentos_app.ai_topup_reconciliation_alerts SET delivered_at=NULL,last_attempt_at=NULL WHERE purchase_id=$1",[body.purchaseId]);
      await c.query("COMMIT");return Response.json({status:"queued"},{headers:{"Cache-Control":"no-store"}});
    }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
  }catch{return Response.json({error:"Retry requires operator review."},{status:409});}
}
