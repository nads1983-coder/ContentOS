import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

const routes: Array<{
  path: string;
  changeFrequency: "monthly" | "weekly";
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/founder", changeFrequency: "weekly", priority: 0.9 },
  { path: "/features", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.7 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.7 },
  { path: "/refund-policy", changeFrequency: "monthly", priority: 0.7 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...routes.map((route) => ({
      url: absoluteUrl(route.path || "/"),
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority
    })),
    ...blogPosts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.published),
      changeFrequency: "monthly" as const,
      priority: 0.8
    }))
  ];
}
