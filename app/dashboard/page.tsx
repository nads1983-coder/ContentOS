import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { CheckoutButton, ManageBillingButton } from "@/components/billing-buttons";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured, usesPostgres } from "@/lib/backend";
import { isStripeConfigured } from "@/lib/env";
import {
  getStripeSubscriptionState,
  normalizePlanId,
  normalizeSubscriptionStatus,
  planHasActiveEntitlement,
  reconcileActiveSubscriptionPlan,
  retrieveStripeSubscription,
  stripeSubscriptionToState
} from "@/lib/stripe-rest";
import {
  getUserProfileForUser,
  getMonthlyUsageCount,
  listBrandProfiles,
  syncUserSubscriptionState,
  upsertUserProfile
} from "@/lib/repository";
import { buildUsageSummary } from "@/lib/usage";
import { BrandProfile, PlanId, UserProfile } from "@/types/saas";
import { hasLifetimeEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ContentOS Dashboard",
  robots: {
    index: false,
    follow: false
  }
};

const planLabels: Record<PlanId, string> = {
  free: "Free",
  founder: "Founder",
  pro_creator: "Pro Creator",
  pro_studio: "Pro Studio"
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function fallbackProfileForUser(user: { id: string; email: string }): UserProfile {
  return {
    id: user.id,
    email: user.email,
    plan: "free",
    subscription_status: "none",
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    subscription_canceled_at: null
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    if (usesPostgres()) redirect("/login");
    return (
      <main className="grid min-h-screen place-items-center overflow-x-hidden px-4 py-10 text-bone">
        <section className="w-full max-w-lg rounded border border-white/10 bg-panel/78 p-6 shadow-violet">
          <BrandLogo />
          <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">
            Login required
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Create an account or log in to view usage, billing, saved content, and brand profiles.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className="rounded border border-violet/70 bg-violet px-4 py-3 text-sm font-semibold text-white" href="/signup">
              Sign up
            </Link>
            <Link className="rounded border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-bone" href="/login">
              Log in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  let profile: UserProfile | null = null;

  if (isDatabaseConfigured()) {
    try {
      profile = await getUserProfileForUser(user.id, user.email);

      if (!profile) {
        profile = await upsertUserProfile({ id: user.id, email: user.email });
      }
    } catch {
      console.warn("Dashboard profile fetch/upsert failed. Rendering fallback billing state.");
      profile = fallbackProfileForUser(user);
    }
  }

  if (profile && isStripeConfigured() && !hasLifetimeEntitlement(profile)) {
    try {
      const subscriptionState = reconcileActiveSubscriptionPlan(await getStripeSubscriptionState({
        stripeCustomerId: profile.stripe_customer_id,
        stripeSubscriptionId: profile.stripe_subscription_id,
        email: user.email
      }), profile.plan);

      profile = await syncUserSubscriptionState({
        userId: profile.id,
        email: user.email,
        ...subscriptionState
      }) ?? {
        ...profile,
        plan: subscriptionState.plan,
        subscription_status: subscriptionState.status,
        stripe_customer_id: subscriptionState.stripeCustomerId,
        stripe_subscription_id: subscriptionState.stripeSubscriptionId,
        subscription_current_period_end: subscriptionState.currentPeriodEnd,
        subscription_cancel_at_period_end: subscriptionState.cancelAtPeriodEnd,
        subscription_canceled_at: subscriptionState.canceledAt
      };
    } catch {
      console.warn("Dashboard Stripe subscription sync failed");
      // Keep the stored profile if Stripe is temporarily unavailable.
    }
  }

  const normalizedStoredStatus = normalizeSubscriptionStatus(profile?.subscription_status);
  const shouldBackfillRenewalDate =
    profile?.stripe_subscription_id &&
    (normalizedStoredStatus === "active" || normalizedStoredStatus === "trialing") &&
    !profile.subscription_current_period_end &&
    isStripeConfigured();

  if (profile && shouldBackfillRenewalDate) {
    try {
      const stripeSubscriptionId = profile.stripe_subscription_id;

      if (!stripeSubscriptionId) {
        throw new Error("Missing Stripe subscription ID.");
      }

      const subscription = await retrieveStripeSubscription(stripeSubscriptionId);
      const subscriptionState = stripeSubscriptionToState(subscription);

      if (subscriptionState.currentPeriodEnd) {
        profile = await syncUserSubscriptionState({
          userId: profile.id,
          email: user.email,
          plan: normalizePlanId(profile.plan),
          status: normalizedStoredStatus,
          stripeCustomerId: profile.stripe_customer_id ?? subscriptionState.stripeCustomerId,
          stripeSubscriptionId: profile.stripe_subscription_id,
          currentPeriodEnd: subscriptionState.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionState.cancelAtPeriodEnd,
          canceledAt: subscriptionState.canceledAt
        }) ?? {
          ...profile,
          subscription_current_period_end: subscriptionState.currentPeriodEnd,
          subscription_cancel_at_period_end: subscriptionState.cancelAtPeriodEnd,
          subscription_canceled_at: subscriptionState.canceledAt
        };
      }
    } catch {
      console.warn("Dashboard renewal date backfill failed");
    }
  }

  const profileUserId = profile?.id ?? user.id;
  let brandProfiles: BrandProfile[] = [];

  if (isDatabaseConfigured()) {
    try {
      brandProfiles = await listBrandProfiles(profileUserId);
    } catch {
      console.warn("Dashboard brand profile fetch failed");
    }
  }
  const plan = normalizePlanId(profile?.plan);
  const status = normalizeSubscriptionStatus(profile?.subscription_status);
  const hasLifetimeAccess = hasLifetimeEntitlement(profile);
  const hasActiveSubscription = planHasActiveEntitlement(plan, status);
  const canUpgradeToCreator = !hasActiveSubscription;
  const canUpgradeToStudio = !(hasActiveSubscription && plan === "pro_studio");
  let monthlyUsageCount = 0;

  if (isDatabaseConfigured()) {
    try {
      monthlyUsageCount = await getMonthlyUsageCount({
        userId: profileUserId,
        periodEnd: profile?.subscription_current_period_end
      });
    } catch {
      console.warn("Dashboard usage fetch failed");
    }
  }

  const usage = buildUsageSummary(plan, monthlyUsageCount, profile?.subscription_current_period_end);

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-6 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo />
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/studio" className="text-sm text-muted hover:text-bone">
              Back to workspace
            </Link>
            <LogoutButton className="text-sm text-muted hover:text-bone" />
          </div>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="min-w-0 rounded border border-white/10 bg-panel/78 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Current plan
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-bone">{planLabels[plan]}</h1>
            <p className="mt-2 text-sm text-muted">
              Status: {profile?.subscription_cancel_at_period_end && hasActiveSubscription
                ? `${status} / canceling at period end`
                : status}
            </p>
            <p className="mt-2 text-sm text-muted">
              {hasLifetimeAccess
                ? "Access: Lifetime / no expiry"
                : `${profile?.subscription_cancel_at_period_end && hasActiveSubscription
                  ? "Paid until"
                  : "Renewal date"}: ${formatDate(profile?.subscription_current_period_end)}`}
            </p>
            {profile?.subscription_cancel_at_period_end ? (
              <p className="mt-2 rounded border border-gold/40 bg-gold/10 p-3 text-sm text-bone">
                Cancellation pending. Access remains active until {formatDate(profile.subscription_current_period_end)}.
              </p>
            ) : null}
            <div className="mt-5 grid gap-3">
              {canUpgradeToCreator ? (
                <CheckoutButton plan="pro_creator">Upgrade to Pro Creator</CheckoutButton>
              ) : null}
              {canUpgradeToStudio ? (
                <CheckoutButton plan="pro_studio">
                  {plan === "pro_creator" ? "Upgrade to Pro Studio" : "Upgrade to Pro Studio"}
                </CheckoutButton>
              ) : null}
              {!canUpgradeToCreator && !canUpgradeToStudio ? (
                <p className="rounded border border-white/10 bg-white/[0.035] p-3 text-sm text-muted">
                  {hasLifetimeAccess ? "Your lifetime Pro Studio access is active." : "Your current plan is active."}
                </p>
              ) : null}
              {profile?.stripe_customer_id ? <ManageBillingButton /> : null}
            </div>
          </article>

          <article className="min-w-0 rounded border border-white/10 bg-coal/86 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Usage
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{usage.used} / {usage.limit}</h2>
            <p className="mt-2 text-sm text-muted">
              {usage.plan === "free"
                ? `${usage.used} of ${usage.limit} free generations used. ${usage.remaining} free generations remaining.`
                : `${usage.used} of ${usage.limit} monthly generations used. ${usage.remaining} monthly generations remaining.`}
            </p>
            <p className="mt-2 text-sm text-muted">
              Monthly generations reset on {new Date(usage.periodEnd).toLocaleDateString()}.
            </p>
          </article>

          <article className="min-w-0 rounded border border-white/10 bg-coal/86 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Account
            </p>
            <h2 className="mt-3 break-all text-lg font-semibold">{user.email}</h2>
            <p className="mt-2 text-sm text-muted">
              Secure account session active.
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="min-w-0 rounded border border-white/10 bg-panel/78 p-5">
            <h2 className="text-xl font-semibold">Brand profiles</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Store brand name, audience, offer, tone, CTA style, platforms, and writing preferences.
            </p>
            <div className="mt-4 grid gap-2">
              {brandProfiles.length ? (
                brandProfiles.map((profileItem) => (
                  <div key={profileItem.id} className="rounded border border-white/10 bg-white/[0.035] p-3">
                    <p className="font-semibold">{profileItem.name}</p>
                    <p className="mt-1 text-sm text-muted">{profileItem.audience}</p>
                  </div>
                ))
              ) : (
                <p className="rounded border border-white/10 bg-white/[0.035] p-3 text-sm text-muted">
                  No brand profiles yet.
                </p>
              )}
            </div>
          </article>

          <article className="min-w-0 rounded border border-white/10 bg-panel/78 p-5">
            <h2 className="text-xl font-semibold">Recent generations</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Your generation history is stored securely with your account. Recent work is also available in the workspace.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
