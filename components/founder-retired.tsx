import Link from "next/link";
import { PublicPage } from "@/components/public-page";
import { founderRetiredMessage } from "@/lib/founder-retirement";

export function FounderRetired() {
  return (
    <PublicPage title="The Founding 100 offer has closed">
      <p>{founderRetiredMessage}</p>
      <div className="flex flex-wrap gap-5">
        <Link href="/login" className="underline">Log in to your account</Link>
        <Link href="/pricing" className="underline">View current plans</Link>
      </div>
    </PublicPage>
  );
}
