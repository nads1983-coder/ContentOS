import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ContentOS Refund Policy",
  path: "/refund-policy"
});

export default function RefundPolicyPage() {
  return (
    <PublicPage title="Refund Policy">
      <p>Subscription cancellations take effect at the end of the current billing period unless otherwise required by law.</p>
      <p>Refund requests are reviewed case by case. Contact support with your account email, Stripe invoice ID, and reason for the request.</p>
    </PublicPage>
  );
}
