import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata: Metadata = {
  title: "Set up ContentOS Workspace",
  robots: {
    index: false,
    follow: false
  }
};

export default function OnboardingPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-bone">
      <section className="w-full max-w-2xl rounded border border-white/10 bg-panel/78 p-6 shadow-violet">
        <BrandLogo />
        <h1 className="mt-8 font-display text-3xl uppercase tracking-normal">
          Set up your workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Add your business, audience, goals, preferred platforms, and writing tone so ContentOS can generate better content.
        </p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
      </section>
    </main>
  );
}
