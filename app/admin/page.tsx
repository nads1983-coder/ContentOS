import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ContentOS Admin",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || !isAdminEmail(user.email)) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-bone">
        <section className="rounded border border-white/10 bg-panel/78 p-6">
          <BrandLogo />
          <h1 className="mt-6 text-2xl font-semibold">Admin access required</h1>
          <Link href="/login" className="mt-4 block text-sm text-goldSoft">
            Log in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <BrandLogo />
        <h1 className="mt-8 font-display text-4xl uppercase tracking-normal">
          Admin dashboard
        </h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            "Total users",
            "Active subscriptions",
            "Cancelled subscriptions",
            "Generation volume",
            "Failed requests",
            "Usage metrics"
          ].map((item) => (
            <article key={item} className="rounded border border-white/10 bg-panel/78 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">{item}</p>
              <p className="mt-3 text-sm text-muted">Connect Supabase reporting views for live data.</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
