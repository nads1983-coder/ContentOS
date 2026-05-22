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
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeProCreatorPriceId: process.env.STRIPE_PRO_CREATOR_PRICE_ID ?? "",
  stripeProStudioPriceId: process.env.STRIPE_PRO_STUDIO_PRICE_ID ?? "",
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

export function isSupabaseConfigured() {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseAnonKey);
}

export function isSupabaseAdminConfigured() {
  return Boolean(
    serverEnv.supabaseUrl &&
      serverEnv.supabaseServiceRoleKey
  );
}

export function isStripeConfigured() {
  return Boolean(serverEnv.stripeSecretKey);
}
