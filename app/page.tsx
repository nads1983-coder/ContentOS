import Link from "next/link";
import { CheckoutButton } from "@/components/billing-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { pageMetadata } from "@/lib/metadata";
import { pricingPlans } from "@/lib/pricing";
import { siteConfig } from "@/lib/site";
import { LITE_PURCHASES_SUSPENDED } from "@/lib/lite-availability";

export const metadata = pageMetadata({
  title: "ContentOS | Authority-First AI Content Workflow",
  description:
    "ContentOS helps creators, founders, consultants and professionals turn one idea into structured, platform-ready social content with clearer positioning, stronger hooks, repurposing packs and multi-platform execution.",
  path: "/"
});

const benefits = [
  {
    title: "From idea to publish-ready pack",
    body: "Start with a rough note, transcript, launch idea, offer, or story and turn it into a structured set of posts, captions, hooks, CTAs and follow-up angles."
  },
  {
    title: "Sound sharper on every platform",
    body: "Adapt the same core message for LinkedIn, Instagram, TikTok, X/Twitter, Facebook, YouTube Shorts, carousels, scripts, and newsletters without losing your point of view."
  },
  {
    title: "Build a reusable content system",
    body: "Keep stronger outputs organized by platform, category, timestamp, and campaign value so your best thinking does not disappear after one post."
  }
];

const exampleOutputs = [
  {
    label: "Before",
    title: "A scattered idea",
    body: "I should post about why founders spend too long writing content and need a better workflow."
  },
  {
    label: "After",
    title: "A publish-ready direction",
    body: "Founders do not need more content pressure. They need a repeatable way to turn clear thinking into platform-ready posts, captions, scripts and follow-up ideas."
  }
];

const faqs = [
  {
    question: "What is ContentOS?",
    answer:
      "ContentOS is an authority-first AI content workflow that turns one rough idea into complete platform-ready content packs."
  },
  {
    question: "Who is ContentOS for?",
    answer:
      "ContentOS is for founders, creators, consultants, freelancers, agencies, coaches, small teams, and personal brands."
  },
  {
    question: "What platforms does ContentOS support?",
    answer:
      "ContentOS supports LinkedIn, Instagram, TikTok, X/Twitter, Facebook, YouTube Shorts, carousels, newsletters, and short-form video scripts."
  },
  {
    question: "Can ContentOS repurpose one idea into multiple formats?",
    answer:
      "Yes. ContentOS is built around repurposing one source idea into posts, captions, hooks, CTAs, hashtags, carousels, scripts, and newsletters while keeping the message clear and consistent."
  }
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ContentOS",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteConfig.url,
    description: siteConfig.description,
    offers: [
      {
        "@type": "Offer",
        name: "Lite",
        price: "5",
        availability: LITE_PURCHASES_SUSPENDED ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        priceCurrency: "GBP"
      },
      {
        "@type": "Offer",
        name: "Pro Creator",
        price: pricingPlans.find((plan) => plan.billingPlan === "pro_creator")?.schemaPrice ?? "9",
        priceCurrency: "GBP"
      },
      {
        "@type": "Offer",
        name: "Pro Studio",
        price: pricingPlans.find((plan) => plan.billingPlan === "pro_studio")?.schemaPrice ?? "39",
        priceCurrency: "GBP"
      }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  }
];

