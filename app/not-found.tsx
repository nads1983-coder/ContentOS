import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-bone">
      <section className="w-full max-w-lg rounded border border-white/10 bg-panel/78 p-6 shadow-violet">
        <BrandLogo />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
          404
        </p>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-normal">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This page does not exist or has moved. Return to ContentOS and keep creating from there.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white transition hover:bg-violetDeep"
          >
            Back home
          </Link>
          <Link
            href="/studio"
            className="flex min-h-11 items-center justify-center rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-gold/60"
          >
            Open studio
          </Link>
        </div>
      </section>
    </main>
  );
}
