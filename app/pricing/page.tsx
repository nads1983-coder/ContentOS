import { CheckoutButton } from "@/components/billing-buttons";
import { pageMetadata } from "@/lib/metadata";
import { PublicPage } from "@/components/public-page";

export const metadata = pageMetadata({
  title: "ContentOS Pricing | Simple Pricing for Creators and Teams",
  path: "/pricing"
});

export default function PricingPage() {
  return (
    <PublicPage title="Simple pricing for creators and teams">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-lg font-semibold text-bone">Free</h2>
          <p>Basic generation, limited monthly generations, and core post formats.</p>
        </div>
        <div className="rounded border border-gold/60 bg-gold/10 p-4">
          <h2 className="text-lg font-semibold text-bone">Pro Creator, £19/month</h2>
          <p>Unlimited generations, multi-platform outputs, formatter tools, repurposing packs, saved library, exports, and brand voice memory.</p>
          <div className="mt-4"><CheckoutButton plan="pro_creator">Upgrade to Pro Creator</CheckoutButton></div>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-lg font-semibold text-bone">Pro Studio, £49/month</h2>
          <p>Multiple brand profiles, workspace organization, higher usage limits, advanced workflows, AI image generation, downloadable PNG visuals, social graphic generation, and future team support.</p>
          <div className="mt-4"><CheckoutButton plan="pro_studio">Upgrade to Pro Studio</CheckoutButton></div>
        </div>
      </section>
    </PublicPage>
  );
}
