import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCheckoutSession, BillingPlan } from "@/lib/stripe-rest";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { plan } = (await request.json()) as { plan?: BillingPlan };

  if (!plan || !["pro_creator", "pro_studio"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
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
