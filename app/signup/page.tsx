import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Create a ContentOS Account",
  path: "/signup",
  index: false
});

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden px-4 py-10 text-bone">
      <section className="w-full max-w-md rounded border border-white/10 bg-panel/78 p-4 shadow-violet sm:p-6">
        <BrandLogo />
        <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Start generating content packs and save your best outputs.
        </p>
        <div className="mt-6">
          <AuthForm mode="signup" />
        </div>
      </section>
    </main>
  );
}
