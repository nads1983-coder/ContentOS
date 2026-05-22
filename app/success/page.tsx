import Link from "next/link";
import { PublicPage } from "@/components/public-page";

export default function SuccessPage() {
  return (
    <PublicPage title="Subscription started">
      <p>Your checkout completed. Stripe will sync the subscription through the webhook once it is configured.</p>
      <Link href="/dashboard" className="text-goldSoft hover:text-bone">
        Go to dashboard
      </Link>
    </PublicPage>
  );
}
