import Link from "next/link";
import { PublicPage } from "@/components/public-page";

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
