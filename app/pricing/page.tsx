import { CheckoutButton } from "@/components/billing-buttons";
import { FoundingOffer } from "@/components/founding-offer";
import { pageMetadata } from "@/lib/metadata";
import { planCoversPlan } from "@/lib/plan-utils";
import { pricingPlans } from "@/lib/pricing";
import { getServerBillingState } from "@/lib/server-billing-state";
import { PublicPage } from "@/components/public-page";

export const metadata = pageMetadata({
  title: "ContentOS Pricing | Simple Pricing for Creators and Teams",
  path: "/pricing"
});

export default async function PricingPage() {
  const plans = pricingPlans;
  const billingState = await getServerBillingState();

  return (
    <PublicPage title="Simple pricing for creators and teams">
      <FoundingOffer
        isLoggedIn={billingState.isLoggedIn}
        currentPlan={billingState.plan}
      />
      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded border p-4 ${plan.featured ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.035]"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-bone">
                {plan.billingPlan ? `${plan.name}, ${plan.price}` : plan.name}
              </h2>
              {plan.badge ? (
                <span className="rounded border border-gold/50 bg-gold/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-goldSoft">
                  {plan.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-3">{plan.body}</p>
            {plan.socialProof ? (
              <p className="mt-3 rounded border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-bone/80">
                {plan.socialProof}
              </p>
            ) : null}
            {plan.offerNote ? (
              <p className="mt-3 rounded border border-gold/35 bg-gold/[0.08] p-3 text-xs font-medium leading-5 text-goldSoft">
                {plan.offerNote}
              </p>
            ) : null}
            <ul className="mt-4 grid gap-2 text-sm">
              {plan.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-goldSoft" />
                  {item}
                </li>
              ))}
            </ul>
            {plan.billingPlan ? (
              <div className="mt-4">
                <CheckoutButton
                  plan={plan.billingPlan}
                  authenticated={billingState.isLoggedIn}
                  covered={planCoversPlan(billingState.plan, plan.billingPlan)}
                  className="w-full"
                >
                  {planCoversPlan(billingState.plan, plan.billingPlan) ? "Go to dashboard" : plan.cta}
                </CheckoutButton>
              </div>
            ) : null}
          </div>
        ))}
      </section>
      <p className="text-center text-sm text-muted">
        Simple pricing. No hidden fees. Cancel anytime.
      </p>
    </PublicPage>
  );
}
