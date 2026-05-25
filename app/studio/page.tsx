import type { Metadata } from "next";
import { StudioShell } from "@/components/studio-shell";
import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured, isSupabaseAdminConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";
import {
  getStripeSubscriptionState,
  normalizePlanId,
  normalizeSubscriptionStatus,
  planHasActiveEntitlement,
  reconcileActiveSubscriptionPlan
} from "@/lib/stripe-rest";
import { getMonthlyUsageCount, getUserProfileForUser, syncUserSubscriptionState } from "@/lib/supabase-rest";
import { buildUsageSummary } from "@/lib/usage";
import type { PlanId, UsageSummary, UserProfile } from "@/types/saas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ContentOS Studio | AI Content Workspace",
  description: "Generate, format, repurpose, and save platform-ready social content packs in ContentOS Studio.",
  alternates: {
    canonical: absoluteUrl("/studio")
  },
  robots: {
    index: false,
    follow: false
  }
};

async function usageForProfile(profile: UserProfile | null, plan: PlanId): Promise<UsageSummary> {
  if (!profile || !isSupabaseAdminConfigured()) {
    return buildUsageSummary(plan, 0);
  }

  try {
    const used = await getMonthlyUsageCount({
      userId: profile.id,
      periodEnd: profile.subscription_current_period_end
    });

    return buildUsageSummary(plan, used, profile.subscription_current_period_end);
  } catch (error) {
    console.warn("Studio usage fetch failed", {
      userId: profile.id,
      error
    });
    return buildUsageSummary(plan, 0, profile.subscription_current_period_end);
  }
}

async function getInitialStudioState(): Promise<{ plan: PlanId; authenticated: boolean; usage: UsageSummary }> {
  const user = await getCurrentUser();

  if (!user || !isSupabaseAdminConfigured()) {
    return { plan: "free", authenticated: Boolean(user), usage: buildUsageSummary("free", 0) };
  }

  let profile: UserProfile | null = null;

  try {
    profile = await getUserProfileForUser(user.id, user.email);
  } catch (error) {
    console.warn("Studio profile fetch failed", {
      userId: user.id,
      authenticatedEmail: user.email,
      error
    });
  }

  if (!profile) {
    return { plan: "free", authenticated: true, usage: buildUsageSummary("free", 0) };
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
      const syncedPlan = normalizePlanId(synced?.plan ?? subscriptionState.plan);
      const syncedStatus = normalizeSubscriptionStatus(
        synced?.subscription_status ?? subscriptionState.status
      );

      if (planHasActiveEntitlement(syncedPlan, syncedStatus)) {
        return {
          plan: syncedPlan,
          authenticated: true,
          usage: await usageForProfile(synced ?? profile, syncedPlan)
        };
      }
    } catch {
      // Use stored Supabase state if Stripe is temporarily unavailable.
    }
  }

  const plan = normalizePlanId(profile.plan);
  const status = normalizeSubscriptionStatus(profile.subscription_status);
  return {
    plan: planHasActiveEntitlement(plan, status) ? plan : "free",
    authenticated: true,
    usage: await usageForProfile(profile, planHasActiveEntitlement(plan, status) ? plan : "free")
  };
}

export default async function StudioPage() {
  const initialState = await getInitialStudioState();

  return (
    <StudioShell
      initialPlan={initialState.plan}
      authenticated={initialState.authenticated}
      initialUsage={initialState.usage}
    />
  );
}
