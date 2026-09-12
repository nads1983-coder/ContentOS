import { rejectUnsafeWrite } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfileForUser } from "@/lib/repository";
import { createCustomerPortalSession } from "@/lib/stripe-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const profile = await getUserProfileForUser(user.id, user.email);

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer found." }, { status: 404 });
  }

  const session = await createCustomerPortalSession({
    customerId: profile.stripe_customer_id
  });

  return NextResponse.json({ url: session.url });
}
