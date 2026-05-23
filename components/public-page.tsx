import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { getServerBillingState } from "@/lib/server-billing-state";
import { siteConfig } from "@/lib/site";

export async function PublicPage({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  const billingState = await getServerBillingState();

  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-8 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo />
          <nav className="flex items-center gap-4 text-sm text-muted" aria-label="Page">
            <Link href="/" className="hover:text-bone">
              Home
            </Link>
            <Link href={billingState.isLoggedIn ? "/dashboard" : "/login"} className="hover:text-bone">
              {billingState.isLoggedIn ? "Account" : "Log in"}
            </Link>
            {billingState.isLoggedIn ? <LogoutButton className="text-sm text-muted hover:text-bone" /> : null}
          </nav>
        </div>
        <article className="mt-10 rounded border border-white/10 bg-panel/78 p-4 shadow-violet sm:p-6">
          <h1 className="font-display text-3xl uppercase tracking-normal sm:text-4xl">{title}</h1>
          <div className="prose-content mt-6 grid gap-5 text-sm leading-7 text-muted">
            {children}
          </div>
          <p className="mt-8 text-xs text-muted">
            Contact: {siteConfig.supportEmail}
          </p>
        </article>
      </div>
    </main>
  );
}
