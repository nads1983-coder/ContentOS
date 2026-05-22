import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

const routes = [
  "",
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/login",
  "/signup"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: absoluteUrl(route || "/"),
    lastModified: new Date(),
    changeFrequency: route ? "monthly" : "weekly",
    priority: route ? 0.7 : 1
  }));
}
