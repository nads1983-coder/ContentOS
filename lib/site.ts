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
    "ContentOS is an authority-first AI content workflow for creators and professionals, turning one idea into structured LinkedIn posts, Instagram captions, TikTok scripts, X threads, hooks, CTAs, hashtags, carousels and repurposing packs.",
  url: absoluteSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, absoluteSiteUrl(process.env.NEXT_PUBLIC_APP_URL)),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@getcontentos.co",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@getcontentos.co"
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
