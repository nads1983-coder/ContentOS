import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "ContentOS Privacy Policy",
  path: "/privacy"
});

export default function PrivacyPage() {
  return (
    <PublicPage title="Privacy Policy" contactEmail={siteConfig.supportEmail} contactLabel="Privacy support">
      <p>ContentOS collects account details, billing references, saved content, generation history, onboarding responses, brand profile data, and usage information needed to provide the service.</p>
      <p>Content submitted for generation is processed to return outputs and may be stored when history or saved content features are enabled. API keys and payment credentials are never exposed client-side.</p>
      <p>
        GDPR-conscious controls should include account access, correction, export, and deletion requests through{" "}
        <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.
      </p>
    </PublicPage>
  );
}
