import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact ContentOS Support",
  description: "Contact ContentOS for account access, billing help and technical support, or get in touch about partnerships, press and general enquiries.",
  path: "/contact"
});

export default function ContactPage() {
  return (
    <PublicPage title="Contact and support">
      <p>
        For partnerships, press, collaborations, or general enquiries, email{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
      </p>
      <p>
        For account access, billing support, password resets, or issue reports, email{" "}
        <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.
      </p>
      <p>For account or billing help, contact support@getcontentos.co.</p>
    </PublicPage>
  );
}
