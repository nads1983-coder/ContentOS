import Link from "next/link";
import { CheckoutButton } from "@/components/billing-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { FoundingOffer } from "@/components/founding-offer";
import { LogoutButton } from "@/components/logout-button";
import { pageMetadata } from "@/lib/metadata";
import { planCoversPlan } from "@/lib/plan-utils";
import { pricingPlans } from "@/lib/pricing";
import { getServerBillingState } from "@/lib/server-billing-state";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "ContentOS | Authority-First AI Content Workflow",
  description:
    "ContentOS helps creators, founders, consultants and professionals turn one idea into structured, platform-ready social content with clearer positioning, stronger hooks, repurposing packs and multi-platform execution.",
  path: "/"
});

const valueBullets = [
  "Authority-led outputs",
  "Multi-platform execution",
  "Built-in formatter",
  "Repurposing packs",
  "Saved content library"
];

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

const features = [
  "Authority-first post generation",
  "One-idea repurposing engine",
  "Platform-specific formatting",
  "Carousel and script generation",
  "Brand voice memory",
  "Saved content library",
  "Clean export tools",
  "Platform-aware optimization",
  "Strategic prompt presets",
  "Content refinement tools",
  "Generate matching social visuals from your content"
];

const credibilityStats = [
  {
    value: "1 idea",
    label: "becomes a structured content pack"
  },
  {
    value: "7+ formats",
    label: "ready for platform-specific publishing"
  },
  {
    value: "Minutes",
    label: "from source material to usable drafts"
  }
];

const audienceTypes = [
  "Founders building visible expertise",
  "Consultants turning insight into demand",
  "Creators publishing with more structure",
  "Small teams keeping content consistent"
];

