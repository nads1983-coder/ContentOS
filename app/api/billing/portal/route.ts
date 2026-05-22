import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProfile } from "@/lib/supabase-rest";
import { createCustomerPortalSession } from "@/lib/stripe-rest";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const profile = await getUserProfile(user.id);

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer found." }, { status: 404 });
  }

  const session = await createCustomerPortalSession({
    customerId: profile.stripe_customer_id
  });

  return NextResponse.json({ url: session.url });
}
