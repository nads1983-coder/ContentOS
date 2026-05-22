import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PublicPage } from "@/components/public-page";

export const metadata = pageMetadata({
  title: "ContentOS Subscription Started",
  path: "/success",
  index: false
});

export default function SuccessPage() {
  return (
    <PublicPage title="Subscription started">
      <p>Your Pro subscription has been activated successfully.</p>
      <p>You now have access to your upgraded ContentOS features.</p>
      <Link href="/dashboard" className="text-goldSoft hover:text-bone">
        Go to dashboard
      </Link>
    </PublicPage>
  );
}
