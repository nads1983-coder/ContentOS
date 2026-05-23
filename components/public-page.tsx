import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { siteConfig } from "@/lib/site";

export function PublicPage({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-8 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo />
          <Link href="/" className="text-sm text-muted hover:text-bone">
            Home
          </Link>
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
