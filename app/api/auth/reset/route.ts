import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { isAppwriteConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAppwriteConfigured()) {
    return NextResponse.json({ error: "Appwrite Auth is not configured." }, { status: 503 });
  }

  const { email } = (await request.json()) as { email?: string };

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const { account } = createAppwriteAccountClient();
    await account.createRecovery({
      email,
      url: absoluteUrl("/reset-password")
    });
  } catch {
    // Avoid leaking whether an account exists for the submitted email.
  }

  return NextResponse.json({ ok: true, message: "Check your inbox for a password reset link." });
}
