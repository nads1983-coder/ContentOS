import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ContentOS FAQ | AI Social Content Generator",
  path: "/faq"
});

export default function FAQPage() {
  return (
    <PublicPage title="FAQ">
      <h2 className="text-lg font-semibold text-bone">What is ContentOS?</h2>
      <p>ContentOS is an AI social content generator that turns one idea into platform-ready social content packs.</p>
      <h2 className="text-lg font-semibold text-bone">Who is ContentOS for?</h2>
      <p>It is for founders, creators, consultants, freelancers, agencies, coaches, small teams, and personal brands.</p>
      <h2 className="text-lg font-semibold text-bone">What platforms does ContentOS support?</h2>
      <p>LinkedIn, Instagram, TikTok, X/Twitter, Facebook, YouTube Shorts, carousels, scripts, and newsletters.</p>
      <h2 className="text-lg font-semibold text-bone">Can ContentOS repurpose one idea into multiple formats?</h2>
      <p>Yes. The workspace creates posts, captions, hooks, CTAs, hashtags, carousels, video scripts, and newsletter drafts from one source.</p>
    </PublicPage>
  );
}
