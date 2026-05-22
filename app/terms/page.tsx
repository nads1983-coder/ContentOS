import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "ContentOS Terms of Service",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <PublicPage title="Terms of Service">
      <p>ContentOS provides AI-assisted content generation and workflow tools. Users are responsible for reviewing outputs before publication.</p>
      <p>Users must not submit unlawful, confidential, or third-party protected material unless they have the right to do so.</p>
      <p>Paid subscriptions renew until cancelled through the billing portal once Stripe is configured.</p>
    </PublicPage>
  );
}