export default function Home() {
  const studioHref = "/signup";

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="text-bone">
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <BrandLogo />
            <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Primary">
              <a href="#benefits" className="transition hover:text-bone">
                Features
              </a>
              <a href="#pricing" className="transition hover:text-bone">
                Pricing
              </a>
              <Link href="/workflows" className="transition hover:text-bone">
                Workflows
              </Link>
              <Link href="/blog" className="transition hover:text-bone">
                Blog
              </Link>
              <Link href="/login" className="transition hover:text-bone">
                Log in
              </Link>
              <Link
                href={studioHref}
                className="rounded border border-gold/60 bg-gold/10 px-4 py-2 font-semibold text-bone transition hover:bg-gold/20"
              >
                Start creating
              </Link>
            </nav>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <Link
                href="/login"
                className="rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-bone transition hover:border-gold/60"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>

        <section id="demo" className="relative max-w-[100vw] overflow-hidden px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)] lg:items-center">
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
                Authority-first AI content workflow
              </p>
              <h1 className="mt-5 max-w-3xl break-words text-3xl font-black leading-[1.08] tracking-normal text-bone sm:text-5xl lg:text-6xl">
                <span className="block sm:inline">Create </span>
                <span className="block sm:inline">platform-ready </span>
                <span className="block">content from one idea.</span>
              </h1>
              <p className="mt-6 max-w-2xl break-words text-base leading-7 text-muted sm:text-lg sm:leading-8">
                Turn a rough idea into ready-to-edit posts, captions and scripts for the platforms you use.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={studioHref}
                  className="flex min-h-12 items-center justify-center rounded border border-violet/70 bg-violet px-5 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep"
                >
                  Start creating
                </Link>
                <a
                  href="#demo"
                  className="flex min-h-12 items-center justify-center rounded border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-bone transition hover:border-gold/60"
                >
                  View examples
                </a>
              </div>

            </div>
            <div className="w-full min-w-0 overflow-hidden rounded border border-white/10 bg-panel/76 p-3 shadow-violet backdrop-blur-xl sm:p-4">
              <div className="w-full min-w-0 overflow-hidden rounded border border-white/10 bg-ink/80 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
                  Content pack preview
                </p>
                <div className="mt-4 grid gap-3">
                  {["LinkedIn post", "Instagram caption", "TikTok script"].map((item) => (
                    <div key={item} className="min-w-0 rounded border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-sm font-semibold text-bone">{item}</p>
                      <p className="mt-1 break-words text-xs leading-5 text-muted">
                        One message, tailored to this format and ready for your edits.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="benefits" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="max-w-3xl break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              From idea to publish-ready content.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              Create, tailor and save usable drafts without starting from a blank page.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {benefits.map((item) => (
                <article key={item.title} className="rounded border border-white/10 bg-coal/70 p-5">
                  <h3 className="text-lg font-semibold text-bone">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
                Before and after the workflow.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                See how one rough thought becomes a clearer draft.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {exampleOutputs.map((item) => (
                <article
                  key={item.label}
                  className={`rounded border p-5 ${item.label === "After" ? "border-gold/45 bg-gold/[0.08]" : "border-white/10 bg-coal/70"}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">{item.label}</p>
                  <h3 className="mt-3 text-lg font-semibold text-bone">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Simple pricing for creators and teams
            </h2>
            <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex min-h-full flex-col rounded border p-5 ${plan.featured ? "border-gold/70 bg-gold/10 shadow-gold" : "border-white/10 bg-coal/70"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <BrandLogo showWordmark={false} size="sm" />
                    {plan.badge ? (
                      <span className="rounded border border-gold/50 bg-gold/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-goldSoft">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-bone">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-extrabold text-goldSoft">{plan.price}</p>
                  <p className="mt-3 text-sm leading-6 text-muted">{plan.body}</p>
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
                  <ul className="mt-5 grid gap-2 text-sm text-muted">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-goldSoft" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {plan.billingPlan ? (
                      <CheckoutButton
                        plan={plan.billingPlan}
                        authenticated={false}
                        className="w-full"
                      >
                        {plan.cta}
                      </CheckoutButton>
                    ) : (
                      <Link
                        href={studioHref}
                        className="flex min-h-11 items-center justify-center rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white transition hover:bg-violetDeep"
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-5 text-center text-sm text-muted">
              Simple pricing. No hidden fees. Cancel anytime.
            </p>
          </div>
        </section>

        <section id="faq" className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-4xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Ready to create content from your next idea?
            </h2>
            <Link href={studioHref} className="mt-5 inline-flex min-h-12 items-center justify-center rounded border border-violet/70 bg-violet px-6 text-sm font-semibold text-white hover:bg-violetDeep">Start creating</Link>
            <h3 className="mt-10 text-lg font-semibold text-bone">Quick answers</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {faqs.map((item) => (
                <article key={item.question} className="rounded border border-white/10 bg-coal/70 p-5">
                  <h3 className="text-lg font-semibold text-bone">{item.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>


    </>
  );
}
