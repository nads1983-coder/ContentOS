import { usesPostgres } from "@/lib/backend";
import { authBridge } from "@/lib/auth-bridge";
import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { isAppwriteConfigured } from "@/lib/env";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (usesPostgres()) return authBridge(request, "reset");
  if (!isAppwriteConfigured()) return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid reset request." }, { status: 400 }); }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@") || email.length > 320) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    await createAppwriteAccountClient().account.createRecovery({ email, url: "https://getcontentos.co/reset-password" });
  } catch (error) {
    const item = error as { code?: number; type?: string };
    console.error("password_recovery_send_failed", { code: item.code, type: item.type });
  }
  return NextResponse.json({ ok: true, message: "If an account exists for that address, you will receive a password reset link." });
}
