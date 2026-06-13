import { createHmac, timingSafeEqual } from "crypto";
import { getEnv, isStripeConfigured } from "@/lib/env";
import { PlanId, SubscriptionStatus } from "@/types/saas";

export type BillingPlan = "pro_creator" | "pro_studio";

const apiVersion = "2026-02-25.clover";

type StripeList<T> = {
  data: T[];
};

type StripePrice = {
  id: string;
};

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  canceled_at?: number | null;
  metadata?: Record<string, string>;
  items?: StripeList<{
    price?: StripePrice;
  }>;
};

type StripeCustomer = {
  id: string;
  email?: string;
};

export type StripeSubscriptionState = {
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
};

export function normalizePlanId(value?: string | null): PlanId {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (normalized === "pro-studio" || normalized === "prostudio" || normalized === "studio") {
    return "pro_studio";
  }

  if (normalized === "founder" || normalized === "founding-member") {
    return "founder";
  }

  if (
    normalized === "pro-creator" ||
    normalized === "procreator" ||
    normalized === "creator" ||
    normalized === "pro" ||
    normalized === "paid" ||
    normalized === "premium"
  ) {
    return "pro_creator";
  }

  return "free";
}

export function normalizeSubscriptionStatus(value?: string | null): SubscriptionStatus {
  const normalized = value?.trim().toLowerCase().replace(/[_\s]+/g, "-");

  if (
    normalized === "trialing" ||
    normalized === "active" ||
    normalized === "past-due" ||
    normalized === "canceled" ||
    normalized === "incomplete"
  ) {
    return normalized.replace("-", "_") as SubscriptionStatus;
  }

  return "none";
}

function stripeRedirectUrl(path: string) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return new URL(safePath, getEnv().appUrl).toString();
}

function stripePriceId(plan: BillingPlan) {
  const env = getEnv();
  return plan === "pro_creator"
    ? env.stripeProCreatorPriceId
    : env.stripeProStudioPriceId;
}

async function stripeRequest<T>(path: string, body: URLSearchParams) {
  const env = getEnv();

  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": apiVersion
    },
    body,
    cache: "no-store"
  });

  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Stripe request failed.");
  }

  return data;
}

async function stripeGet<T>(path: string, query?: URLSearchParams) {
  const env = getEnv();

  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const url = new URL(`https://api.stripe.com/v1/${path}`);
  query?.forEach((value, key) => url.searchParams.append(key, value));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Stripe-Version": apiVersion
    },
    cache: "no-store"
  });

  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Stripe request failed.");
  }

  return data;
}

function planFromPriceId(priceId?: string): PlanId {
  const env = getEnv();

  if (
    priceId &&
    (priceId === env.stripeProStudioPriceId || env.stripeLegacyProStudioPriceIds.includes(priceId))
  ) {
    return "pro_studio";
  }

  if (
    priceId &&
    (priceId === env.stripeProCreatorPriceId || env.stripeLegacyProCreatorPriceIds.includes(priceId))
  ) {
    return "pro_creator";
  }

  return "free";
}

function planFromSubscription(subscription: StripeSubscription): PlanId {
  const metadataPlan = normalizePlanId(
    subscription.metadata?.plan ??
      subscription.metadata?.Plan ??
      subscription.metadata?.PLAN
  );

  if (metadataPlan !== "free") {
    return metadataPlan;
  }

  return planFromPriceId(subscription.items?.data[0]?.price?.id);
}

