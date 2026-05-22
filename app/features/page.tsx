import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ContentOS Features | AI Social Content Workflow",
  path: "/features"
});

export default function FeaturesPage() {
  return (
    <PublicPage title="Features">
      <p>ContentOS helps teams generate, format, refine, save, and repurpose social content from one rough idea.</p>
      <p>Core workflows include AI post generation, repurposing packs, platform formatting, carousel outlines, short-form scripts, saved content, exports, prompt presets, and brand voice memory.</p>
    </PublicPage>
  );
}
