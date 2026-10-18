import { NextResponse } from "next/server";
import {
  expireCheckoutSession,
  retrieveCheckoutSession,
  getStripeSubscriptionState,
  scheduleFounderSubscriptionCancellation,
  stripeSubscriptionToState,
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

type StripeWebhookEvent = {
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
  try { event = JSON.parse(payload) as StripeWebhookEvent; }
  catch { return NextResponse.json({ error: "Invalid event payload." }, { status: 400 }); }
  if (!event || typeof event.type !== "string" || !event.data?.object || typeof event.data.object !== "object") {
    return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
  }
  const object = event.data.object;

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

        console.log("billing.founder_activation", { status: "activated", count: 1 });
      } catch (error) {
        if (isPermanentFounderActivationError(error)) {
          console.error("billing.founder_activation", { status: "permanently_rejected", count: 1 });

          return NextResponse.json({ received: true });
        }

        console.error("billing.founder_activation", { status: "retryable_failure", count: 1 });

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

    console.log("billing.checkout_sync", { status: "resolved", count: 1 });

    await updateSubscriptionStatus({
      userId: object.client_reference_id ?? object.metadata?.user_id,
      email: object.customer_email,
      ...state
    });
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
        console.warn("billing.founder_subscription", { status: "unconfirmed_ignored", count: 1 });
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "customer.subscription.deleted" && !object.id) {
      return NextResponse.json({ error: "Missing subscription identity." }, { status: 400 });
    }
    const fallbackState = stripeSubscriptionToState({
      id: object.id ?? "",
      customer: object.customer ?? "",
      status: event.type === "customer.subscription.deleted" ? "canceled" : object.status ?? "active",
      current_period_end: object.current_period_end,
      cancel_at_period_end: object.cancel_at_period_end,
      canceled_at: object.canceled_at,
      metadata: object.metadata,
      items: object.items
    });
    const state = event.type === "customer.subscription.deleted"
      ? fallbackState
      : await getStripeSubscriptionState({
        stripeCustomerId: object.customer,
        stripeSubscriptionId: object.id
      });

    console.log("billing.subscription_sync", { status: "resolved", count: 1 });

    await updateSubscriptionStatus({
      userId: object.metadata?.user_id,
      email: object.customer_email,
      ...state,
      ...(event.type === "customer.subscription.deleted" ? { expectedStripeSubscriptionId: object.id } : {})
    });
  }

  if (event.type === "invoice.paid") {
    const state = await getStripeSubscriptionState({
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.subscription,
      email: object.customer_email ?? object.email
    });

    console.log("billing.invoice_sync", { status: "resolved", count: 1 });

    await updateSubscriptionStatus({
      userId: object.metadata?.user_id,
      email: object.customer_email ?? object.email,
      ...state
    });
  }

  return NextResponse.json({ received: true });
}
