import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "@/components/public-page";
import { blogPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ContentOS Blog | AI Content Workflow Articles",
  description:
    "Practical articles about AI content workflows, idea repurposing, creator systems and platform-ready publishing.",
  path: "/blog"
});

export default function BlogIndexPage() {
  return (
    <PublicPage title="ContentOS Blog">
      <div className="grid gap-4">
        {blogPosts.map((post) => (
          <article key={post.slug} className="rounded border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-normal text-goldSoft">
              <time dateTime={post.published}>6 June 2026</time>
              <span aria-hidden="true">/</span>
              <span>{post.readingTime}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl uppercase tracking-normal text-bone">{post.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">{post.description}</p>
            <Link
              href={`/blog/${post.slug}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-goldSoft hover:text-bone"
            >
              Read article <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </PublicPage>
  );
}