function timestampToIso(timestamp?: number | null) {
  if (timestamp === undefined) {
    return undefined;
  }

  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function hasActiveEntitlement(status: SubscriptionStatus) {
  return status === "active" || status === "trialing";
}

function hasFuturePeriodEnd(timestamp?: number | null) {
  return Boolean(timestamp && timestamp * 1000 > Date.now());
}

function effectiveSubscriptionStatus(subscription: StripeSubscription): SubscriptionStatus {
  const status = normalizeSubscriptionStatus(subscription.status);

  if (
    status === "canceled" &&
    hasFuturePeriodEnd(subscription.current_period_end)
  ) {
    return "active";
  }

  return status;
}

function subscriptionRank(subscription: StripeSubscription) {
  const status = effectiveSubscriptionStatus(subscription);

  if (hasActiveEntitlement(status)) {
    return 3;
  }

  if (status === "past_due") {
    return 2;
  }

  if (status === "incomplete") {
    return 1;
  }

  return 0;
}

export function stripeSubscriptionToState(subscription?: StripeSubscription | null): StripeSubscriptionState {
  if (!subscription) {
    return {
      plan: "free",
      status: "none"
    };
  }

  const status = effectiveSubscriptionStatus(subscription);
  const plan = hasActiveEntitlement(status) || status === "past_due"
    ? planFromSubscription(subscription)
    : "free";

  return {
    plan,
    status,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: timestampToIso(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    canceledAt: timestampToIso(subscription.canceled_at)
  };
}

export function planHasActiveEntitlement(plan: PlanId, status?: string) {
  return normalizePlanId(plan) !== "free" && hasActiveEntitlement(normalizeSubscriptionStatus(status));
}

function planRank(plan: PlanId) {
  const normalized = normalizePlanId(plan);

  if (normalized === "pro_studio") {
    return 2;
  }

  if (normalized === "founder" || normalized === "pro_creator") {
    return 1;
  }

  return 0;
}

export function reconcileActiveSubscriptionPlan(
  state: StripeSubscriptionState,
  storedPlan?: string | null
): StripeSubscriptionState {
  const normalizedStatePlan = normalizePlanId(state.plan);
  const normalizedStoredPlan = normalizePlanId(storedPlan);

  // Entitlements must be based on stable internal plan IDs, not displayed prices.
  // If Stripe confirms an active subscription but the price ID is not mapped
  // after a pricing change, never downgrade the user to Free during sync.
  if (
    normalizedStatePlan === "free" &&
    Boolean(state.stripeSubscriptionId) &&
    hasActiveEntitlement(normalizeSubscriptionStatus(state.status))
  ) {
    return {
      ...state,
      plan: normalizedStoredPlan !== "free" ? normalizedStoredPlan : "pro_creator"
    };
  }

  return {
    ...state,
    plan: normalizedStatePlan
  };
}

export function checkoutPlanMatchesState(plan: BillingPlan, state: StripeSubscriptionState) {
  return normalizePlanId(state.plan) === plan && hasActiveEntitlement(normalizeSubscriptionStatus(state.status));
}

export function checkoutPlanIsCoveredByState(plan: BillingPlan, state: StripeSubscriptionState) {
  return (
    hasActiveEntitlement(normalizeSubscriptionStatus(state.status)) &&
    planRank(normalizePlanId(state.plan)) >= planRank(plan)
  );
}

export function hasActiveUnknownPaidSubscription(state: StripeSubscriptionState) {
  return (
    hasActiveEntitlement(normalizeSubscriptionStatus(state.status)) &&
    normalizePlanId(state.plan) === "free" &&
    Boolean(state.stripeSubscriptionId)
  );
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeGet<StripeSubscription>(
    `subscriptions/${subscriptionId}`,
    new URLSearchParams({
      "expand[]": "items.data.price"
    })
  );
}

export async function listStripeCustomerSubscriptions(customerId: string) {
  return stripeGet<StripeList<StripeSubscription>>(
    "subscriptions",
    new URLSearchParams({
      customer: customerId,
      status: "all",
      limit: "10",
      "expand[]": "data.items.data.price"
    })
  );
}

export async function listStripeCustomersByEmail(email: string) {
  return stripeGet<StripeList<StripeCustomer>>(
    "customers",
    new URLSearchParams({
      email,
      limit: "10"
    })
  );
}

export async function findStripeCustomerByEmail(email: string) {
  const customers = await listStripeCustomersByEmail(email);

  return customers.data[0] ?? null;
}

export async function getStripeSubscriptionState(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  email?: string | null;
}) {
  let customerId = input.stripeCustomerId ?? undefined;
  const subscriptions: StripeSubscription[] = [];
  const diagnostic = {
    authenticatedEmail: input.email,
    storedStripeCustomerId: input.stripeCustomerId,
    storedStripeSubscriptionId: input.stripeSubscriptionId,
    stripeCustomersFoundByEmail: [] as string[],
    subscriptionsReturned: [] as Array<{
      id: string;
      customer: string;
      rawStatus: string;
      effectiveStatus: SubscriptionStatus;
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: string | null;
      resolvedPlan: PlanId;
    }>
  };

  function trackSubscriptions(nextSubscriptions: StripeSubscription[]) {
    nextSubscriptions.forEach((subscription) => {
      diagnostic.subscriptionsReturned.push({
        id: subscription.id,
        customer: subscription.customer,
        rawStatus: subscription.status,
        effectiveStatus: effectiveSubscriptionStatus(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: timestampToIso(subscription.current_period_end),
        resolvedPlan: planFromSubscription(subscription)
      });
    });
  }

  function selectBestSubscription() {
    return subscriptions
      .filter((subscription, index, all) =>
        all.findIndex((item) => item.id === subscription.id) === index
      )
      .sort((a, b) => {
        const rank = subscriptionRank(b) - subscriptionRank(a);

        if (rank !== 0) {
          return rank;
        }

        return (b.current_period_end ?? 0) - (a.current_period_end ?? 0);
      })[0];
  }

  if (input.stripeSubscriptionId) {
    try {
      const subscription = await retrieveStripeSubscription(input.stripeSubscriptionId);
      subscriptions.push(subscription);
      trackSubscriptions([subscription]);
      customerId = subscription.customer;
    } catch {
      // Fall back to customer/email lookup if the stored subscription is no longer retrievable.
    }
  }

  if (!customerId && input.email) {
    const customers = await listStripeCustomersByEmail(input.email);
    diagnostic.stripeCustomersFoundByEmail = customers.data.map((customer) => customer.id);
    const customer = customers.data[0] ?? null;
    customerId = customer?.id;
  }

  if (customerId) {
    const customerSubscriptions = await listStripeCustomerSubscriptions(customerId);
    subscriptions.push(...customerSubscriptions.data);
    trackSubscriptions(customerSubscriptions.data);
  }

  const bestKnownSubscription = selectBestSubscription();

  if (
    input.email &&
    (!bestKnownSubscription || subscriptionRank(bestKnownSubscription) < 3)
  ) {
    const customers = await listStripeCustomersByEmail(input.email);
    diagnostic.stripeCustomersFoundByEmail = customers.data.map((customer) => customer.id);

    for (const customer of customers.data) {
      if (customer.id === customerId) {
        continue;
      }

      const customerSubscriptions = await listStripeCustomerSubscriptions(customer.id);
      subscriptions.push(...customerSubscriptions.data);
      trackSubscriptions(customerSubscriptions.data);

      const bestSubscription = selectBestSubscription();

      if (bestSubscription && subscriptionRank(bestSubscription) >= 3) {
        customerId = bestSubscription.customer;
        break;
      }
    }
  }

  const bestSubscription = selectBestSubscription();

  const state = stripeSubscriptionToState(bestSubscription);
  console.log("Stripe subscription lookup diagnostic", {
    ...diagnostic,
    selectedSubscription: bestSubscription
      ? {
        id: bestSubscription.id,
        customer: bestSubscription.customer,
        rawStatus: bestSubscription.status,
        effectiveStatus: effectiveSubscriptionStatus(bestSubscription),
        cancelAtPeriodEnd: bestSubscription.cancel_at_period_end,
        currentPeriodEnd: timestampToIso(bestSubscription.current_period_end),
        resolvedBillingPlan: state.plan
      }
      : null,
    finalStatus: state.status,
    finalPlan: state.plan,
    finalStripeCustomerId: state.stripeCustomerId ?? customerId
  });

  return {
    ...state,
    stripeCustomerId: state.stripeCustomerId ?? customerId
  };
}

export async function createCheckoutSession(input: {
  plan: BillingPlan;
  userId?: string;
  email?: string;
  stripeCustomerId?: string;
}) {
  const price = stripePriceId(input.plan);

  if (!price) {
    throw new Error("Stripe price ID is not configured.");
  }

  const body = new URLSearchParams(Object.entries({
    mode: "subscription",
    success_url: stripeRedirectUrl("/success?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: stripeRedirectUrl("/cancel"),
    allow_promotion_codes: true,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "metadata[plan]": input.plan,
    "subscription_data[metadata][plan]": input.plan
  }).map(([key, value]) => [key, String(value)]));

  if (input.userId) {
    body.set("client_reference_id", input.userId);
    body.set("metadata[user_id]", input.userId);
    body.set("subscription_data[metadata][user_id]", input.userId);
  }

  if (input.stripeCustomerId) {
    body.set("customer", input.stripeCustomerId);
  } else if (input.email) {
    body.set("customer_email", input.email);
  }

  return stripeRequest<{ id: string; url: string }>("checkout/sessions", body);
}

export type StripeCheckoutSession = {
  id: string;
  metadata?: Record<string, string>;
  discounts?: Array<{
    promotion_code?: string | {
      id?: string;
      code?: string;
    } | null;
  }>;
  line_items?: {
    data: Array<{
      price?: StripePrice;
    }>;
  };
  total_details?: {
    breakdown?: {
      discounts?: Array<{
        discount?: {
          promotion_code?: string | {
            id?: string;
            code?: string;
          } | null;
        };
      }>;
    };
  };
};

export async function retrieveCheckoutSession(sessionId: string) {
  const query = new URLSearchParams();
  query.append("expand[]", "line_items.data.price");
  query.append("expand[]", "discounts.promotion_code");
  query.append("expand[]", "total_details.breakdown.discounts.discount.promotion_code");

  return stripeGet<StripeCheckoutSession>(
    `checkout/sessions/${encodeURIComponent(sessionId)}`,
    query
  );
}

export async function createCustomerPortalSession(input: {
  customerId: string;
}) {
  return stripeRequest<{ url: string }>(
    "billing_portal/sessions",
    new URLSearchParams({
      customer: input.customerId,
      return_url: stripeRedirectUrl("/dashboard")
    })
  );
}

export function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const secret = getEnv().stripeWebhookSecret;

  if (!secret || !signatureHeader) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );

  if (!parts.t || !parts.v1) {
    return false;
  }

  const signedPayload = `${parts.t}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const actual = Buffer.from(parts.v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (actual.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actual, expectedBuffer);
}
