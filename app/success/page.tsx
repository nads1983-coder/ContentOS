import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PublicPage } from "@/components/public-page";
import { ClearPendingCheckout } from "@/components/clear-pending-checkout";
import { getEnv, isStripeConfigured } from "@/lib/env";
import { retrieveCheckoutSession, StripeCheckoutSession } from "@/lib/stripe-rest";
import { paidLifetimeSuccessMessage } from "@/lib/paid-lifetime-success";

export const metadata = pageMetadata({
  title: "ContentOS Checkout Status",
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
    const hasVerifiedFounderMetadata =
      session.metadata?.offer === "founder" &&
      session.metadata?.founder_offer === "true" &&
      session.metadata?.expected_total === "0" &&
      session.amount_total === 0;
    const hasFoundingCode = checkoutSessionPromotionCodes(session)
      .some((code) => code.toUpperCase() === "FOUNDING100");

    return (hasVerifiedFounderMetadata || hasFoundingCode) &&
      session.amount_total === 0 &&
      checkoutSessionIsCreator(session);
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
  const isLifetime = params?.lifetime === "1";
  const sessionId = Array.isArray(params?.session_id) ? params.session_id[0] : params?.session_id;
  const lifetimeMessage = isLifetime ? await paidLifetimeSuccessMessage(sessionId) : null;
  const showFoundingMessage = !isLifetime && await isFoundingCreatorCheckout(params?.session_id);

  return (
    <PublicPage title={isLifetime ? "Creator lifetime payment status" : showFoundingMessage ? "Founder access active" : "Checkout received"}>
      <ClearPendingCheckout />
      {lifetimeMessage ? <p>{lifetimeMessage}</p> : showFoundingMessage ? (
        <section className="rounded border border-gold/35 bg-gold/[0.08] p-4 text-bone">
          <p className="font-semibold text-goldSoft">
            Your Founder access is active. You have not been charged.
          </p>
          <p className="mt-2 text-sm text-muted">
            You&apos;re in as a Founding Member. Start creating your first content pack.
          </p>
        </section>
      ) : (
        <>
          <p>Check your dashboard for your subscription and payment status.</p>
        </>
      )}
      <Link href="/dashboard" className="text-goldSoft hover:text-bone">
        Go to dashboard
      </Link>
    </PublicPage>
  );
}
