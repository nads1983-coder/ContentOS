import Link from "next/link";
import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Founding 100 Offer Closed | ContentOS",
  description: "The Founding 100 offer is closed. Existing Founder lifetime benefits are unchanged.",
  path: "/founder",
  index: false
});

export default function FounderPage() {
  return <PublicPage title="The Founding 100 offer has closed">
    <p>New Founder claims are no longer available. Existing Founder customers keep their lifetime access and benefits.</p>
    <p>If you already received a valid Stripe checkout link, its original expiry still applies. Completed qualifying checkouts continue to be honoured.</p>
    <p><Link href="/pricing" className="underline">View current plans</Link></p>
    <p><Link href="/login" className="underline">Sign in to your existing account</Link></p>
  </PublicPage>;
}
