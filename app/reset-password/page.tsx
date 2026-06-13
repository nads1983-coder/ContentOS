import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { BrandLogo } from "@/components/brand-logo";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Reset ContentOS Password",
  path: "/reset-password",
  index: false
});

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden px-4 py-10 text-bone">
      <section className="w-full max-w-md rounded border border-white/10 bg-panel/78 p-4 shadow-violet sm:p-6">
        <BrandLogo />
        <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Send a secure password reset link through ContentOS.
        </p>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
        <Link href="/login" className="mt-6 block text-sm text-muted hover:text-bone">
          Back to login
        </Link>
      </section>
    </main>
  );
}
