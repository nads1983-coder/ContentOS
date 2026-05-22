import { NextResponse } from "next/server";
import {
  getStripeSubscriptionState,
  stripeSubscriptionToState,
  verifyStripeSignature
} from "@/lib/stripe-rest";
import { updateSubscriptionStatus } from "@/lib/supabase-rest";

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

  return NextResponse.json({ received: true });
}
