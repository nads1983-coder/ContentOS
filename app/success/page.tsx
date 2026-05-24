import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PublicPage } from "@/components/public-page";
import { ClearPendingCheckout } from "@/components/clear-pending-checkout";
import { getEnv, isStripeConfigured } from "@/lib/env";
import { retrieveCheckoutSession, StripeCheckoutSession } from "@/lib/stripe-rest";

export const metadata = pageMetadata({
  title: "ContentOS Subscription Started",
  path: "/success",
  index: false
});

function promotionCodeValue(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return "";
  }

  if (typeof value === "object" && "code" in value) {
    return typeof value.code === "string" ? value.code : "";
  }

  return "";
}

function checkoutSessionPromotionCodes(session: StripeCheckoutSession) {
  const directCodes = session.discounts
    ?.map((discount) => promotionCodeValue(discount.promotion_code))
    .filter(Boolean) ?? [];
  const breakdownCodes = session.total_details?.breakdown?.discounts
    ?.map((discount) => promotionCodeValue(discount.discount?.promotion_code))
    .filter(Boolean) ?? [];

  return [...directCodes, ...breakdownCodes];
}

function checkoutSessionIsCreator(session: StripeCheckoutSession) {
  const env = getEnv();
  const metadataPlan = session.metadata?.plan;
  const priceIds = session.line_items?.data
    .map((item) => item.price?.id)
    .filter(Boolean) ?? [];

  return metadataPlan === "pro_creator" || priceIds.includes(env.stripeProCreatorPriceId);
}

async function isFoundingCreatorCheckout(sessionId?: string | string[]) {
  const id = Array.isArray(sessionId) ? sessionId[0] : sessionId;

  if (!id || !isStripeConfigured()) {
    return false;
  }

  try {
    const session = await retrieveCheckoutSession(id);
    const hasFoundingCode = checkoutSessionPromotionCodes(session)
      .some((code) => code.toUpperCase() === "FOUNDING100");

    return hasFoundingCode && checkoutSessionIsCreator(session);
  } catch (error) {
    console.warn("Unable to inspect checkout session for founding member success message", {
      sessionId: id,
      error
    });
    return false;
  }
}

export default async function SuccessPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showFoundingMessage = await isFoundingCreatorCheckout(params?.session_id);

  return (
    <PublicPage title="Subscription started">
      <ClearPendingCheckout />
      <p>Your Pro subscription has been activated successfully.</p>
      <p>You now have access to your upgraded ContentOS features.</p>
      {showFoundingMessage ? (
        <section className="rounded border border-gold/35 bg-gold/[0.08] p-4 text-bone">
          <p className="font-semibold text-goldSoft">
            You&apos;re in as a Founding Member. Start creating your first content pack.
          </p>
        </section>
      ) : null}
      <Link href="/dashboard" className="text-goldSoft hover:text-bone">
        Go to dashboard
      </Link>
    </PublicPage>
  );
}
