import { NextResponse } from "next/server";
import { rejectUnsafeWrite } from "@/lib/request-security";

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  // No price lookup, Stripe call or profile write until terms and release are approved.
  return NextResponse.json({ error: "Lifetime Access is not available for purchase. Existing subscriptions are unchanged.", code: "lifetime_not_activated" }, { status: 409 });
}
