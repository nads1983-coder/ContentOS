import { NextResponse } from "next/server";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfileForUser } from "@/lib/repository";
import { hasLifetimeEntitlement, hasPaidCreatorLifetimeEntitlement } from "@/lib/entitlements";
import { PAID_LIFETIME_OFFER } from "@/lib/paid-lifetime-offer";
import {
  reservePaidLifetimePurchase, recordPaidLifetimeCheckoutSession, terminatePaidLifetimeReservation
} from "@/lib/paid-lifetime-reservations";
import { startPaidLifetimeCheckout } from "@/lib/paid-lifetime-checkout-service";
import {
  createPaidLifetimeCheckoutSession, retrieveCheckoutSession, getStripeSubscriptionState
} from "@/lib/stripe-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  // Commercial release requires a deliberate code change and separate approval.
  if (!PAID_LIFETIME_OFFER.checkoutEnabled) {
    return NextResponse.json({ error: "The lifetime offer is not available for purchase." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in before purchasing." }, { status: 401 });
  try {
    const profile = await getUserProfileForUser(user.id,user.email);
    if (!profile) throw new Error("Create your account profile before purchasing.");
    if (hasLifetimeEntitlement(profile) || hasPaidCreatorLifetimeEntitlement(profile) ||
        profile.paid_creator_lifetime_purchase_id) {
      return NextResponse.json({ error: "Your account already has lifetime access." }, { status: 409 });
    }
    // Keep existing recurring billing untouched: paid subscribers must not be
    // double-charged or silently migrated through a one-time purchase.
    const recurring = await getStripeSubscriptionState({
      stripeCustomerId: profile.stripe_customer_id,
      stripeSubscriptionId: profile.stripe_subscription_id,
      email: user.email
    });
    if (["active","trialing","past_due","incomplete"].includes(recurring.status)) {
      return NextResponse.json({ error: "Contact support to move an existing subscription to lifetime access." }, { status: 409 });
    }
    const result = await startPaidLifetimeCheckout({
      userId: user.id,email:user.email,customerId: recurring.stripeCustomerId ?? profile.stripe_customer_id
    }, {
      reserve: reservePaidLifetimePurchase,
      create: (claim,email,customerId) => createPaidLifetimeCheckoutSession({ claim, email, customerId }),
      retrieve: retrieveCheckoutSession,
      save: recordPaidLifetimeCheckoutSession,
      expire: (purchaseId) => terminatePaidLifetimeReservation(purchaseId,"expired")
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Lifetime Checkout] Purchase initiation unavailable", {
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Lifetime checkout could not be prepared. No payment was started." }, { status: 503 });
  }
}
