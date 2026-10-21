import { NextResponse } from "next/server";
import { rejectUnsafeWrite } from "@/lib/request-security";
import { getCurrentUser } from "@/lib/auth";
import { LIFETIME_CHECKOUT_ENABLED } from "@/lib/lifetime-access";
import { prepareLifetimePurchase, LifetimePaymentRejected } from "@/lib/lifetime-payment";
import { lifetimeStripeProvider } from "@/lib/lifetime-stripe";
import { assertLifetimeSalesCapacity } from "@/lib/lifetime-capacity";

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  // No price lookup, Stripe call or profile write until terms and release are approved.
  if(!LIFETIME_CHECKOUT_ENABLED) return NextResponse.json({ error: "Lifetime Access is not available for purchase. Existing subscriptions are unchanged.", code: "lifetime_not_activated" }, { status: 409 });
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:"Sign in before purchasing."},{status:401});
  if(request.headers.get("X-ContentOS-Account")!==user.id) return NextResponse.json({error:"Your account changed. Reload before purchasing."},{status:409});
  try {
    return NextResponse.json(await prepareLifetimePurchase(user.id,lifetimeStripeProvider,assertLifetimeSalesCapacity));
  } catch(error) {
    return NextResponse.json({error:error instanceof LifetimePaymentRejected?error.message:"Lifetime checkout is unavailable. No subscription was changed."},{status:error instanceof LifetimePaymentRejected?409:503});
  }
}
