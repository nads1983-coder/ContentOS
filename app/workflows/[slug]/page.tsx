import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "@/components/public-page";
import { blogPosts } from "@/lib/blog";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { getWorkflowPage, workflowPages, workflowPath } from "@/lib/workflow-pages";

type WorkflowPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return workflowPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: WorkflowPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getWorkflowPage(slug);

  if (!page) {
    return {};
  }

  const canonical = absoluteUrl(workflowPath(page.slug));

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical
    },
    openGraph: {
      title: page.title,
      description: page.description,
      siteName: siteConfig.name,
      type: "website",
      url: canonical
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function RelatedBlogLinks({ slugs }: { slugs: string[] }) {
  const posts = slugs
    .map((slug) => blogPosts.find((post) => post.slug === slug))
    .filter((post): post is (typeof blogPosts)[number] => Boolean(post));

  if (!posts.length) return null;

  return (
    <section className="grid gap-3 rounded border border-white/10 bg-white/[0.03] p-4">
      <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Related guides</h2>
      {posts.map((post) => (
        <Link key={post.slug} href={`/blog/${post.slug}`} className="group grid gap-1 text-sm">
          <span className="font-semibold text-goldSoft group-hover:text-bone">{post.title}</span>
          <span>{post.description}</span>
        </Link>
      ))}
    </section>
  );
}

export default async function WorkflowDetailPage({ params }: WorkflowPageProps) {
  const { slug } = await params;
  const page = getWorkflowPage(slug);

  if (!page) {
    notFound();
  }

  const relatedPages = page.related.map(getWorkflowPage).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const pageUrl = absoluteUrl(workflowPath(page.slug));
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Workflows", item: absoluteUrl("/workflows") },
      { "@type": "ListItem", position: 3, name: page.h1, item: pageUrl }
    ]
  };
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: page.h1,
    headline: page.h1,
    description: page.description,
    url: pageUrl,
    inLanguage: "en-GB",
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url
    }
  };
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: page.examples.map((example, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: example.replace(/^Prompt: /, "")
    }))
  };

  return (
    <PublicPage title={page.h1}>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={collectionSchema} />
      <JsonLd data={itemListSchema} />
      <nav className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-normal text-goldSoft" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/workflows">Workflows</Link>
        <span aria-hidden="true">/</span>
        <span className="text-muted">{page.h1}</span>
      </nav>

      <p>{page.intro}</p>

      <section className="grid gap-3 rounded border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Who this helps</h2>
        <p>{page.audience}</p>
        <p>
          Search intent: <span className="text-bone">{page.intent}</span>
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Use cases</h2>
        <ul className="grid gap-2 pl-5">
          {page.useCases.map((item) => (
            <li key={item} className="list-disc">{item}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Workflow steps</h2>
        <ol className="grid gap-3 pl-5">
          {page.steps.map((step) => (
            <li key={step} className="list-decimal">{step}</li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Sample prompts</h2>
        <p>
          These samples are designed for web use. Adjust them inside ContentOS with your own audience, offer, topic and
          review criteria before publishing.
        </p>
        <div className="grid gap-3">
          {page.examples.map((example) => (
            <blockquote key={example} className="rounded border border-white/10 bg-black/20 p-4 text-bone">
              {example}
            </blockquote>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Variables to replace</h2>
        <div className="flex flex-wrap gap-2">
          {page.variables.map((variable) => (
            <span key={variable} className="rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-bone">
              {variable}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Responsible use</h2>
        <p>{page.responsibleUse}</p>
      </section>

      <section className="grid gap-3 rounded border border-goldSoft/30 bg-goldSoft/10 p-4">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Build the full workflow</h2>
        <p>
          Use ContentOS to generate, repurpose, refine and save platform-ready content from one idea while keeping the
          final review in human hands.
        </p>
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-goldSoft hover:text-bone">
          See ContentOS pricing <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl uppercase tracking-normal text-bone">Related workflows</h2>
        <div className="grid gap-3">
          {relatedPages.map((related) => (
            <Link key={related.slug} href={workflowPath(related.slug)} className="rounded border border-white/10 bg-white/[0.03] p-4 hover:border-goldSoft/60">
              <span className="font-semibold text-goldSoft">{related.h1}</span>
              <span className="mt-1 block text-sm">{related.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <RelatedBlogLinks slugs={page.blogLinks} />
    </PublicPage>
  );
}
