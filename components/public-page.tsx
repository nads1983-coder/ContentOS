import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { siteConfig } from "@/lib/site";

export function PublicPage({
  title,
  children,
  contactEmail = siteConfig.contactEmail,
  contactLabel = "Contact"
}: {
  title: string;
  children: React.ReactNode;
  contactEmail?: string;
  contactLabel?: string;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-8 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <BrandLogo />
          <nav className="flex items-center gap-4 text-sm text-muted" aria-label="Page">
            <Link href="/" className="hover:text-bone">
              Home
            </Link>
            <Link href="/blog" className="hover:text-bone">
              Blog
            </Link>
            <Link href="/login" className="hover:text-bone">
              Log in
            </Link>
          </nav>
        </div>
        <article className="mt-10 rounded border border-white/10 bg-panel/78 p-4 shadow-violet sm:p-6">
          <h1 className="font-display text-3xl uppercase tracking-normal sm:text-4xl">{title}</h1>
          <div className="prose-content mt-6 grid gap-5 text-sm leading-7 text-muted">
            {children}
          </div>
          <p className="mt-8 text-xs text-muted">
            {contactLabel}:{" "}
            <a href={`mailto:${contactEmail}`} className="text-goldSoft hover:text-bone">
              {contactEmail}
            </a>
          </p>
        </article>
      </div>
    </main>
  );
}
