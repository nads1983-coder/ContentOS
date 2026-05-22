import { PublicPage } from "@/components/public-page";
import { siteConfig } from "@/lib/site";

export default function ContactPage() {
  return (
    <PublicPage title="Contact and support">
      <p>For support, billing questions, issue reports, or partnership enquiries, contact {siteConfig.supportEmail}.</p>
      <p>The production contact form is ready to connect to the Supabase leads table included in the database schema.</p>
    </PublicPage>
  );
}
