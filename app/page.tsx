import Link from "next/link";
import { CheckoutButton } from "@/components/billing-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "ContentOS | AI Social Content Generator",
  path: "/"
});

const valueBullets = [
  "Multi-platform outputs",
  "Built-in formatter",
  "Repurposing packs",
  "Saved content library",
  "Free and Pro-ready structure"
];

const benefits = [
  {
    title: "From idea to content pack",
    body: "Start with a rough note, transcript, launch idea, offer, or story and turn it into a structured set of usable assets."
  },
  {
    title: "Format for each platform",
    body: "Shape the same idea for LinkedIn, Instagram, TikTok, X/Twitter, Facebook, YouTube Shorts, carousels, scripts, and newsletters."
  },
  {
    title: "Save and reuse your best outputs",
    body: "Keep stronger generations organized by platform, category, timestamp, and future campaign value."
  }
];

const features = [
  "AI post generation",
  "Repurposing engine",
  "Multi-platform formatting",
  "Carousel/script generation",
  "Brand voice memory",
  "Saved content library",
  "Export tools",
  "Platform optimization",
  "Prompt presets",
  "Content refinement tools",
  "Generate matching social visuals from your content"
];

type MarketingPlan = {
  name: string;
  price: string;
  body: string;
  items: string[];
  cta: string;
  billingPlan?: "pro_creator" | "pro_studio";
  featured?: boolean;
};

const pricing: MarketingPlan[] = [
  {
    name: "Free",
    price: "£0",
    body: "For testing the workflow and creating core post formats.",
    items: ["Basic generation", "Limited monthly generations", "Core post formats"],
    cta: "Start creating"
  },
  {
    name: "Pro Creator",
    price: "£19/month",
    billingPlan: "pro_creator",
    body: "AI social content generation for creators, founders and consultants.",
    items: [
      "Unlimited generations",
      "Multi-platform outputs",
      "Repurposing packs",
      "Carousel and video scripts",
      "Formatter tools",
      "Saved library",
      "Export tools",
      "Brand voice memory"
    ],
    featured: true,
    cta: "Upgrade to Pro Creator"
  },
  {
    name: "Pro Studio",
    price: "£49/month",
    billingPlan: "pro_studio",
    body: "Advanced AI social content workspace for agencies, teams and high-volume creators.",
    items: [
      "Multiple brand profiles",
      "Workspace organization",
      "Higher usage limits",
      "Advanced workflows",
      "AI image generation",
      "Downloadable PNG visuals",
      "Social graphic generation",
      "Future team support ready"
    ],
    cta: "Upgrade to Pro Studio"
  }
];

const faqs = [
  {
    question: "What is ContentOS?",
    answer:
      "ContentOS is an AI social content generator that turns one rough idea into complete platform-ready content packs."
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
      "Yes. ContentOS is built around repurposing one source idea into posts, captions, hooks, CTAs, hashtags, carousels, scripts, and newsletters."
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
        price: "19",
        priceCurrency: "GBP"
      },
      {
        "@type": "Offer",
        name: "Pro Studio",
        price: "49",
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
  const studioHref = "/studio";

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
          </div>
        </section>

        <section className="relative max-w-[100vw] overflow-hidden px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-0 grid w-full max-w-[18rem] min-w-0 gap-10 sm:mx-auto sm:max-w-7xl lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)] lg:items-center">
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
                AI social content generator
              </p>
              <h1 className="mt-5 max-w-3xl break-words text-3xl font-black leading-[1.08] tracking-normal text-bone sm:text-5xl lg:text-6xl">
                <span className="block sm:inline">Create </span>
                <span className="block sm:inline">platform-ready </span>
                <span className="block">content from one idea.</span>
              </h1>
              <p className="mt-6 max-w-2xl break-words text-base leading-7 text-muted sm:text-lg sm:leading-8">
                Generate LinkedIn posts, Instagram captions, TikTok scripts, X threads, hooks, CTAs, hashtags, carousels and repurposing packs in minutes.
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
                        Platform-aware output generated from the same source idea.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-0 w-full max-w-[18rem] sm:mx-auto sm:max-w-7xl">
            <h2 className="max-w-3xl break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Built for consistent content without blank-page drag.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              ContentOS is for founders, creators, freelancers, consultants, agencies and small teams who need consistent content without starting from a blank page every time.
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

        <section id="features" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-0 w-full max-w-[18rem] sm:mx-auto sm:max-w-7xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              A complete content workflow
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {features.map((feature) => (
                <div key={feature} className="flex min-h-16 items-center rounded border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold leading-5 text-bone">
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-white/10 bg-white/[0.025] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-0 w-full max-w-[18rem] sm:mx-auto sm:max-w-7xl">
            <h2 className="break-words text-2xl font-extrabold tracking-normal text-bone sm:text-3xl">
              Simple pricing for creators and teams
            </h2>
            <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
              {pricing.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex min-h-full flex-col rounded border p-5 ${plan.featured ? "border-gold/70 bg-gold/10 shadow-gold" : "border-white/10 bg-coal/70"}`}
                >
                  <BrandLogo showWordmark={false} size="sm" />
                  <h3 className="mt-4 text-xl font-semibold text-bone">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-extrabold text-goldSoft">{plan.price}</p>
                  <p className="mt-3 text-sm leading-6 text-muted">{plan.body}</p>
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
          </div>
        </section>

        <section id="examples" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-0 w-full max-w-[18rem] sm:mx-auto sm:max-w-7xl">
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
          <div className="mx-0 w-full max-w-[18rem] sm:mx-auto sm:max-w-4xl">
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
        <div className="mx-0 flex w-full max-w-[18rem] flex-col gap-4 sm:mx-auto sm:max-w-7xl sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo />
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/features" className="hover:text-bone">Features</Link>
            <Link href="/pricing" className="hover:text-bone">Pricing</Link>
            <Link href="/privacy" className="hover:text-bone">Privacy</Link>
            <Link href="/terms" className="hover:text-bone">Terms</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
