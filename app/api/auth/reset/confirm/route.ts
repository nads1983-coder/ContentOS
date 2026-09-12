import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { isAppwriteConfigured } from "@/lib/env";
import { clearAuthCookies } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isAppwriteConfigured()) return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid reset request." }, { status: 400 }); }
  const { userId, secret, password } = body || {};
  if (typeof userId !== "string" || !userId || userId.length > 36 || typeof secret !== "string" || !secret || secret.length > 4096 || typeof password !== "string" || password.length < 8 || password.length > 256) {
    return NextResponse.json({ error: "Use a valid recovery link and a password between 8 and 256 characters." }, { status: 400 });
  }
  try {
    await createAppwriteAccountClient().account.updateRecovery({ userId, secret, password });
    await clearAuthCookies();
    return NextResponse.json({ ok: true, message: "Your password has been updated. Sign in with your new password." });
  } catch (error) {
    const item = error as { code?: number; type?: string };
    console.error("password_recovery_confirm_failed", { code: item.code, type: item.type });
    return NextResponse.json({ error: "The reset link is invalid or expired, or the password was not accepted. Please try again or request a new link." }, { status: 400 });
  }
}