const testimonials = [
  {
    quote:
      "ContentOS helps me get from a rough thought to something I can actually publish. It feels structured without making the writing sound generic.",
    name: "Founder and consultant"
  },
  {
    quote:
      "The biggest shift is speed. I can create a LinkedIn post, caption, thread and email angle from one idea without rebuilding the message every time.",
    name: "Creator operator"
  },
  {
    quote:
      "It gives my content a cleaner point of view. Less blank-page thinking, more useful drafts I can refine and ship.",
    name: "Personal brand strategist"
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

const creationExamples = [
  "Authority-building LinkedIn posts",
  "Launch and offer announcements",
  "Educational carousels and scripts",
  "Newsletter drafts from social ideas",
  "Platform hashtag and keyword sets",
  "Repurposing packs for one core message"
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

export default async function Home() {
  const billingState = await getServerBillingState();
  const studioHref = billingState.isLoggedIn ? "/studio" : "/signup";

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
              <a href="#features" className="transition hover:text-bone">
                Features
              </a>
              <a href="#pricing" className="transition hover:text-bone">
                Pricing
              </a>
              {billingState.isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="transition hover:text-bone">
                    Dashboard
                  </Link>
                  <Link href="/studio" className="transition hover:text-bone">
                    Workspace
                  </Link>
                  <LogoutButton className="text-sm text-muted transition hover:text-bone" />
                </>
              ) : (
                <Link href="/login" className="transition hover:text-bone">
                  Log in
                </Link>
              )}
              <Link
                href={studioHref}
                className="rounded border border-gold/60 bg-gold/10 px-4 py-2 font-semibold text-bone transition hover:bg-gold/20"
              >
                Start creating
              </Link>
            </nav>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <Link
                href={billingState.isLoggedIn ? "/dashboard" : "/login"}
                className="rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-bone transition hover:border-gold/60"
              >
                {billingState.isLoggedIn ? "Account" : "Log in"}
              </Link>
              {billingState.isLoggedIn ? <LogoutButton /> : null}
            </div>
          </div>
        </section>

        <section className="relative max-w-[100vw] overflow-hidden px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
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
                ContentOS helps creators, founders, consultants and professionals turn rough ideas into structured posts, captions, scripts, hooks, CTAs and repurposing packs with a clearer, more authoritative voice.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={studioHref}
                  className="flex min-h-12 items-center justify-center rounded border border-violet/70 bg-violet px-5 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep"
                >
                  Start creating
                </Link>
                <a
                  href="#examples"
                  className="flex min-h-12 items-center justify-center rounded border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-bone transition hover:border-gold/60"
                >
                  View examples
                </a>
              </div>
              <ul className="mt-8 grid gap-2 text-sm leading-6 text-muted sm:grid-cols-2">
                {valueBullets.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-goldSoft" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full min-w-0 overflow-hidden rounded border border-white/10 bg-panel/76 p-3 shadow-violet backdrop-blur-xl sm:p-4">
              <div className="w-full min-w-0 overflow-hidden rounded border border-white/10 bg-ink/80 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
                  Content pack preview
                </p>
                <div className="mt-4 grid gap-3">
                  {["LinkedIn post", "Instagram caption", "TikTok script", "X thread", "Carousel outline", "Email draft"].map((item) => (
                    <div key={item} className="min-w-0 rounded border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-sm font-semibold text-bone">{item}</p>
                      <p className="mt-1 break-words text-xs leading-5 text-muted">
                        Platform-ready content shaped from the same strategic idea.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
                Built for modern creators and professionals
              </p>
              <h2 className="mt-4 max-w-2xl break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
                Content infrastructure for people who publish expertise.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Use ContentOS when you need clarity, consistency and speed without turning your content into generic output. It is built for authority-led communication, not engagement bait.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {credibilityStats.map((item) => (
                  <div key={item.value} className="rounded border border-white/10 bg-coal/70 p-4">
                    <p className="text-xl font-extrabold text-goldSoft">{item.value}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {audienceTypes.map((item) => (
                <div key={item} className="rounded border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold leading-6 text-bone">
                  {item}
                </div>
              ))}
              <div className="rounded border border-gold/35 bg-gold/[0.08] p-4 md:col-span-2">
                <p className="text-sm font-semibold text-goldSoft">Platform-ready content in minutes</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Move from unstructured source material to usable LinkedIn posts, Instagram captions, TikTok hooks, X threads, email drafts and carousel outlines in one workflow.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="max-w-3xl break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              From idea to publish-ready content.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              ContentOS gives serious creators and professionals a structured path from rough thinking to clear, platform-ready execution. Less overthinking, fewer blank pages, stronger message discipline.
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
                ContentOS is designed to turn scattered expertise into structured communication. The output starts clearer, so editing becomes refinement instead of rescue work.
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

        <section id="features" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              A structured content operating system
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              Plan, generate, format, refine, save and repurpose content without jumping between disconnected prompts, notes and drafts.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {features.map((feature) => (
                <div key={feature} className="flex min-h-16 items-center rounded border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold leading-5 text-bone">
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div>
                <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
                  What users are creating.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted">
                  Use the same source idea to create sharper, more consistent assets across your publishing workflow.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {creationExamples.map((item) => (
                  <div key={item} className="rounded border border-white/10 bg-coal/70 p-4 text-sm font-semibold leading-6 text-bone">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.map((item) => (
                <figure key={item.name} className="rounded border border-white/10 bg-white/[0.035] p-5">
                  <blockquote className="text-sm leading-7 text-muted">
                    "{item.quote}"
                  </blockquote>
                  <figcaption className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-goldSoft">
                    {item.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <FoundingOffer
          isLoggedIn={billingState.isLoggedIn}
          currentPlan={billingState.plan}
        />

        <section id="pricing" className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Simple pricing for creators and teams
            </h2>
            <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
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
                        authenticated={billingState.isLoggedIn}
                        covered={planCoversPlan(billingState.plan, plan.billingPlan)}
                        className="w-full"
                      >
                        {planCoversPlan(billingState.plan, plan.billingPlan) ? "Go to dashboard" : plan.cta}
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

        <section id="examples" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Starter templates
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {["Launch announcement", "Educational post", "Product promotion", "Personal brand story", "Thought leadership", "Newsletter repurpose", "Short-form video script"].map((item) => (
                <Link
                  key={item}
                  href={studioHref}
                  className="rounded border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-bone transition hover:border-violet/60"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-4xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              FAQ
            </h2>
            <div className="mt-8 grid gap-4">
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

      <footer className="border-t border-white/10 px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo />
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/features" className="hover:text-bone">Features</Link>
            <Link href="/pricing" className="hover:text-bone">Pricing</Link>
            <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-bone">
              {siteConfig.contactEmail}
            </a>
            <Link href="/privacy" className="hover:text-bone">Privacy</Link>
            <Link href="/terms" className="hover:text-bone">Terms</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
