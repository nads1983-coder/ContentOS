import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact ContentOS Support",
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
      <p>The production contact form is ready to connect to the Appwrite leads collection included in the Appwrite collection setup.</p>
    </PublicPage>
  );
}
