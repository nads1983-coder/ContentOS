import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createCheckoutSession, BillingPlan } from "@/lib/stripe-rest";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { plan } = (await request.json()) as { plan?: BillingPlan };

  if (!plan || !["pro_creator", "pro_studio"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  if (isSupabaseConfigured() && !user) {
    return NextResponse.json(
      {
        error: "Create an account or log in before upgrading.",
        redirectUrl: `/signup?plan=${plan}`
      },
      { status: 401 }
    );
  }

  try {
    const session = await createCheckoutSession({
      plan,
      userId: user?.id,
      email: user?.email
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 500 }
    );
  }
}
