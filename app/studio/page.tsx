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
import { getUserProfile, syncUserSubscriptionState } from "@/lib/supabase-rest";
import { PlanId } from "@/types/saas";

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

async function getInitialStudioState(): Promise<{ plan: PlanId; authenticated: boolean }> {
  const user = await getCurrentUser();

  if (!user || !isSupabaseAdminConfigured()) {
    return { plan: "free", authenticated: Boolean(user) };
  }

  const profile = await getUserProfile(user.id);

  if (!profile) {
    return { plan: "free", authenticated: true };
  }

  if (isStripeConfigured()) {
    try {
      const subscriptionState = reconcileActiveSubscriptionPlan(await getStripeSubscriptionState({
        stripeCustomerId: profile.stripe_customer_id,
        stripeSubscriptionId: profile.stripe_subscription_id,
        email: user.email
      }), profile.plan);

      const synced = await syncUserSubscriptionState({
        userId: user.id,
        email: user.email,
        ...subscriptionState
      });
      const syncedPlan = normalizePlanId(synced?.plan ?? subscriptionState.plan);
      const syncedStatus = normalizeSubscriptionStatus(
        synced?.subscription_status ?? subscriptionState.status
      );

      if (planHasActiveEntitlement(syncedPlan, syncedStatus)) {
        return { plan: syncedPlan, authenticated: true };
      }
    } catch {
      // Use stored Supabase state if Stripe is temporarily unavailable.
    }
  }

  const plan = normalizePlanId(profile.plan);
  const status = normalizeSubscriptionStatus(profile.subscription_status);
  return {
    plan: planHasActiveEntitlement(plan, status) ? plan : "free",
    authenticated: true
  };
}

export default async function StudioPage() {
  const initialState = await getInitialStudioState();

  return <StudioShell initialPlan={initialState.plan} authenticated={initialState.authenticated} />;
}
