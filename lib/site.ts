const fallbackSiteUrl = "https://getcontentos.co";

function absoluteSiteUrl(value: string | undefined, fallback = fallbackSiteUrl) {
  const candidate = value?.trim() || fallback;

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export const siteConfig = {
  name: "ContentOS",
  tagline: "Create platform-ready content from one idea.",
  description:
    "ContentOS turns one idea into platform-ready social content, including LinkedIn posts, Instagram captions, TikTok scripts, X threads, hooks, CTAs, hashtags, carousels and repurposing packs.",
  url: absoluteSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, absoluteSiteUrl(process.env.NEXT_PUBLIC_APP_URL)),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@getcontentos.co"
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
