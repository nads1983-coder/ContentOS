import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";

export const metadata = pageMetadata({
  title: "ContentOS Features | AI Social Content Workflow",
  description: "See how ContentOS turns rough ideas into social drafts, adapts tone and formats, and helps you edit, preview, save and export content for your business.",
  path: "/features"
});

export default function FeaturesPage() {
  return (
    <PublicPage title="Features">
      <p>ContentOS gives founders and small businesses a workspace for turning rough ideas into social content drafts. Start with your notes, choose the formats you need, then review and edit the results before publishing.</p>
      <h2 className="text-lg font-semibold text-bone">Turn one idea into several social drafts</h2>
      <p>Enter an idea, a short brief or existing copy in the Studio and select outputs for LinkedIn, Instagram, TikTok, X, Facebook or YouTube Shorts. You can also request hooks and hashtags. For example, a consultant can use notes from a customer question to draft a LinkedIn explanation and an Instagram caption without starting each one from scratch.</p>
      <h2 className="text-lg font-semibold text-bone">Give each draft the right context and tone</h2>
      <p>Advanced settings let you supply your brand name, audience, offer and voice preferences, then choose a tone and content length. A local business might specify a friendly tone, a first-time customer audience and a clear invitation to enquire. These inputs give the draft direction; you still decide whether the wording sounds like your business.</p>
      <h2 className="text-lg font-semibold text-bone">Edit and refine before you publish</h2>
      <p>Edit generated text directly, or request a change to shorten a draft, adjust its tone or sharpen its message. For instance, turn a long introduction into a concise opening while retaining the offer details. AI refinements use generation allowance. Check names, facts, prices and claims yourself before treating a draft as final.</p>
      <h2 className="text-lg font-semibold text-bone">Preview formatting and take your copy with you</h2>
      <p>The formatter provides platform previews with mobile and desktop views, helping you check line breaks and how a post reads. Copy and text-file download from the formatter are paid-plan features, so you can take the formatted copy into your publishing workflow. Previews help with presentation; review the final post in the platform where you publish it.</p>
      <h2 className="text-lg font-semibold text-bone">Keep drafts and return to saved work</h2>
      <p>Save a draft of your source text and settings so you can return to the idea later. Saved content history is a paid-plan feature: it lets you revisit earlier outputs when preparing follow-up content or reviewing a previous draft.</p>
      <h2 className="text-lg font-semibold text-bone">Adapt an idea into longer formats on paid plans</h2>
      <p>Paid formats include X threads, video scripts, carousel outlines, email drafts, repurposing packs and calls to action. A founder could turn product-launch notes into a carousel outline and an email draft, then edit each for its audience. These are written drafts and outlines to work from, so allow time for your own design, recording and publication steps.</p>
      <p>Explore the <Link href="/studio">ContentOS Studio</Link> to see the current controls, or compare format access and generation allowances on the <Link href="/pricing">pricing page</Link>. For a repeatable review process, use our <Link href="/blog/content-workflow-quality-review-system">content workflow quality-review checklist</Link>.</p>
    </PublicPage>
  );
}
