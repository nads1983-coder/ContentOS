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

  if (priceId && priceId === env.stripeProStudioPriceId) {
    return "pro_studio";
  }

  if (priceId && priceId === env.stripeProCreatorPriceId) {
    return "pro_creator";
  }

  return "free";
}

function planFromSubscription(subscription: StripeSubscription): PlanId {
  const metadataPlan = subscription.metadata?.plan;

  if (metadataPlan === "pro_studio" || metadataPlan === "pro_creator") {
    return metadataPlan;
  }

  return planFromPriceId(subscription.items?.data[0]?.price?.id);
}

function normalizeStatus(status?: string): SubscriptionStatus {
  if (
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "incomplete"
  ) {
    return status;
  }

  return "none";
}

function timestampToIso(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function hasActiveEntitlement(status: SubscriptionStatus) {
  return status === "active" || status === "trialing";
}

function subscriptionRank(subscription: StripeSubscription) {
  const status = normalizeStatus(subscription.status);

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

  const status = normalizeStatus(subscription.status);
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
  return plan !== "free" && hasActiveEntitlement(normalizeStatus(status));
}

export function checkoutPlanMatchesState(plan: BillingPlan, state: StripeSubscriptionState) {
  return state.plan === plan && hasActiveEntitlement(state.status);
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

export async function findStripeCustomerByEmail(email: string) {
  const customers = await stripeGet<StripeList<StripeCustomer>>(
    "customers",
    new URLSearchParams({
      email,
      limit: "1"
    })
  );

  return customers.data[0] ?? null;
}

export async function getStripeSubscriptionState(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  email?: string | null;
}) {
  let customerId = input.stripeCustomerId ?? undefined;
  const subscriptions: StripeSubscription[] = [];

  if (input.stripeSubscriptionId) {
    try {
      const subscription = await retrieveStripeSubscription(input.stripeSubscriptionId);
      subscriptions.push(subscription);
      customerId = subscription.customer;
    } catch {
      // Fall back to customer/email lookup if the stored subscription is no longer retrievable.
    }
  }

  if (!customerId && input.email) {
    const customer = await findStripeCustomerByEmail(input.email);
    customerId = customer?.id;
  }

  if (customerId) {
    const customerSubscriptions = await listStripeCustomerSubscriptions(customerId);
    subscriptions.push(...customerSubscriptions.data);
  }

  const bestSubscription = subscriptions
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

  const state = stripeSubscriptionToState(bestSubscription);

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

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: stripeRedirectUrl("/success?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: stripeRedirectUrl("/cancel"),
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "metadata[plan]": input.plan,
    "subscription_data[metadata][plan]": input.plan
  });

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
