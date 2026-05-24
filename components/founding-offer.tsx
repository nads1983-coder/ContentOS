import { CheckoutButton } from "@/components/billing-buttons";
import { planCoversPlan } from "@/lib/plan-utils";
import type { BillingPlan } from "@/lib/pricing";
import type { PlanId } from "@/types/saas";

export function FoundingOffer({
  isLoggedIn,
  currentPlan
}: {
  isLoggedIn: boolean;
  currentPlan: PlanId;
}) {
  const creatorPlan: BillingPlan = "pro_creator";
  const covered = planCoversPlan(currentPlan, creatorPlan);

  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-5 rounded border border-gold/35 bg-gold/[0.07] p-5 shadow-gold sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex rounded border border-gold/45 bg-ink/60 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-goldSoft">
              Limited founder launch
            </span>
            <h2 className="mt-4 break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Founding 100
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-bone/86">
              We&apos;re opening 100 lifetime founding accounts for creators and professionals building authority online.
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-goldSoft">
              Full Creator access. Free forever. Limited to 100 users.
            </p>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-muted">
              Enter FOUNDING100 manually in Stripe Checkout. This offer is for the Creator plan only.
            </p>
          </div>
          <div className="w-full min-w-0 lg:w-56">
            <CheckoutButton
              plan={creatorPlan}
              authenticated={isLoggedIn}
              covered={covered}
              className="w-full"
            >
              {covered ? "Go to dashboard" : "Claim Founder Access"}
            </CheckoutButton>
          </div>
        </div>
      </div>
    </section>
  );
}
