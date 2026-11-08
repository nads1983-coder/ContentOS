import { validateOpenPaidLifetimeCheckout } from "@/lib/paid-lifetime-stripe";
import type { LifetimeStripeSession } from "@/lib/paid-lifetime-stripe";
import type { PaidLifetimeReservation } from "@/lib/paid-lifetime-reservations";

export type PaidCheckoutDependencies = {
  reserve(userId: string, email: string): Promise<PaidLifetimeReservation>;
  create(claim: PaidLifetimeReservation, email: string, customerId?: string | null): Promise<LifetimeStripeSession>;
  retrieve(sessionId: string): Promise<LifetimeStripeSession>;
  save(purchaseId: string, sessionId: string, url: string, expiresAt: string): Promise<unknown>;
  expire(purchaseId: string): Promise<unknown>;
};

/**
 * A persisted attempt gets exactly one Stripe idempotency key. If an API POST
 * was uncertain, never invent a fresh key, and never retry it outside Stripe's
 * safe idempotency window. Release a slot only after Stripe confirms expiry.
 */
export async function startPaidLifetimeCheckout(input: {
  userId: string;
  email: string;
  customerId?: string | null;
}, deps: PaidCheckoutDependencies, now = new Date()) {
  if (!input.userId || !input.email.trim()) throw new Error("Sign in before purchasing lifetime access.");
  for (let retry = 0; retry < 2; retry += 1) {
    const claim = await deps.reserve(input.userId, input.email);
    if (claim.status !== "preparing" && claim.status !== "open") {
      throw new Error("Lifetime checkout requires account reconciliation.");
    }
    if (claim.stripeCheckoutSessionId) {
      const session = await deps.retrieve(claim.stripeCheckoutSessionId);
      if (session.id === claim.stripeCheckoutSessionId && validateOpenPaidLifetimeCheckout(session, claim)) {
        return { url: session.url, pricePence: claim.pricePence, purchaseId: claim.id };
      }
      if (session.status === "expired" && session.id === claim.stripeCheckoutSessionId) {
        await deps.expire(claim.id);
        continue;
      }
      // Includes paid, expired-without-proof, malformed, and unknown sessions.
      // Do not risk a second charge; webhook/operator reconciliation owns them.
      throw new Error("Previous lifetime checkout requires reconciliation.");
    }
    if (now.getTime() - Date.parse(claim.createdAt) >= 23 * 60 * 60 * 1000) {
      throw new Error("Unconfirmed checkout attempt requires reconciliation.");
    }
    const created = await deps.create(claim, input.email, input.customerId);
    if (!created.id) throw new Error("Stripe did not return a checkout session ID.");
    const session = await deps.retrieve(created.id);
    if (session.id !== created.id || !validateOpenPaidLifetimeCheckout(session, claim)) {
      throw new Error("New lifetime checkout could not be validated.");
    }
    await deps.save(claim.id,session.id,session.url!,new Date(session.expires_at! * 1000).toISOString());
    return { url: session.url, pricePence: claim.pricePence, purchaseId: claim.id };
  }
  throw new Error("Lifetime checkout could not be prepared. Please contact support.");
}
