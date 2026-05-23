import { Suspense } from "react";
import { AuthCallbackClient } from "@/components/auth-callback-client";
import { pageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Confirming ContentOS Account",
  path: "/auth/callback",
  index: false
});

export default function AuthCallbackPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-bone">
      <section className="w-full max-w-md rounded border border-white/10 bg-panel/78 p-5 shadow-violet sm:p-6">
        <Suspense fallback={<p className="text-sm text-muted">Confirming your account...</p>}>
          <AuthCallbackClient />
        </Suspense>
      </section>
    </main>
  );
}
