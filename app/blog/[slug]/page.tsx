import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PublicPage } from "@/components/public-page";
import { blogPosts, getBlogPost } from "@/lib/blog";
import { absoluteUrl, siteConfig } from "@/lib/site";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {};
  }

  const canonical = absoluteUrl(`/blog/${post.slug}`);

  return {
    title: post.seoTitle || `${post.title} | ContentOS Blog`,
    description: post.description,
    alternates: {
      canonical
    },
    openGraph: {
      title: post.title,
      description: post.description,
      siteName: siteConfig.name,
      type: "article",
      url: canonical,
      publishedTime: post.published
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description: post.description
    }
  };
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <span key={index}>{part}</span>;
  });
}

function ArticleBody({ markdown }: { markdown: string }) {
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;

    blocks.push(
      <ul key={`list-${blocks.length}`} className="grid gap-2 pl-5">
        {listItems.map((item) => (
          <li key={item} className="list-disc">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }

    flushList();

    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="font-display text-xl uppercase tracking-normal text-bone">
          {renderInline(line.slice(4))}
        </h3>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="font-display text-2xl uppercase tracking-normal text-bone">
          {renderInline(line.slice(3))}
        </h2>,
      );
      return;
    }

    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  });

  flushList();

  return <div className="grid gap-5">{blocks}</div>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.published,
    author: {
      "@type": "Organization",
      name: siteConfig.name
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`)
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <PublicPage title={post.title}>
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-goldSoft hover:text-bone">
          <ArrowLeft size={16} aria-hidden="true" />
          Blog
        </Link>
        <p className="text-base leading-8 text-bone">{post.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-normal text-goldSoft">
          <time dateTime={post.published}>
            Published{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric"
            }).format(new Date(post.published))}
          </time>
          <span aria-hidden="true">/</span>
          <span>{post.readingTime}</span>
          {post.targetKeyword ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{post.targetKeyword}</span>
            </>
          ) : null}
        </div>
        {post.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {post.body ? (
          <ArticleBody markdown={post.body} />
        ) : (
          post.sections.map((section) => (
            <section key={section.heading} className="grid gap-3">
              <h2 className="font-display text-2xl uppercase tracking-normal text-bone">{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))
        )}
        {post.cta ? (
          <section className="grid gap-3 rounded border border-goldSoft/30 bg-goldSoft/10 p-5">
            <p className="text-xs uppercase tracking-normal text-goldSoft">Next step</p>
            <h2 className="font-display text-2xl uppercase tracking-normal text-bone">{post.cta}</h2>
            <p>Use this article to tighten one repeatable content workflow, then build the system around it.</p>
            <Link href="/studio" className="inline-flex items-center gap-2 text-sm font-semibold text-goldSoft hover:text-bone">
              Open ContentOS
            </Link>
          </section>
        ) : null}
      </PublicPage>
    </>
  );
}
