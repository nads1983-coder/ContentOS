import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type BlogPost = {
  slug: string;
  title: string;
  seoTitle?: string;
  description: string;
  published: string;
  readingTime: string;
  articleType?: string;
  targetKeyword?: string;
  tags?: string[];
  cta?: string;
  body?: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

type GeneratedBlogPost = {
  slug?: string;
  title?: string;
  seoTitle?: string;
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  description?: string;
  date?: string;
  publishedDate?: string;
  readingTime?: string;
  readingTimeMinutes?: number;
  articleType?: string;
  targetKeyword?: string;
  tags?: string[];
  keywordVariations?: string[];
  cta?: string;
  content?: string;
  body?: string;
  articleMarkdown?: string;
};

const contentDirectory = path.join(process.cwd(), "content", "blog");

const manualBlogPosts: BlogPost[] = [
  {
    slug: "turn-one-idea-into-a-content-system",
    title: "Turn One Idea Into a Content System",
    seoTitle: "Turn One Idea Into a Content System | ContentOS Blog",
    description:
      "A simple publishing workflow for turning one strong idea into structured social posts, emails, scripts and articles without losing the original point of view.",
    published: "2026-06-06",
    readingTime: "4 min read",
    sections: [
      {
        heading: "Start with the source idea",
        body:
          "The strongest content systems begin before generation. Capture the situation, tension, audience and practical lesson behind the idea so every output has something specific to preserve."
      },
      {
        heading: "Choose the right format for each platform",
        body:
          "A LinkedIn post can carry the argument, an Instagram caption can carry the recognition, a short video script can lead with the tension and a blog article can expand the useful detail."
      },
      {
        heading: "Publish from a reusable structure",
        body:
          "Once the core article shape is in place, future posts can be added by creating a new entry in the blog content file with a slug, metadata and article sections."
      }
    ]
  }
];

function estimateReadingTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
}

function toGeneratedBlogPost(raw: GeneratedBlogPost): BlogPost | null {
  if (!raw.slug || !raw.title) return null;

  const body = raw.articleMarkdown || raw.content || raw.body || "";
  if (!body.trim()) return null;

  const tags = Array.isArray(raw.tags)
    ? raw.tags
    : Array.isArray(raw.keywordVariations)
      ? raw.keywordVariations
      : [];

  return {
    slug: raw.slug,
    title: raw.title,
    seoTitle: raw.seoTitle || raw.metaTitle || raw.title,
    description: raw.metaDescription || raw.excerpt || raw.description || raw.title,
    published: raw.publishedDate || raw.date || new Date().toISOString(),
    readingTime:
      raw.readingTime ||
      (raw.readingTimeMinutes ? `${raw.readingTimeMinutes} min read` : estimateReadingTime(body)),
    articleType: raw.articleType || "Blog Post",
    targetKeyword: raw.targetKeyword || tags[0] || "",
    tags,
    cta: raw.cta,
    body,
    sections: []
  };
}

function getGeneratedBlogPosts() {
  if (!existsSync(contentDirectory)) return [];

  return readdirSync(contentDirectory)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      try {
        const raw = readFileSync(path.join(contentDirectory, file), "utf8");
        const post = toGeneratedBlogPost(JSON.parse(raw) as GeneratedBlogPost);
        return post ? [post] : [];
      } catch {
        return [];
      }
    });
}

const generatedBlogPosts = getGeneratedBlogPosts();
const generatedSlugs = new Set(generatedBlogPosts.map((post) => post.slug));

export const blogPosts: BlogPost[] = [
  ...generatedBlogPosts,
  ...manualBlogPosts.filter((post) => !generatedSlugs.has(post.slug))
].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
