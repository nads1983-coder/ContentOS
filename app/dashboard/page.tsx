import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CheckoutButton, ManageBillingButton } from "@/components/billing-buttons";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { getUserProfile, listBrandProfiles } from "@/lib/supabase-rest";
import { buildUsageSummary } from "@/lib/usage";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10 text-bone">
        <section className="w-full max-w-lg rounded border border-white/10 bg-panel/78 p-6 shadow-violet">
          <BrandLogo />
          <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">
            Login required
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Create an account or log in to view usage, billing, saved content, and brand profiles.
          </p>
          <div className="mt-6 flex gap-3">
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

  const profile = isSupabaseAdminConfigured() ? await getUserProfile(user.id) : null;
  const brandProfiles = isSupabaseAdminConfigured() ? await listBrandProfiles(user.id) : [];
  const plan = profile?.plan ?? "free";
  const usage = buildUsageSummary(plan, 0);

  return (
    <main className="min-h-screen px-4 py-6 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo />
          <Link href="/" className="text-sm text-muted hover:text-bone">
            Back to workspace
          </Link>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <article className="rounded border border-white/10 bg-panel/78 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Current plan
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-bone">{plan.replace("_", " ")}</h1>
            <p className="mt-2 text-sm text-muted">
              Status: {profile?.subscription_status ?? "none"}
            </p>
            <div className="mt-5 grid gap-3">
              <CheckoutButton plan="pro_creator">Upgrade to Pro Creator</CheckoutButton>
              <CheckoutButton plan="pro_studio">Upgrade to Pro Studio</CheckoutButton>
              {profile?.stripe_customer_id ? <ManageBillingButton /> : null}
            </div>
          </article>

          <article className="rounded border border-white/10 bg-coal/86 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Usage
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{usage.used} / {usage.limit}</h2>
            <p className="mt-2 text-sm text-muted">
              Monthly generations reset on {new Date(usage.periodEnd).toLocaleDateString()}.
            </p>
          </article>

          <article className="rounded border border-white/10 bg-coal/86 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Account
            </p>
            <h2 className="mt-3 text-lg font-semibold">{user.email}</h2>
            <p className="mt-2 text-sm text-muted">
              Supabase Auth session active.
            </p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded border border-white/10 bg-panel/78 p-5">
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

          <article className="rounded border border-white/10 bg-panel/78 p-5">
            <h2 className="text-xl font-semibold">Recent generations</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Generation history is stored in Supabase when configured. Local recent work remains available in the workspace while you connect production persistence.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
