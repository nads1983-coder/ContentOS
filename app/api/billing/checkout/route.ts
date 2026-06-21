import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEnv, isAppwriteAdminConfigured, isAppwriteConfigured } from "@/lib/env";
import {
  checkoutPlanIsCoveredByState,
  createCheckoutSession,
  BillingPlan,
  FounderCheckoutError,
  getStripeSubscriptionState,
  hasActiveUnknownPaidSubscription,
  reconcileActiveSubscriptionPlan
} from "@/lib/stripe-rest";
import { getUserProfileForUser, syncUserSubscriptionState } from "@/lib/appwrite-rest";
import { hasLifetimeEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { plan, founderOffer } = (await request.json()) as {
    plan?: BillingPlan;
    founderOffer?: boolean;
  };

  if (!plan || !["pro_creator", "pro_studio"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  if (founderOffer && plan !== "pro_creator") {
    return NextResponse.json(
      { error: "Founder discount could not be applied. Please try again." },
      { status: 400 }
    );
  }

  if ((founderOffer || isAppwriteConfigured()) && !user) {
    return NextResponse.json(
      {
        error: "Create an account or log in before upgrading.",
        redirectUrl: `/signup?plan=${plan}${founderOffer ? "&founder=1" : ""}`
      },
      { status: 401 }
    );
  }

  try {
    const profile = user && isAppwriteAdminConfigured()
      ? await getUserProfileForUser(user.id, user.email)
      : null;

    if (profile && hasLifetimeEntitlement(profile)) {
      return NextResponse.json(
        {
          error: "Your lifetime access already includes this plan.",
          redirectUrl: "/dashboard"
        },
        { status: 409 }
      );
    }
    const rawSubscriptionState = await getStripeSubscriptionState({
      stripeCustomerId: profile?.stripe_customer_id,
      stripeSubscriptionId: profile?.stripe_subscription_id,
      email: user?.email
    });
    const subscriptionState = reconcileActiveSubscriptionPlan(rawSubscriptionState, profile?.plan);

    if (user && isAppwriteAdminConfigured()) {
      await syncUserSubscriptionState({
        userId: profile?.id ?? user.id,
        email: user.email,
        ...subscriptionState
      });
    }

    if (checkoutPlanIsCoveredByState(plan, subscriptionState)) {
      return NextResponse.json(
        {
          error: "Your active subscription already includes this plan.",
          redirectUrl: "/dashboard"
        },
        { status: 409 }
      );
    }

    if (hasActiveUnknownPaidSubscription(rawSubscriptionState)) {
      return NextResponse.json(
        {
          error: "You already have an active subscription. Manage billing from your dashboard.",
          redirectUrl: "/dashboard"
        },
        { status: 409 }
      );
    }

    const session = await createCheckoutSession({
      plan,
      userId: user?.id,
      email: user?.email,
      stripeCustomerId: subscriptionState.stripeCustomerId ?? profile?.stripe_customer_id,
      founderOffer: Boolean(founderOffer && plan === "pro_creator")
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (founderOffer) {
      const env = getEnv();
      console.error("[Founder Checkout] Failed to apply founder discount", {
        userId: user?.id,
        email: user?.email,
        couponId: env.stripeFounderCouponId || undefined,
        promotionCodeId: env.stripeFounderPromotionCodeId || undefined,
        error: error instanceof Error ? error.message : "Unknown founder checkout error",
        errorType: error instanceof FounderCheckoutError ? error.name : "StripeCheckoutError"
      });

      return NextResponse.json(
        { error: "Founder discount could not be applied. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 }
    );
  }
}
