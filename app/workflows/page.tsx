import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { getWorkflowPage, workflowPages, workflowPath } from "@/lib/workflow-pages";

export const metadata = pageMetadata({
  title: "Content Workflows | GetContentOS",
  description:
    "Browse practical ContentOS workflows for LinkedIn posts, captions, scripts, newsletters, carousels, repurposing and brand voice.",
  path: "/workflows"
});

const workflowGroups = [
  {
    title: "Create for a specific channel",
    description:
      "Choose the format you need to publish, then follow guidance shaped around that channel's reading, viewing and review context.",
    slugs: [
      "linkedin-post-generator-workflow",
      "instagram-caption-workflow",
      "tiktok-script-workflow",
      "x-thread-workflow",
      "newsletter-draft-workflow",
      "carousel-outline-workflow"
    ]
  },
  {
    title: "Build a reusable content system",
    description:
      "Keep the core idea and voice consistent while adapting the structure for different formats and publishing moments.",
    slugs: ["content-repurposing-workflow", "ai-brand-voice-workflow"]
  },
  {
    title: "Turn professional expertise into content",
    description:
      "Start with real decisions, client-safe questions and working knowledge rather than generic topic prompts.",
    slugs: ["founder-content-workflow", "consultant-content-workflow"]
  }
] as const;

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
      {workflowGroups.map((group) => (
        <section key={group.title} className="grid gap-4">
          <div>
            <h2 className="font-display text-2xl uppercase tracking-normal text-bone">{group.title}</h2>
            <p className="mt-2">{group.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.slugs.map((slug) => {
              const page = getWorkflowPage(slug);
              if (!page) return null;

              return (
                <article key={page.slug} className="rounded border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-normal text-goldSoft">{page.keyword}</p>
                  <h3 className="mt-3 font-display text-xl uppercase tracking-normal text-bone">{page.h1}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted">{page.description}</p>
                  <Link
                    href={workflowPath(page.slug)}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-goldSoft hover:text-bone"
                  >
                    Use the {page.h1} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </PublicPage>
  );
}
