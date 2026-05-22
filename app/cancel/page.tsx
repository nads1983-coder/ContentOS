import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PublicPage } from "@/components/public-page";

export const metadata = pageMetadata({
  title: "ContentOS Checkout Cancelled",
  path: "/cancel",
  index: false
});

export default function CancelPage() {
  return (
    <PublicPage title="Checkout cancelled">
      <p>No payment was taken. You can return to pricing whenever you are ready.</p>
      <Link href="/pricing" className="text-goldSoft hover:text-bone">
        View pricing
      </Link>
    </PublicPage>
  );
}
