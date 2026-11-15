import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
      <footer className="border-t border-white/10 px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo />
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/features" className="hover:text-bone">Features</Link>
            <Link href="/pricing" className="hover:text-bone">Pricing</Link>
            <Link href="/workflows" className="hover:text-bone">Workflows</Link>
            <Link href="/about" className="hover:text-bone">About</Link>
            <Link href="/contact" className="hover:text-bone">Contact</Link>
            <Link href="/faq" className="hover:text-bone">FAQ</Link>
            <Link href="/refund-policy" className="hover:text-bone">Refund Policy</Link>
            <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-bone">
              {siteConfig.contactEmail}
            </a>
            <Link href="/privacy" className="hover:text-bone">Privacy</Link>
            <Link href="/terms" className="hover:text-bone">Terms</Link>
          </nav>
        </div>
      </footer>
  );
}
