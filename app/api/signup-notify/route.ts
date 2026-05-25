import { NextResponse } from "next/server";
import { isValidNotificationEmail, sendSignupNotification } from "@/lib/signup-notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim() ?? "";

  if (!email || !isValidNotificationEmail(email)) {
    return NextResponse.json(
      { error: "A valid signup email is required." },
      { status: 400 }
    );
  }

  try {
    const result = await sendSignupNotification(email);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Signup notification email failed", {
      email,
      error
    });

    return NextResponse.json(
      { error: "Unable to send signup notification." },
      { status: 500 }
    );
  }
}
