import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe-rest";
import { updateSubscriptionStatus } from "@/lib/supabase-rest";
import { PlanId } from "@/types/saas";

type StripeWebhookEvent = {
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      subscription?: string;
      status?: string;
      customer_email?: string;
      client_reference_id?: string;
      metadata?: Record<string, string>;
    };
  };
};

function planFromMetadata(value?: string): PlanId {
  if (value === "pro_studio") {
    return "pro_studio";
  }

  if (value === "pro_creator") {
    return "pro_creator";
  }

  return "free";
}

export async function POST(request: Request) {
  const payload = await request.text();

  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeWebhookEvent;
  const object = event.data.object;

  if (
    [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ].includes(event.type)
  ) {
    const status = event.type === "customer.subscription.deleted"
      ? "canceled"
      : object.status ?? "active";

    await updateSubscriptionStatus({
      userId: object.client_reference_id ?? object.metadata?.user_id,
      email: object.customer_email,
      plan: planFromMetadata(object.metadata?.plan),
      status,
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.subscription ?? object.id
    });
  }

  return NextResponse.json({ received: true });
}
