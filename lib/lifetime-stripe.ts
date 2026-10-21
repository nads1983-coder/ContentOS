import "server-only";
import { getEnv } from "@/lib/env";
import { stripeGet, stripeRequest } from "@/lib/stripe-rest";
import { commercialTransaction } from "@/lib/commercial-ledger";
import {
  fulfillLifetimePurchase, reconcileLifetimePayment, LifetimePaymentRejected,
  validateLifetimeSessionIdentity, type LifetimePrice, type LifetimeSession, type LifetimePaymentProvider
} from "@/lib/lifetime-payment";

const purchase = "lifetime_access_v1";
type Metadata = { purchase?: string; user_id?: string; attempt_id?: string };
type List<T> = { data: T[]; has_more: boolean };
type Charge = { id: string; paid: boolean; refunded: boolean; amount_refunded: number; disputed: boolean; payment_intent: string; customer: string; amount: number; currency: string; livemode: boolean };
type Payment = { id: string; status: string; amount_received: number; currency: string; customer: string; livemode: boolean; metadata: Metadata; latest_charge: Charge };
export type LifetimeEvent = { id?: string; type: string; livemode?: boolean; data: { object: { id?: string; mode?: string; metadata?: Metadata; payment_intent?: string; charge?: string } } };

function config() {
  const priceId=process.env.STRIPE_LIFETIME_PRICE_ID;
  const mode=process.env.STRIPE_LIFETIME_MODE;
  if(!priceId || !/^price_[a-zA-Z0-9_]+$/.test(priceId) || !["live","test"].includes(mode??"")) throw new Error("Lifetime Stripe configuration is not approved.");
  return {priceId,live:mode==="live"};
}
function id(value: string, prefix: string) {
  if(!new RegExp(`^${prefix}_[a-zA-Z0-9_]+$`).test(value)) throw new LifetimePaymentRejected("Invalid Stripe object identity.");
  return encodeURIComponent(value);
}

export const lifetimeStripeProvider: LifetimePaymentProvider = {
  async price() {
    const {priceId,live}=config();
    const price=await stripeGet<LifetimePrice>(`prices/${id(priceId,"price")}`);
    if(price.id!==priceId || price.livemode!==live) throw new Error("Lifetime price mode or identity mismatch.");
    return price;
  },
  async retrieve(sessionId) {
    const session=await stripeGet<LifetimeSession>(`checkout/sessions/${id(sessionId,"cs")}`,new URLSearchParams([
      ["expand[]","line_items"],["expand[]","payment_intent.latest_charge"]
    ]));
    const charge=session.payment_intent?.latest_charge;
    if(charge?.disputed) {
      if(!charge.id) throw new Error("Missing expanded disputed charge.");
      const disputes=await stripeGet<List<{status:string}>>("disputes",new URLSearchParams({charge:charge.id,limit:"100"}));
      if(disputes.has_more || !disputes.data.length) throw new Error("Incomplete current dispute evidence.");
      // Stripe retains charge.disputed after a won dispute. Resolve it from current dispute objects.
      charge.disputed=disputes.data.some(d=>!["won","warning_closed"].includes(d.status));
    }
    return session;
  },
  async create(input) {
    const {priceId}=config();
    if(input.priceId!==priceId) throw new LifetimePaymentRejected("Lifetime price changed.");
    // Do not trust stale subscription fields or attach an account by email alone.
    if(input.customerId) {
      const customer=await stripeGet<{id:string;deleted?:boolean;metadata?:{user_id?:string}}>(`customers/${id(input.customerId,"cus")}`);
      if(customer.deleted || customer.id!==input.customerId || (customer.metadata?.user_id && customer.metadata.user_id!==input.accountId)) throw new LifetimePaymentRejected("Customer identity requires review.");
      const subscriptions=await stripeGet<List<{status:string}>>("subscriptions",new URLSearchParams({customer:input.customerId,status:"all",limit:"100"}));
      if(subscriptions.has_more || subscriptions.data.some(s=>!["canceled","incomplete_expired"].includes(s.status))) throw new LifetimePaymentRejected("Resolve the existing subscription before purchasing Lifetime. No subscription was changed.");
    } else {
      const customers=await stripeGet<List<{id:string}>>("customers",new URLSearchParams({email:input.email,limit:"1"}));
      if(customers.data.length || customers.has_more) throw new LifetimePaymentRejected("An existing Stripe customer requires account reconciliation before purchase.");
    }
    const origin=new URL(getEnv().appUrl);
    if(origin.protocol!=="https:") throw new Error("Lifetime checkout requires a secure application URL.");
    const body=new URLSearchParams({mode:"payment","line_items[0][price]":priceId,"line_items[0][quantity]":"1",
      client_reference_id:input.accountId,success_url:new URL("/dashboard?lifetime=pending",origin).href,
      cancel_url:new URL("/pricing?lifetime=cancelled",origin).href,"consent_collection[terms_of_service]":"required"});
    if(input.customerId) body.set("customer",input.customerId);
    else {body.set("customer_creation","always");body.set("customer_email",input.email);}
    for(const [key,value] of Object.entries({purchase,user_id:input.accountId,attempt_id:input.attemptId})) {
      body.set(`metadata[${key}]`,value);body.set(`payment_intent_data[metadata][${key}]`,value);
    }
    const created=await stripeRequest<{id:string}>("checkout/sessions",body,{idempotencyKey:input.idempotencyKey});
    // Expanded fresh evidence, not a redirect or an unexpanded create response.
    return lifetimeStripeProvider.retrieve(created.id);
  }
};

