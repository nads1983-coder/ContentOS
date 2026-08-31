import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { workflowPages, workflowPath } from "@/lib/workflow-pages";

export const metadata = pageMetadata({
  title: "Content Workflows | GetContentOS",
  description:
    "Browse practical ContentOS workflows for LinkedIn posts, captions, scripts, newsletters, carousels, repurposing and brand voice.",
  path: "/workflows"
});

export default function WorkflowsIndexPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ContentOS content workflows",
    description: metadata.description,
    url: absoluteUrl("/workflows"),
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
    itemListElement: workflowPages.map((page, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: page.h1,
      url: absoluteUrl(workflowPath(page.slug))
    }))
  };

  return (
    <PublicPage title="ContentOS workflows">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <p>
        Use these workflows to turn one idea into platform-ready content with clearer structure, brand voice and review
        points. Each page is a practical route through ContentOS rather than a generic article or a promise of automatic
        results.
      </p>
      <div className="grid gap-4">
        {workflowPages.map((page) => (
          <article key={page.slug} className="rounded border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-normal text-goldSoft">{page.keyword}</p>
            <h2 className="mt-3 font-display text-2xl uppercase tracking-normal text-bone">{page.h1}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">{page.description}</p>
            <Link
              href={workflowPath(page.slug)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-goldSoft hover:text-bone"
            >
              Open workflow <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </PublicPage>
  );
}
