import { absoluteUrl } from "@/lib/site";
import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "About ContentOS | AI Social Content Generator",
  description: "Learn about ContentOS, the AI social content workspace built to help founders, creators and small businesses turn rough ideas into content drafts.",
  path: "/about"
});

export default function AboutPage() {
  return (
    <PublicPage title="About ContentOS">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "AboutPage", name: "About ContentOS", url: absoluteUrl("/about"), description: "ContentOS is an AI social content workspace for founders, creators, consultants, freelancers, agencies and small teams." }).replace(/</g, "\\u003c") }} />
      <p>ContentOS is a premium AI social content workspace for founders, creators, consultants, freelancers, agencies, coaches, personal brands, and small teams.</p>
      <p>The product is designed around one practical promise: turn a rough idea into a complete platform-ready content pack without starting from a blank page.</p>
    </PublicPage>
  );
}
