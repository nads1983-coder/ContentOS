import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  checkoutPlanMatchesState,
  createCheckoutSession,
  BillingPlan,
  getStripeSubscriptionState
} from "@/lib/stripe-rest";
import { getUserProfile, syncUserSubscriptionState } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { plan } = (await request.json()) as { plan?: BillingPlan };

  if (!plan || !["pro_creator", "pro_studio"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  if (isSupabaseConfigured() && !user) {
    return NextResponse.json(
      {
        error: "Create an account or log in before upgrading.",
        redirectUrl: `/signup?plan=${plan}`
      },
      { status: 401 }
    );
  }

  try {
    const profile = user && isSupabaseAdminConfigured()
      ? await getUserProfile(user.id)
      : null;
    const subscriptionState = await getStripeSubscriptionState({
      stripeCustomerId: profile?.stripe_customer_id,
      stripeSubscriptionId: profile?.stripe_subscription_id,
      email: user?.email
    });

    if (user && isSupabaseAdminConfigured()) {
      await syncUserSubscriptionState({
        userId: user.id,
        email: user.email,
        ...subscriptionState
      });
    }

    if (checkoutPlanMatchesState(plan, subscriptionState)) {
      return NextResponse.json(
        { error: "You already have an active subscription for this plan." },
        { status: 409 }
      );
    }

    const session = await createCheckoutSession({
      plan,
      userId: user?.id,
      email: user?.email,
      stripeCustomerId: subscriptionState.stripeCustomerId ?? profile?.stripe_customer_id
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 }
    );
  }
}
