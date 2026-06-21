import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentUser } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";
import { BillingPlan } from "@/lib/pricing";

export const metadata = pageMetadata({
  title: "Log in to ContentOS",
  path: "/login",
  index: false
});

function parseBillingPlan(value?: string | string[]): BillingPlan | null {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan === "pro_creator" || plan === "pro_studio" ? plan : null;
}

function parseFounderOffer(value?: string | string[]) {
  const flag = Array.isArray(value) ? value[0] : value;
  return flag === "1" || flag === "true";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const plan = parseBillingPlan(params?.plan);
  const founderOffer = parseFounderOffer(params?.founder);

  if (user) {
    redirect(founderOffer ? "/founder/checkout" : "/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden px-4 py-10 text-bone">
      <section className="w-full max-w-md rounded border border-white/10 bg-panel/78 p-4 shadow-violet sm:p-6">
        <BrandLogo />
        <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">Log in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Access your ContentOS workspace, saved content, usage, and billing.
        </p>
        <div className="mt-6">
          <AuthForm mode="login" initialPlan={plan} initialFounderOffer={founderOffer} />
        </div>
        <Link href="/" className="mt-6 block text-sm text-muted hover:text-bone">
          Back to ContentOS
        </Link>
      </section>
    </main>
  );
}
