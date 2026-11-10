import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

test("disabled lifetime checkout refuses requests before account, database or Stripe work", async () => {
  const forbidden = () => { throw new Error("Disabled route reached a live dependency"); };
  const { POST } = loadTs("app/api/lifetime/checkout/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/paid-lifetime-reconciliation": { reconcileLifetimeCheckouts: forbidden },
    "@/lib/request-security": { rejectUnsafeWrite: () => null },
    "@/lib/auth": { getCurrentUser: forbidden },
    "@/lib/repository": { getUserProfileForUser: forbidden },
    "@/lib/paid-lifetime-reservations": {
      reservePaidLifetimePurchase: forbidden,
      recordPaidLifetimeCheckoutSession: forbidden,
      terminatePaidLifetimeReservation: forbidden
    },
    "@/lib/paid-lifetime-checkout-service": { startPaidLifetimeCheckout: forbidden },
    "@/lib/stripe-rest": {
      createPaidLifetimeCheckoutSession: forbidden,
      retrieveCheckoutSession: forbidden,
      getStripeSubscriptionState: forbidden
    }
  });
  const response = await POST(new Request("https://example.invalid/api/lifetime/checkout", {method:"POST"}));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not available for purchase/i);
});
