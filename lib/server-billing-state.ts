import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured, isSupabaseAdminConfigured } from "@/lib/env";
import {
  getStripeSubscriptionState,
  normalizePlanId,
  normalizeSubscriptionStatus,
  planHasActiveEntitlement,
  reconcileActiveSubscriptionPlan
} from "@/lib/stripe-rest";
import { getUserProfileForUser, syncUserSubscriptionState } from "@/lib/supabase-rest";
import { PlanId, SubscriptionStatus, UserProfile } from "@/types/saas";

export type ServerBillingState = {
  isLoggedIn: boolean;
  plan: PlanId;
  status: SubscriptionStatus;
};

export async function getServerBillingState(): Promise<ServerBillingState> {
  const user = await getCurrentUser();

  if (!user || !isSupabaseAdminConfigured()) {
    return {
      isLoggedIn: Boolean(user),
      plan: "free",
      status: "none"
    };
  }

  let profile: UserProfile | null = null;

  try {
    profile = await getUserProfileForUser(user.id, user.email);
  } catch (error) {
    console.warn("Server billing profile fetch failed", {
      userId: user.id,
      authenticatedEmail: user.email,
      error
    });
  }

  if (!profile) {
    return {
      isLoggedIn: true,
      plan: "free",
      status: "none"
    };
  }

  if (isStripeConfigured()) {
    try {
      const subscriptionState = reconcileActiveSubscriptionPlan(await getStripeSubscriptionState({
        stripeCustomerId: profile.stripe_customer_id,
        stripeSubscriptionId: profile.stripe_subscription_id,
        email: user.email
      }), profile.plan);

      const synced = await syncUserSubscriptionState({
        userId: profile.id,
        email: user.email,
        ...subscriptionState
      });
      const plan = normalizePlanId(synced?.plan ?? subscriptionState.plan);
      const status = normalizeSubscriptionStatus(synced?.subscription_status ?? subscriptionState.status);

      return {
        isLoggedIn: true,
        plan: planHasActiveEntitlement(plan, status) ? plan : "free",
        status
      };
    } catch {
      // Public CTAs should still render if Stripe is temporarily unavailable.
    }
  }

  const plan = normalizePlanId(profile.plan);
  const status = normalizeSubscriptionStatus(profile.subscription_status);

  return {
    isLoggedIn: true,
    plan: planHasActiveEntitlement(plan, status) ? plan : "free",
    status
  };
}
