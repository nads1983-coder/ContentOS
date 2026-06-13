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

const appwriteProjectId = process.env.APPWRITE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() || "";

const serverEnv = {
  appUrl: absoluteUrlEnv(process.env.NEXT_PUBLIC_APP_URL),
  siteUrl: absoluteUrlEnv(process.env.NEXT_PUBLIC_SITE_URL, absoluteUrlEnv(process.env.NEXT_PUBLIC_APP_URL)),
  appwriteEndpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "",
  appwriteProjectId,
  appwriteProjectIdSource: process.env.APPWRITE_PROJECT_ID?.trim() ? "APPWRITE_PROJECT_ID" : "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  appwriteApiKey: process.env.APPWRITE_API_KEY ?? "",
  appwriteDatabaseId: process.env.APPWRITE_DATABASE_ID ?? "",
  appwriteUsersCollectionId: process.env.APPWRITE_USERS_COLLECTION_ID ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeProCreatorPriceId: process.env.STRIPE_PRO_CREATOR_PRICE_ID ?? "",
  stripeProStudioPriceId: process.env.STRIPE_PRO_STUDIO_PRICE_ID ?? "",
  stripeLegacyProCreatorPriceIds: (process.env.STRIPE_LEGACY_PRO_CREATOR_PRICE_IDS ?? "")
    .split(",")
    .map((priceId) => priceId.trim())
    .filter(Boolean),
  stripeLegacyProStudioPriceIds: (process.env.STRIPE_LEGACY_PRO_STUDIO_PRICE_IDS ?? "")
    .split(",")
    .map((priceId) => priceId.trim())
    .filter(Boolean),
  plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "",
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

export function isAppwriteConfigured() {
  return Boolean(serverEnv.appwriteEndpoint && serverEnv.appwriteProjectId);
}

export function isAppwriteAdminConfigured() {
  return Boolean(
    serverEnv.appwriteEndpoint &&
      serverEnv.appwriteProjectId &&
      serverEnv.appwriteApiKey &&
      serverEnv.appwriteDatabaseId &&
      serverEnv.appwriteUsersCollectionId
  );
}

export function isStripeConfigured() {
  return Boolean(serverEnv.stripeSecretKey);
}