// All calls are read-only except fulfillment in Neon. No refund/dispute operation is issued to Stripe.
async function reconcilePayment(event: LifetimeEvent, paymentId: string) {
  const payment=await stripeGet<Payment>(`payment_intents/${id(paymentId,"pi")}`,new URLSearchParams({"expand[]":"latest_charge"}));
  if(payment.metadata?.purchase!==purchase) return;
  const {live}=config(), charge=payment.latest_charge, meta=payment.metadata;
  if(event.livemode!==live || payment.livemode!==live || payment.id!==paymentId || payment.status!=="succeeded" || payment.amount_received!==4900 || payment.currency!=="gbp" ||
    !meta.user_id || !meta.attempt_id || !charge?.paid || charge.payment_intent!==payment.id || charge.customer!==payment.customer || charge.amount!==4900 || charge.currency!=="gbp" || charge.livemode!==live) throw new LifetimePaymentRejected("Invalid Lifetime reversal evidence.");
  // Bind before even recording a reversal, including a webhook delivered before completion.
  const bound=await commercialTransaction(async c=>(await c.query(`SELECT p.checkout_session_id, p.payment_intent_id, p.updated_at::text version, a.data->>'stripe_customer_id' customer
    FROM contentos_app.lifetime_purchases p JOIN contentos_app.profiles a ON a.id=p.account_id
    WHERE p.account_id=$1 AND p.attempt_id=$2`,[meta.user_id,meta.attempt_id])).rows[0]);
  if(!bound || (bound.payment_intent_id && bound.payment_intent_id!==payment.id) || (bound.customer && bound.customer!==payment.customer)) throw new LifetimePaymentRejected("Reversal/account binding is invalid.");
  const snapshot={accountId:meta.user_id,attemptId:meta.attempt_id,version:bound.version};
  const sessions=await stripeGet<List<{id:string}>>("checkout/sessions",new URLSearchParams({payment_intent:payment.id,limit:"2"}));
  if(sessions.has_more || sessions.data.length!==1 || (bound.checkout_session_id && bound.checkout_session_id!==sessions.data[0].id)) throw new LifetimePaymentRejected("Reversal checkout binding is invalid.");
  const session=await lifetimeStripeProvider.retrieve(sessions.data[0].id);
  validateLifetimeSessionIdentity(session,meta.user_id,meta.attempt_id,await lifetimeStripeProvider.price());
  if(session.status!=="complete" || session.payment_status!=="paid" || session.customer!==payment.customer || session.payment_intent?.id!==payment.id) throw new LifetimePaymentRejected("Reversal has no completed purchase.");
  if(charge.refunded || charge.amount_refunded>0) {
    await reconcileLifetimePayment(event.id!,payment.id,"refund",snapshot);return;
  }
  const disputes=await stripeGet<List<{status:string}>>("disputes",new URLSearchParams({charge:charge.id,limit:"100"}));
  if(disputes.has_more) throw new Error("Incomplete dispute evidence; retry required.");
  const adverse=disputes.data.some(d=>!["won","warning_closed"].includes(d.status));
  if(charge.disputed && disputes.data.length===0) throw new Error("Dispute evidence has not reconciled yet.");
  await reconcileLifetimePayment(event.id!,payment.id,adverse?"dispute":"clear",snapshot);
}

export async function handleLifetimeStripeEvent(event: LifetimeEvent): Promise<boolean> {
  const object=event.data.object;
  if(event.type.startsWith("checkout.session.") && object.metadata?.purchase===purchase) {
    if(!event.id || !object.id) throw new LifetimePaymentRejected("Missing Lifetime webhook identity.");
    if(event.livemode!==config().live) throw new LifetimePaymentRejected("Webhook mode mismatch.");
    if(["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type)) {
      const session=await lifetimeStripeProvider.retrieve(object.id);
      if(session.id!==object.id) throw new LifetimePaymentRejected("Checkout identity mismatch.");
      // Delayed payments stay pending; async success will perform full current validation.
      if(session.payment_status!=="paid") {
        if(event.type==="checkout.session.async_payment_succeeded") throw new Error("Asynchronous payment evidence is not consistent yet.");
        return true;
      }
      await fulfillLifetimePurchase(event.id,object.id,lifetimeStripeProvider);
    } else if(["checkout.session.expired","checkout.session.async_payment_failed"].includes(event.type)) {
      const session=await lifetimeStripeProvider.retrieve(object.id);
      validateLifetimeSessionIdentity(session,session.client_reference_id,session.metadata?.attempt_id,await lifetimeStripeProvider.price());
      // Never mark a completed/paid session failed because an older event arrived late.
      if(session.id===object.id && session.status==="expired" && session.payment_status!=="paid") await commercialTransaction(c=>c.query(
        "UPDATE contentos_app.lifetime_purchases SET state='expired',updated_at=now() WHERE account_id=$1 AND attempt_id=$2 AND checkout_session_id=$3 AND state IN ('creating','open')",
        [session.client_reference_id,session.metadata.attempt_id,session.id]));
    }
    return true;
  }
  if(["charge.refunded","charge.dispute.created","charge.dispute.updated","charge.dispute.closed"].includes(event.type)) {
    if(!event.id) throw new LifetimePaymentRejected("Missing reversal event identity.");
    let paymentId=object.payment_intent;
    if(!paymentId && object.charge) paymentId=(await stripeGet<Charge>(`charges/${id(object.charge,"ch")}`)).payment_intent;
    if(paymentId) await reconcilePayment(event,paymentId);
    return true;
  }
  // One-time payments must never enter the existing subscription synchronization fallback.
  return event.type.startsWith("checkout.session.") && object.mode==="payment";
}
