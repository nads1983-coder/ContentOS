import { PublicPage } from "@/components/public-page";

export default function PrivacyPage() {
  return (
    <PublicPage title="Privacy Policy">
      <p>ContentOS collects account details, billing references, saved content, generation history, onboarding responses, brand profile data, and usage information needed to provide the service.</p>
      <p>Content submitted for generation is processed to return outputs and may be stored when history or saved content features are enabled. API keys and payment credentials are never exposed client-side.</p>
      <p>GDPR-conscious controls should include account access, correction, export, and deletion requests through support.</p>
    </PublicPage>
  );
}
