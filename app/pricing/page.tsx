import { CheckoutButton } from "@/components/billing-buttons";
import { PublicPage } from "@/components/public-page";

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
          <div className="mt-4"><CheckoutButton plan="pro_creator">Upgrade</CheckoutButton></div>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-lg font-semibold text-bone">Pro Studio, £49/month</h2>
          <p>Multiple brand profiles, workspace organization, higher usage limits, advanced workflows, and future team support.</p>
          <div className="mt-4"><CheckoutButton plan="pro_studio">Upgrade</CheckoutButton></div>
        </div>
      </section>
    </PublicPage>
  );
}
