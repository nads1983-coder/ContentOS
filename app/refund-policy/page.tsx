import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "ContentOS Refund Policy",
  path: "/refund-policy"
});

export default function RefundPolicyPage() {
  return (
    <PublicPage title="Refund Policy" contactEmail={siteConfig.supportEmail} contactLabel="Billing support">
      <p>Subscription cancellations take effect at the end of the current billing period unless otherwise required by law.</p>
      <p>
        Refund requests are reviewed case by case. Email{" "}
        <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>{" "}
        with your account email, Stripe invoice ID, and reason for the request.
      </p>
    </PublicPage>
  );
}
