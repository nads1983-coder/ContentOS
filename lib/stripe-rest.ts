import { createHmac, timingSafeEqual } from "crypto";
import { getEnv, isStripeConfigured } from "@/lib/env";

export type BillingPlan = "pro_creator" | "pro_studio";

const apiVersion = "2026-02-25.clover";

function stripeRedirectUrl(path: string) {
  return new URL(path, getEnv().appUrl).toString();
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

export async function createCheckoutSession(input: {
  plan: BillingPlan;
  userId?: string;
  email?: string;
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
    "metadata[plan]": input.plan
  });

  if (input.userId) {
    body.set("client_reference_id", input.userId);
    body.set("metadata[user_id]", input.userId);
  }

  if (input.email) {
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
