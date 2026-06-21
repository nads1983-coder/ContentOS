import { NextResponse } from "next/server";
import {
  getStripeSubscriptionState,
  scheduleFounderSubscriptionCancellation,
  stripeSubscriptionToState,
  verifyStripeSignature
} from "@/lib/stripe-rest";
import { updateSubscriptionStatus } from "@/lib/appwrite-rest";
import { FOUNDER_OFFER_ENTITLEMENT_SOURCE } from "@/lib/entitlements";

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

  const event = JSON.parse(payload) as StripeWebhookEvent;
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    const isFounderCheckout =
      object.metadata?.offer === "founder" &&
      object.metadata?.founder_offer === "true" &&
      object.metadata?.expected_total === "0";

    if (isFounderCheckout) {
      if (object.amount_total !== 0) {
        console.error("[Founder Checkout] Refused non-zero founder entitlement", {
          sessionId: object.id,
          userId: object.client_reference_id ?? object.metadata?.user_id,
          amountTotal: object.amount_total,
          paymentStatus: object.payment_status
        });
      } else {
        if (object.subscription) {
          await scheduleFounderSubscriptionCancellation(object.subscription);
        }

        await updateSubscriptionStatus({
          userId: object.client_reference_id ?? object.metadata?.user_id,
          email: object.customer_email,
          plan: "founder",
          status: "active",
          stripeCustomerId: object.customer,
          stripeSubscriptionId: object.subscription,
          stripeCheckoutSessionId: object.id,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          entitlementSource: FOUNDER_OFFER_ENTITLEMENT_SOURCE,
          amountPaid: 0
        });

        console.log("[Founder Checkout] Lifetime entitlement activated", {
          sessionId: object.id,
          userId: object.client_reference_id ?? object.metadata?.user_id,
          amountTotal: object.amount_total
        });
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

  if (
    [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ].includes(event.type)
  ) {
    const isFounderSubscription =
      object.metadata?.offer === "founder" &&
      object.metadata?.founder_offer === "true" &&
      object.metadata?.expected_total === "0";

    if (isFounderSubscription) {
      await updateSubscriptionStatus({
        userId: object.metadata?.user_id,
        email: object.customer_email,
        plan: "founder",
        status: "active",
        stripeCustomerId: object.customer,
        stripeSubscriptionId: object.id,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        entitlementSource: FOUNDER_OFFER_ENTITLEMENT_SOURCE
      });

      return NextResponse.json({ received: true });
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
