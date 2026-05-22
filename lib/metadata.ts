import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/site";

export function pageMetadata({
  title,
  description = siteConfig.description,
  path,
  index = true
}: {
  title: string;
  description?: string;
  path: string;
  index?: boolean;
}): Metadata {
  const canonical = absoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      siteName: siteConfig.name,
      type: "website",
      url: canonical,
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: "ContentOS AI social content generator"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/opengraph-image")]
    },
    robots: {
      index,
      follow: index
    }
  };
}
