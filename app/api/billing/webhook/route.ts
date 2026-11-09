import { NextResponse } from "next/server";
import {
  expireCheckoutSession,
  retrieveCheckoutSession,
  getStripeSubscriptionState,
  scheduleFounderSubscriptionCancellation,
  retrievePaidLifetimePaymentIntent,
  retrieveLifetimeDisputes,
  verifyStripeSignature
} from "@/lib/stripe-rest";
import { updateSubscriptionStatus } from "@/lib/repository";
import {
  founderCompletedCheckoutSessionQualifies,
  founderOpenCheckoutSessionIsValid,
  founderSubscriptionEntitlementState,
  founderSubscriptionMetadataQualifies,
} from "@/lib/founder-offer";
import { founderClaimRepository } from "@/lib/founder-claim-repository";
import {
  FounderCheckoutUnavailableError,
  founderWebhookActivationStatus,
  handleFounderCheckoutCompleted,
  handleFounderSubscriptionEvent,
  isPermanentFounderActivationError
} from "@/lib/founder-checkout-service";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";
import { completePaidCreatorLifetimePurchase, reversePaidCreatorLifetimePurchase, getLifetimeDecisionRevision } from "@/lib/paid-lifetime-fulfillment";
import { getPaidLifetimeReservation, terminatePaidLifetimeReservation } from "@/lib/paid-lifetime-reservations";
import { validateFailedPaidLifetimeCheckout } from "@/lib/paid-lifetime-stripe";
import { AI_TOPUP_OFFER } from "@/lib/ai-topup-offer";

