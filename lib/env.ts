const fallbackAppUrl = "https://getcontentos.co";

function absoluteUrlEnv(value: string | undefined, fallback = fallbackAppUrl) {
  const candidate = value?.trim() || fallback;

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}


const serverEnv = {
  appUrl: absoluteUrlEnv(process.env.NEXT_PUBLIC_APP_URL),
  siteUrl: absoluteUrlEnv(process.env.NEXT_PUBLIC_SITE_URL, absoluteUrlEnv(process.env.NEXT_PUBLIC_APP_URL)),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeProCreatorPriceId: process.env.STRIPE_PRO_CREATOR_PRICE_ID ?? "",
  stripeProStudioPriceId: process.env.STRIPE_PRO_STUDIO_PRICE_ID ?? "",
  stripeFounderCouponId: process.env.STRIPE_FOUNDER_COUPON_ID ?? "",
  stripeFounderPromotionCodeId: process.env.STRIPE_FOUNDER_PROMOTION_CODE_ID ?? "",
  stripeLegacyProCreatorPriceIds: (process.env.STRIPE_LEGACY_PRO_CREATOR_PRICE_IDS ?? "")
    .split(",")
    .map((priceId) => priceId.trim())
    .filter(Boolean),
  stripeLegacyProStudioPriceIds: (process.env.STRIPE_LEGACY_PRO_STUDIO_PRICE_IDS ?? "")
    .split(",")
    .map((priceId) => priceId.trim())
    .filter(Boolean),
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
};

export type AppEnv = typeof serverEnv;

export function getEnv() {
  return serverEnv;
}

export function isStripeConfigured() {
  return Boolean(serverEnv.stripeSecretKey);
}
