import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-bone">
      <section className="w-full max-w-md rounded border border-white/10 bg-panel/78 p-6 shadow-violet">
        <BrandLogo />
        <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Start generating content packs and save your best outputs.
        </p>
        <div className="mt-6">
          <AuthForm mode="signup" />
        </div>
        <Link href="/login" className="mt-6 block text-sm text-muted hover:text-bone">
          Already have an account? Log in
        </Link>
      </section>
    </main>
  );
}
