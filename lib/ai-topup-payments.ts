import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { commercialTransaction } from "@/lib/commercial-ledger";
import { AI_TOPUP_OFFER, getAITopupPackage } from "@/lib/ai-topup-offer";
import type { LifetimeStripeSession, LifetimePaymentIntent } from "@/lib/paid-lifetime-stripe";

type Purchase = {id:string;account_id:string;package:string;price_pence:number;credits:number;attempt_key:string;
  stripe_session_id:string|null;stripe_payment_intent_id:string|null;status:string;checkout_params:string|null};
export async function prepareTopup(accountId:string,packageId:string,requestId:string) {
  const pkg=getAITopupPackage(packageId);
  if(!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId))throw new Error("Invalid checkout request.");
  const attempt=`topup:${createHash("sha256").update(`${accountId}:${requestId}`).digest("hex")}`;
  return commercialTransaction(async c=>{
    const existing=(await c.query<Purchase>("SELECT * FROM contentos_app.ai_topup_purchases WHERE attempt_key=$1 FOR UPDATE",[attempt])).rows[0];
    if(existing){if(existing.account_id!==accountId || existing.package!==packageId)throw new Error("Checkout request mismatch.");return existing;}
    // A page reload or second tab must not create a second uncertain payment.
    const pending=(await c.query<Purchase>(`SELECT * FROM contentos_app.ai_topup_purchases
      WHERE account_id=$1 AND status IN ('preparing','open') ORDER BY created_at,id LIMIT 1 FOR UPDATE`,[accountId])).rows[0];
    if(pending){if(pending.package!==packageId)throw new Error("Resolve the existing checkout before choosing another package.");return pending;}
    const id=randomUUID();
    return (await c.query<Purchase>(`INSERT INTO contentos_app.ai_topup_purchases(id,account_id,package,price_pence,credits,attempt_key)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[id,accountId,packageId,pkg.pricePence,pkg.credits,attempt])).rows[0];
  });
}

/** Stripe's expanded session and PaymentIntent must both be fetched server-side. */
function validateTopupIdentity(row:Purchase,session:LifetimeStripeSession & {livemode?:boolean}) {
  const item=session.line_items?.data;
  return Boolean(session.livemode===false && session.id?.startsWith("cs_test_") &&
    (!row.stripe_session_id || row.stripe_session_id===session.id) && session.mode==="payment" &&
    session.currency==="gbp" && session.amount_total===row.price_pence &&
    session.amount_subtotal===row.price_pence && session.total_details?.amount_discount===0 &&
    session.client_reference_id===row.account_id && session.metadata?.offer===AI_TOPUP_OFFER.code &&
    session.metadata?.purchase_id===row.id && session.metadata?.user_id===row.account_id &&
    session.metadata?.attempt_key===row.attempt_key && session.line_items?.has_more===false && item?.length===1 &&
    item[0]?.quantity===1 && item[0]?.amount_total===row.price_pence && item[0]?.price?.unit_amount===row.price_pence &&
    item[0]?.price?.currency==="gbp" && item[0]?.price?.type==="one_time" && !item[0]?.price?.recurring);
}
export function validateTopupSession(row:Purchase,session:LifetimeStripeSession & {livemode?:boolean}) {
  return validateTopupIdentity(row,session) && session.status==="complete" && session.payment_status==="paid";
}
export function validateTopupPayment(row:Purchase,session:LifetimeStripeSession & {livemode?:boolean},intent:LifetimePaymentIntent & {livemode?:boolean}) {
  const pi=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
  const charge=intent.latest_charge;
  return Boolean(validateTopupSession(row,session) && intent.livemode===false &&
    pi && intent.id===pi && (!row.stripe_payment_intent_id || row.stripe_payment_intent_id===pi) &&
    intent.status==="succeeded" && intent.currency==="gbp" && intent.amount===row.price_pence && intent.amount_received===row.price_pence &&
    charge?.id?.startsWith("ch_") && charge.paid===true && charge.refunded===false && charge.disputed===false && charge.amount_refunded===0);
}

export async function terminateTopup(id:string,session:LifetimeStripeSession,reason:"expired"|"failed",intent?:LifetimePaymentIntent) {
  return commercialTransaction(async c=>{
    const row=(await c.query<Purchase>("SELECT * FROM contentos_app.ai_topup_purchases WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if(!row || !validateTopupIdentity(row,session) || session.payment_status!=="unpaid")throw new Error("Unverified terminal session.");
    const pi=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
    const expired=reason==="expired" && session.status==="expired" && !pi;
    const failed=reason==="failed" && session.status==="complete" && pi && intent?.id===pi && intent.livemode===false &&
      ["canceled","requires_payment_method"].includes(intent.status??"") && intent.amount_received===0 && !intent.latest_charge?.paid;
    if(!expired && !failed)throw new Error("Payment is not conclusively terminal.");
    if(["preparing","open"].includes(row.status)) await c.query("UPDATE contentos_app.ai_topup_purchases SET status=$2,updated_at=now() WHERE id=$1",[id,reason]);
    return {status:row.status==="paid"?"paid":reason};
  });
}

export async function fulfillTopup(id:string,session:LifetimeStripeSession & {livemode?:boolean},intent:LifetimePaymentIntent & {livemode?:boolean}) {
  return commercialTransaction(async c=>{
    const row=(await c.query<Purchase>("SELECT * FROM contentos_app.ai_topup_purchases WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if(!row)throw new Error("Unknown purchase.");
    const pi=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
    if(!validateTopupSession(row,session) || !pi || intent.id!==pi || intent.livemode!==false ||
       intent.currency!=="gbp" || intent.amount!==row.price_pence)throw new Error("Payment identity mismatch.");
    // Any signed reversal seen before the grant blocks issuance permanently.
    if(pi && (await c.query("SELECT 1 FROM contentos_app.ai_topup_reversals WHERE payment_intent_id=$1 LIMIT 1",[pi])).rowCount) {
      if(row.stripe_payment_intent_id && row.stripe_payment_intent_id!==pi)throw new Error("Payment mismatch.");
      await c.query("UPDATE contentos_app.ai_topup_purchases SET status='reversed',stripe_payment_intent_id=$2,updated_at=now() WHERE id=$1",[id,pi]);
      return {status:"reversed"};
    }
    if(!validateTopupPayment(row,session,intent))throw new Error("Unverified test payment.");
    if(row.status==="paid")return {status:"replay"};
    if(!["preparing","open"].includes(row.status))return {status:"terminal"};
    await c.query("UPDATE contentos_app.ai_topup_purchases SET status='paid',stripe_session_id=$2,stripe_payment_intent_id=$3,updated_at=now() WHERE id=$1",[id,session.id,pi]);
    await c.query(`INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,action,credits)
      VALUES($1,$2,$3,'grant',$4)`,[randomUUID(),id,row.account_id,row.credits]);
    return {status:"granted"};
  });
}

/** Any refund or dispute freezes the entire purchase pending manual policy.
 * Consumed credits remain auditable and are not silently deducted elsewhere. */
export async function reverseTopup(pi:string,eventId:string,eventType:string) {
  if(!/^pi_[A-Za-z0-9]+$/.test(pi) || !eventId || !eventType)throw new Error("Invalid reversal.");
  return commercialTransaction(async c=>{
    await c.query("INSERT INTO contentos_app.ai_topup_reversals(event_id,payment_intent_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[eventId,pi,eventType]);
    const row=(await c.query<Purchase>("SELECT * FROM contentos_app.ai_topup_purchases WHERE stripe_payment_intent_id=$1 FOR UPDATE",[pi])).rows[0];
    if(!row)return {status:"recorded"};
    if(row.status==="reversed")return {status:"replay"};
    await c.query("UPDATE contentos_app.ai_topup_purchases SET status='reversed',updated_at=now() WHERE id=$1",[row.id]);
    const held=await c.query<{account_id:string;request_id:string}>("UPDATE contentos_app.ai_topup_reservations SET state='void',updated_at=now() WHERE purchase_id=$1 AND state='reserved' RETURNING account_id,request_id",[row.id]);
    for(const h of held.rows)await c.query("INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,request_id,action,credits) VALUES($1,$2,$3,$4,'void',1)",[randomUUID(),row.id,h.account_id,h.request_id]);
    await c.query("INSERT INTO contentos_app.ai_topup_ledger(id,purchase_id,account_id,action,credits) VALUES($1,$2,$3,'reverse',0)",[randomUUID(),row.id,row.account_id]);
    return {status:"reversed"};
  });
}

export async function topupAccountSummary(accountId:string) {
  const c=await getPool().connect();
  try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const total=await c.query<{available:string}>(`SELECT COALESCE(sum(GREATEST(0,p.credits -
    (SELECT count(*) FROM contentos_app.ai_topup_reservations r WHERE r.purchase_id=p.id AND r.state IN ('reserved','consumed')))),0)::text AS available
    FROM contentos_app.ai_topup_purchases p WHERE p.account_id=$1 AND p.status='paid' AND EXISTS (
      SELECT 1 FROM contentos_app.ai_topup_ledger l WHERE l.purchase_id=p.id AND l.account_id=p.account_id AND l.action='grant' AND l.credits=p.credits)`,[accountId]);
  const rows=await c.query<{id:string;package:string;price_pence:number;credits:number;status:string;created_at:string;consumed:string;reserved:string}>(`
    SELECT p.id,p.package,p.price_pence,p.credits,p.status,p.created_at,
      count(r.request_id) FILTER(WHERE r.state='consumed')::text AS consumed,
      count(r.request_id) FILTER(WHERE r.state='reserved')::text AS reserved
    FROM contentos_app.ai_topup_purchases p LEFT JOIN contentos_app.ai_topup_reservations r ON r.purchase_id=p.id
    WHERE p.account_id=$1 GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100`,[accountId]);
  const history=rows.rows.map(r=>({id:r.id,package:r.package,pricePence:r.price_pence,credits:r.credits,status:r.status,createdAt:r.created_at,consumed:Number(r.consumed),reserved:Number(r.reserved)}));
  await c.query("COMMIT");return {available:Number(total.rows[0].available),history,historyLimit:100};
  }catch(error){await c.query("ROLLBACK").catch(()=>{});throw error;}finally{c.release();}
}
