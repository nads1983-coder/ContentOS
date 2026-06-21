import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { FounderCheckoutButton } from "@/components/billing-buttons";
import { getCurrentUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";
import { planCoversPlan } from "@/lib/plan-utils";
import { pricingPlans } from "@/lib/pricing";
import { getServerBillingState } from "@/lib/server-billing-state";

export const metadata = pageMetadata({
  title: "Confirm Your Free Founder Access | ContentOS",
  path: "/founder/checkout",
  index: false
});

export default async function FounderCheckoutPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, billingState, params] = await Promise.all([
    getCurrentUser(),
    getServerBillingState(),
    searchParams
  ]);

  if (!user) {
    redirect("/signup?plan=pro_creator&founder=1");
  }

  if (planCoversPlan(billingState.plan, "pro_creator")) {
    redirect("/dashboard");
  }

  const creatorPlan = pricingPlans.find((plan) => plan.billingPlan === "pro_creator");
  const originalPrice = creatorPlan?.price ?? "£9/month";
  const canceled = params?.canceled === "1";

  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden bg-ink px-4 py-10 text-bone sm:px-6">
      <section className="w-full max-w-xl rounded border border-gold/30 bg-panel/90 p-5 shadow-gold sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo />
          <span className="rounded border border-gold/35 bg-gold/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-goldSoft">
            £0 today
          </span>
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            Founder checkout summary
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-normal text-bone">
            Confirm your free access
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            You will confirm your free Founder access in Stripe. You will not be charged when the founder discount is applied.
          </p>
        </div>

        <dl className="mt-7 divide-y divide-white/10 rounded border border-white/10 bg-black/20 px-4">
          <div className="flex items-center justify-between gap-4 py-4">
            <dt className="text-sm text-muted">Offer</dt>
            <dd className="text-sm font-semibold text-bone">Founder Offer</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <dt className="text-sm text-muted">Original price</dt>
            <dd className="text-sm font-semibold text-bone">{originalPrice}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <dt className="text-sm text-muted">Founder discount</dt>
            <dd className="text-sm font-semibold text-goldSoft">100% lifetime</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <dt className="text-sm font-semibold text-bone">Total due today</dt>
            <dd className="text-xl font-semibold text-goldSoft">£0</dd>
          </div>
        </dl>

        {canceled ? (
          <p className="mt-4 rounded border border-gold/35 bg-gold/[0.08] p-3 text-sm text-bone">
            Checkout was canceled. Your account is safe and no charge was made.
          </p>
        ) : null}

        <div className="mt-6">
          <FounderCheckoutButton className="w-full" />
        </div>
        <p className="mt-3 text-center text-xs leading-5 text-muted">
          No coupon entry and no card are required when Stripe confirms the £0 total.
        </p>
        <Link href="/founder" className="mt-5 block text-center text-sm text-muted hover:text-bone">
          Back to Founder Offer
        </Link>
      </section>
    </main>
  );
}
