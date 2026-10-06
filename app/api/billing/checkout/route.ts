import { rejectUnsafeWrite } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured, isAuthConfigured } from "@/lib/backend";
import {
  founderCompletedCheckoutSessionQualifies,
  founderOpenCheckoutSessionIsValid,
  founderSubscriptionEntitlementState,
  FounderOfferUnavailableError
} from "@/lib/founder-offer";
import {
  checkoutPlanIsCoveredByState,
  createCheckoutSession,
  BillingPlan,
  expireCheckoutSession,
  getFounderOfferAvailability,
  getStripeSubscriptionState,
  hasActiveUnknownPaidSubscription,
  reconcileActiveSubscriptionPlan,
  retrieveCheckoutSession,
  scheduleFounderSubscriptionCancellation
} from "@/lib/stripe-rest";
import { founderClaimRepository } from "@/lib/founder-claim-repository";
import {
  FounderCheckoutUnavailableError,
  FounderClaimConflictError,
  startFounderCheckout
} from "@/lib/founder-checkout-service";
import { getUserProfileForUser, syncUserSubscriptionState, updateSubscriptionStatus } from "@/lib/repository";
import { hasLifetimeEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;

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

  if ((founderOffer || isAuthConfigured()) && !user) {
    return NextResponse.json(
      {
        error: "Create an account or log in before upgrading.",
        redirectUrl: `/signup?plan=${plan}${founderOffer ? "&founder=1" : ""}`
      },
      { status: 401 }
    );
  }

  try {
    const profile = user && isDatabaseConfigured()
      ? await getUserProfileForUser(user.id, user.email)
      : null;

    if (founderOffer && !isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "Founder checkout is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    if (profile && hasLifetimeEntitlement(profile)) {
      return NextResponse.json(
        {
          error: "Your lifetime access already includes this plan.",
          redirectUrl: "/dashboard"
        },
        { status: 409 }
      );
    }

    if (founderOffer) {
      const result = await startFounderCheckout({
        userId: profile?.id ?? user?.id ?? "",
        email: user?.email ?? "",
        stripeCustomerId: profile?.stripe_customer_id,
        alreadyEntitled: Boolean(profile && hasLifetimeEntitlement(profile)),
        alreadyPaid: Boolean(
          profile &&
            profile.subscription_status === "active" &&
            profile.plan !== "free" &&
            !hasLifetimeEntitlement(profile)
        )
      }, {
        repository: founderClaimRepository,
        stripe: {
          resolvePromotionCode: getFounderOfferAvailability,
          createCheckoutSession: (input) =>
            createCheckoutSession({
              plan: "pro_creator",
              userId: input.userId,
              email: input.email,
              stripeCustomerId: input.stripeCustomerId ?? undefined,
              founderOffer: true,
              founderPromotionCodeId: input.promotionCodeId,
              idempotencyKey: input.idempotencyKey
            }),
          retrieveCheckoutSession,
          expireCheckoutSession: async (sessionId) => {
            await expireCheckoutSession(sessionId);
          },
          scheduleCancellation: scheduleFounderSubscriptionCancellation
        },
        validateOpenSession: founderOpenCheckoutSessionIsValid,
        validateCompletedSession: founderCompletedCheckoutSessionQualifies,
        persistFounderEntitlement: async (input) => {
          await updateSubscriptionStatus({
            userId: input.userId,
            email: input.email,
            ...founderSubscriptionEntitlementState({
              customer: input.customerId,
              subscription: input.subscriptionId,
              sessionId: input.sessionId
            })
          });
        }
      });

      return NextResponse.json({ url: result.url });
    }

    const rawSubscriptionState = await getStripeSubscriptionState({
      stripeCustomerId: profile?.stripe_customer_id,
      stripeSubscriptionId: profile?.stripe_subscription_id,
      email: user?.email
    });
    const subscriptionState = reconcileActiveSubscriptionPlan(rawSubscriptionState, profile?.plan);

    if (user && isDatabaseConfigured()) {
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
      founderOffer: false
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (founderOffer) {
      console.error("[Founder Checkout] Failed to apply founder discount", {
        userId: user?.id,
        email: user?.email,
        error: error instanceof Error ? error.message : "Unknown founder checkout error",
        errorType: error instanceof Error ? error.name : "StripeCheckoutError"
      });

      if (error instanceof FounderClaimConflictError) {
        return NextResponse.json(
          { error: error.message, redirectUrl: error.redirectUrl },
          { status: error.status }
        );
      }

      if (
        error instanceof FounderOfferUnavailableError ||
        error instanceof FounderCheckoutUnavailableError
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }

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
