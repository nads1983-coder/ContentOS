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
    title: `${post.title} | ContentOS Blog`,
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
      title: post.title,
      description: post.description
    }
  };
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
          <time dateTime={post.published}>Published 6 June 2026</time>
          <span aria-hidden="true">/</span>
          <span>{post.readingTime}</span>
        </div>
        {post.sections.map((section) => (
          <section key={section.heading} className="grid gap-3">
            <h2 className="font-display text-2xl uppercase tracking-normal text-bone">{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </PublicPage>
    </>
  );
}
