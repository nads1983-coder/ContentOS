import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { isAppwriteConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAppwriteConfigured()) {
    return NextResponse.json({ error: "Appwrite Auth is not configured." }, { status: 503 });
  }

  const { userId, secret, password } = (await request.json()) as {
    userId?: string;
    secret?: string;
    password?: string;
  };

  if (!userId || !secret || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const { account } = createAppwriteAccountClient();
    await account.updateRecovery({ userId, secret, password });
    return NextResponse.json({
      ok: true,
      message: "Your password has been updated. You can now log in."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password reset failed." },
      { status: 400 }
    );
  }
}