type StripeWebhookEvent = {
  id?: string;
  livemode?: boolean;
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      subscription?: string;
      status?: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      canceled_at?: number | null;
      customer_email?: string;
      client_reference_id?: string;
      email?: string;
      amount_total?: number | null;
      payment_status?: string;
      payment_intent?: string;
      metadata?: Record<string, string>;
      items?: {
        data: Array<{
          price?: {
            id: string;
          };
        }>;
      };
    };
  };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();

  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(payload);
    if(!event?.type || !event.data?.object) throw new Error("Invalid event");
  } catch {
    return NextResponse.json({error:"Invalid event."},{status:400});
  }
  const object = event.data.object;

  const topupCheckout=["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired"].includes(event.type) && object.metadata?.offer===AI_TOPUP_OFFER.code;
  if(topupCheckout) {
    if(!AI_TOPUP_OFFER.fulfillmentEnabled || event.livemode!==false)return NextResponse.json({error:"Top-up fulfillment is disabled."},{status:503});
    try {
      if(!object.id || !object.metadata?.purchase_id)throw new Error("Missing purchase identity.");
      const review=await import("@/lib/ai-topup-review");
      const revision=await review.getTopupDecisionRevision(object.metadata.purchase_id);
      const session=await retrieveCheckoutSession(object.id);
      const api=await import("@/lib/ai-topup-payments");
      if(event.type==="checkout.session.expired") {
        await api.terminateTopup(object.metadata.purchase_id,session,"expired");
      } else if(event.type==="checkout.session.completed" && session.payment_status==="unpaid") {
        return NextResponse.json({received:true,pending:true});
      } else {
        const pi=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
        if(!pi)throw new Error("Missing payment identity.");
        const intent=await retrievePaidLifetimePaymentIntent(pi);
        if(event.type==="checkout.session.async_payment_failed")await api.terminateTopup(object.metadata.purchase_id,session,"failed",intent);
        else await api.fulfillTopup(object.metadata.purchase_id,session,intent,revision,intent.latest_charge?.disputed && !intent.latest_charge.refunded?await retrieveLifetimeDisputes(pi):[]);
      }
      return NextResponse.json({received:true});
    } catch {return NextResponse.json({error:"Top-up payment requires reconciliation."},{status:503});}
  }

  if(AI_TOPUP_OFFER.fulfillmentEnabled && ["charge.refunded","charge.dispute.created","charge.dispute.updated","charge.dispute.closed"].includes(event.type) && object.payment_intent) {
    try {
      if(event.livemode!==false || !event.id)throw new Error("Test-mode event identity required.");
      const intent=await retrievePaidLifetimePaymentIntent(object.payment_intent);
      if(intent.livemode!==false || intent.id!==object.payment_intent)throw new Error("Test payment identity mismatch.");
      const api=await import("@/lib/ai-topup-payments");
      const review=await import("@/lib/ai-topup-review");
      const disputes=!intent.latest_charge?.refunded && (event.type.startsWith("charge.dispute.") || intent.latest_charge?.disputed) ? await retrieveLifetimeDisputes(object.payment_intent) : [];
      const evidence=review.topupEvidence(intent,disputes);
      if(!evidence.length)throw new Error("Reversal evidence unavailable.");
      for(const e of evidence)await api.reverseTopup(object.payment_intent,event.id,event.type,e);
    } catch {return NextResponse.json({error:"Top-up reversal requires reconciliation."},{status:503});}
  }

  const isLifetimeCheckoutEvent = [
    "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"
  ].includes(event.type) && object.metadata?.offer === PAID_LIFETIME_OFFER.code;
  if (isLifetimeCheckoutEvent) {
    if (!PAID_LIFETIME_OFFER.fulfillmentEnabled) {
      return NextResponse.json({ error: "Paid lifetime fulfillment is not enabled." }, { status: 503 });
    }
    try {
      if (!object.id || !object.metadata?.purchase_id) throw new Error("Missing lifetime purchase identifier.");
      const revision = ["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type)
        ? await getLifetimeDecisionRevision(object.metadata.purchase_id) : undefined;
      const session = await retrieveCheckoutSession(object.id);
      if (event.type === "checkout.session.expired") {
        const claim = await getPaidLifetimeReservation(object.metadata.purchase_id);
        if (!claim || session.id !== claim.stripeCheckoutSessionId || session.status !== "expired" ||
            session.payment_status !== "unpaid" || session.payment_intent) throw new Error("Expiry is uncertain.");
        await terminatePaidLifetimeReservation(claim.id,"expired");
        return NextResponse.json({ received: true });
      }
      if (event.type === "checkout.session.completed" && session.payment_status === "unpaid") {
        // Payment methods with delayed settlement must not grant access yet.
        return NextResponse.json({ received: true, pending: true });
      }
      if (event.type === "checkout.session.async_payment_failed") {
        const claim = await getPaidLifetimeReservation(object.metadata.purchase_id);
        if (!claim || !validateFailedPaidLifetimeCheckout(session, claim)) {
          throw new Error("Failed payment cannot be reconciled to an open reservation.");
        }
        const failedIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        if (!failedIntentId) throw new Error("Failed payment identity is uncertain.");
        const failedIntent = await retrievePaidLifetimePaymentIntent(failedIntentId);
        if (failedIntent.id !== failedIntentId || !["canceled","requires_payment_method"].includes(failedIntent.status ?? "") ||
            failedIntent.amount_received !== 0 || failedIntent.latest_charge?.paid) throw new Error("Payment failure is not terminal.");
        await terminatePaidLifetimeReservation(claim.id, "failed");
        return NextResponse.json({ received: true });
      }
      const intentId = typeof session.payment_intent === "string"
        ? session.payment_intent : session.payment_intent?.id;
      if (!intentId) throw new Error("Missing lifetime payment intent.");
      const intent = await retrievePaidLifetimePaymentIntent(intentId);
      const outcome = await completePaidCreatorLifetimePurchase(object.metadata.purchase_id, session, intent, revision);
      if (outcome.status === "stale_snapshot") throw new Error("Administrator decision changed; refresh Stripe state.");
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("[Lifetime Checkout] Payment verification or fulfillment requires retry", {
        sessionId: object.id, error: error instanceof Error ? error.message : "Unknown error"
      });
      return NextResponse.json({ error: "Lifetime fulfillment requires reconciliation." }, { status: 503 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const isFounderCheckout = founderSubscriptionMetadataQualifies(object.metadata);

    if (isFounderCheckout) {
      try {
        if (!object.id) {
          throw new FounderCheckoutUnavailableError("Founder checkout session id was missing.");
        }

        await handleFounderCheckoutCompleted({
          sessionId: object.id,
          userId: object.client_reference_id ?? object.metadata?.user_id
        }, {
          repository: founderClaimRepository,
          stripe: {
            resolvePromotionCode: async () => {
              throw new Error("Promotion resolution is not used during webhook activation.");
            },
            createCheckoutSession: async () => {
              throw new Error("Checkout creation is not used during webhook activation.");
            },
            retrieveCheckoutSession,
            expireCheckoutSession: async (sessionId) => {
              await expireCheckoutSession(sessionId);
            },
            scheduleCancellation: scheduleFounderSubscriptionCancellation
          },
          validateOpenSession: founderOpenCheckoutSessionIsValid,
          validateCompletedSession: founderCompletedCheckoutSessionQualifies,
          persistFounderEntitlement: async (input) => {
            const updated = await updateSubscriptionStatus({
              userId: input.userId,
              email: input.email,
              ...founderSubscriptionEntitlementState({
                customer: input.customerId,
                subscription: input.subscriptionId,
                sessionId: input.sessionId
              })
            });
            if (updated.length === 0) {
              throw new Error("Founder entitlement profile update did not match an account.");
            }
          }
        });

        console.log("[Founder Checkout] Lifetime entitlement activated", {
          sessionId: object.id,
          userId: object.client_reference_id ?? object.metadata?.user_id,
          amountTotal: object.amount_total
        });
      } catch (error) {
        if (isPermanentFounderActivationError(error)) {
          console.error("[Founder Checkout] Refused permanently invalid founder entitlement", {
            sessionId: object.id,
            userId: object.client_reference_id ?? object.metadata?.user_id,
            amountTotal: object.amount_total,
            paymentStatus: object.payment_status,
            error: error.message
          });

          return NextResponse.json({ received: true });
        }

        console.error("[Founder Checkout] Retryable founder entitlement processing failure", {
          sessionId: object.id,
          userId: object.client_reference_id ?? object.metadata?.user_id,
          amountTotal: object.amount_total,
          paymentStatus: object.payment_status,
          error: error instanceof Error ? error.message : "Unknown founder webhook error"
        });

        return NextResponse.json(
          { error: "Founder entitlement processing failed." },
          { status: founderWebhookActivationStatus(error) }
        );
      }

      return NextResponse.json({ received: true });
    }

    const state = await getStripeSubscriptionState({
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.subscription ?? object.id,
      email: object.customer_email
    });

    console.log("Stripe checkout session subscription sync", {
      userId: object.client_reference_id ?? object.metadata?.user_id,
      email: object.customer_email,
      plan: state.plan,
      status: state.status,
      rawStatus: object.status,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      currentPeriodEnd: state.currentPeriodEnd
    });

    await updateSubscriptionStatus({
      userId: object.client_reference_id ?? object.metadata?.user_id,
      email: object.customer_email,
      ...state
    });
  }

  if (["charge.refunded","charge.dispute.created","charge.dispute.updated","charge.dispute.closed"].includes(event.type) && object.payment_intent) {
    if (!PAID_LIFETIME_OFFER.fulfillmentEnabled) {
      // These events may also belong to unrelated Stripe products. Leave them
      // to existing billing flows while this paid offer is commercially closed.
      return NextResponse.json({ received: true });
    }
    try {
      if (!event.id) throw new Error("Missing Stripe event ID.");
      const intent = await retrievePaidLifetimePaymentIntent(object.payment_intent);
      const charge = intent.latest_charge;
      const reason = charge?.refunded ? "refunded" : event.type.startsWith("charge.dispute.")
        ? "disputed" : "review";
      await reversePaidCreatorLifetimePurchase(object.payment_intent, reason, event.id, event.type);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("[Lifetime Checkout] Refund/dispute reversal requires reconciliation", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return NextResponse.json({ error: "Lifetime reversal requires reconciliation." }, { status: 503 });
    }
  }

  if (
    [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ].includes(event.type)
  ) {
    const isFounderSubscription = founderSubscriptionMetadataQualifies(object.metadata);

    if (isFounderSubscription) {
      const hasCompletedFounderClaim = await handleFounderSubscriptionEvent({
        subscriptionId: object.id
      }, {
        repository: founderClaimRepository,
        stripe: {
          resolvePromotionCode: async () => {
            throw new Error("Promotion resolution is not used during subscription webhooks.");
          },
          createCheckoutSession: async () => {
            throw new Error("Checkout creation is not used during subscription webhooks.");
          },
          retrieveCheckoutSession,
          expireCheckoutSession: async (sessionId) => {
            await expireCheckoutSession(sessionId);
          },
          scheduleCancellation: scheduleFounderSubscriptionCancellation
        },
        validateOpenSession: founderOpenCheckoutSessionIsValid,
        validateCompletedSession: founderCompletedCheckoutSessionQualifies,
        persistFounderEntitlement: async (input) => {
          const updated = await updateSubscriptionStatus({
            userId: input.userId,
            email: input.email,
            ...founderSubscriptionEntitlementState({
              customer: input.customerId,
              subscription: input.subscriptionId,
              sessionId: input.sessionId
            })
          });
          if (updated.length === 0) {
            throw new Error("Founder entitlement profile update did not match an account.");
          }
        }
      });

      if (!hasCompletedFounderClaim) {
        console.warn("[Founder Checkout] Ignored founder subscription event before checkout confirmation", {
          subscriptionId: object.id,
          userId: object.metadata?.user_id
        });
      }

      return NextResponse.json({ received: true });
    }

    // Even deletion events can arrive after a replacement subscription. Never
    // overwrite current entitlements using the event's historical snapshot.
    const state = await getStripeSubscriptionState({
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.id
    });

    console.log("Stripe subscription event sync", {
      eventType: event.type,
      userId: object.metadata?.user_id,
      email: object.customer_email,
      rawStatus: object.status,
      plan: state.plan,
      status: state.status,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      rawCancelAtPeriodEnd: object.cancel_at_period_end,
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      currentPeriodEnd: state.currentPeriodEnd
    });

    await updateSubscriptionStatus({
      userId: object.metadata?.user_id,
      email: object.customer_email,
      ...state
    });
  }

  if (event.type === "invoice.paid") {
    const state = await getStripeSubscriptionState({
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.subscription,
      email: object.customer_email ?? object.email
    });

    console.log("Stripe invoice paid subscription sync", {
      userId: object.metadata?.user_id,
      email: object.customer_email ?? object.email,
      plan: state.plan,
      status: state.status,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      currentPeriodEnd: state.currentPeriodEnd
    });

    await updateSubscriptionStatus({
      userId: object.metadata?.user_id,
      email: object.customer_email ?? object.email,
      ...state
    });
  }

  return NextResponse.json({ received: true });
}
