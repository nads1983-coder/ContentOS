import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-bone">
      <section className="w-full max-w-md rounded border border-white/10 bg-panel/78 p-6 shadow-violet">
        <BrandLogo />
        <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">Log in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Access your ContentOS workspace, saved content, usage, and billing.
        </p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
        <Link href="/" className="mt-6 block text-sm text-muted hover:text-bone">
          Back to ContentOS
        </Link>
      </section>
    </main>
  );
}
