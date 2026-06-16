import { CheckoutButton } from "@/components/billing-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { pageMetadata } from "@/lib/metadata";
import { planCoversPlan } from "@/lib/plan-utils";
import { getServerBillingState } from "@/lib/server-billing-state";

export const metadata = pageMetadata({
  title: "Claim Your Free Lifetime Founder Account | ContentOS",
  description:
    "Claim one of 100 free lifetime ContentOS founder accounts and turn one idea into LinkedIn posts, blogs, emails and social content in minutes.",
  path: "/founder"
});

const creatorPlan = "pro_creator" as const;

const benefits = [
  "Turn one rough idea into LinkedIn posts, blogs, emails and social content",
  "Generate structured content packs without starting from a blank page",
  "Use the platform formatter, saved outputs and export tools",
  "Keep your content clear, consistent and ready to publish",
  "Founder access to the Creator workflow for the lifetime of the account"
];

const audiences = [
  "Founders building authority around their work",
  "Creators who need consistent publishing without content fatigue",
  "Small business owners turning offers and ideas into useful content",
  "Consultants and coaches who want clearer platform-ready posts"
];

const faqs = [
  {
    question: "Is it really free?",
    answer:
      "Yes. The Founding100 offer is for 100 lifetime founder accounts on the Creator workflow. Availability is limited to the first 100 valid claims."
  },
  {
    question: "What happens after I claim it?",
    answer:
      "Create your ContentOS account, continue to the Creator checkout flow, and start building your first content pack after the offer is applied."
  },
  {
    question: "Do I need a coupon code?",
    answer:
      "We try to apply FOUNDING100 automatically for this page. If Stripe asks for a code, enter FOUNDING100 at checkout."
  },
  {
    question: "Who is this for?",
    answer:
      "It is built for founders, creators and small business owners who need consistent content without spending hours writing."
  }
];

export default async function FounderPage() {
  const billingState = await getServerBillingState();
  const covered = planCoversPlan(billingState.plan, creatorPlan);
  const cta = covered ? "Go to Your Workspace" : "Claim Your Free Lifetime Account";

  return (
    <main className="min-h-screen overflow-x-hidden bg-ink text-bone">
      <section className="relative isolate border-b border-white/10 px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] h-80 w-80 -translate-x-1/2 rounded-full bg-violet/25 blur-3xl" />
          <div className="absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        </div>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <BrandLogo />
          <span className="hidden rounded border border-gold/35 bg-gold/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft sm:inline-flex">
            100 accounts only
          </span>
        </div>
      </section>

      <section className="relative isolate px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.7fr)] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex rounded border border-gold/40 bg-gold/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft">
              Founding 100 offer
            </span>
            <h1 className="mt-5 max-w-4xl break-words font-display text-5xl uppercase leading-[0.9] tracking-normal text-bone sm:text-6xl lg:text-7xl">
              Claim Your Free Lifetime Founder Account
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl sm:leading-9">
              Turn one idea into LinkedIn posts, blogs, emails and social content in minutes.
            </p>
            <div className="mt-8 max-w-sm">
              <CheckoutButton
                plan={creatorPlan}
                authenticated={billingState.isLoggedIn}
                covered={covered}
                founderOffer
                className="w-full min-h-14 text-base"
              >
                {cta}
              </CheckoutButton>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
              Only 100 free lifetime founder accounts are available. We will try to apply the Founding100 offer automatically before checkout.
            </p>
          </div>

          <aside className="rounded border border-gold/30 bg-gold/[0.07] p-5 shadow-gold sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">Founder account includes</p>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-bone/88">
              {benefits.slice(0, 4).map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-goldSoft" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-3">
          <article className="rounded border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft">What you get</p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted">
              {benefits.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft">Why this is free</p>
            <p className="mt-4 text-sm leading-7 text-muted">
              We are opening a limited founder cohort to get ContentOS into the hands of serious creators and business owners early. In return, founder users help shape the product with real workflows, real content needs and practical feedback.
            </p>
          </article>

          <article className="rounded border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft">Who it is for</p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted">
              {audiences.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-goldSoft" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="font-display text-3xl uppercase tracking-normal text-bone sm:text-4xl">Short FAQ</h2>
          <div className="mt-6 grid gap-3">
            {faqs.map((item) => (
              <article key={item.question} className="rounded border border-white/10 bg-coal/70 p-5">
                <h3 className="text-base font-semibold text-bone">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto rounded border border-gold/35 bg-gold/[0.07] p-6 text-center shadow-gold sm:max-w-4xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft">Final call</p>
          <h2 className="mt-3 font-display text-3xl uppercase tracking-normal text-bone sm:text-4xl">
            Claim your founder account before the 100 places are gone.
          </h2>
          <div className="mx-auto mt-6 max-w-sm">
            <CheckoutButton
              plan={creatorPlan}
              authenticated={billingState.isLoggedIn}
              covered={covered}
              founderOffer
              className="w-full min-h-14 text-base"
            >
              {cta}
            </CheckoutButton>
          </div>
        </div>
      </section>
    </main>
  );
}
