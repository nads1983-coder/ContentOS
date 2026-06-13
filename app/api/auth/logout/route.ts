import { NextResponse } from "next/server";
import { clearAuthCookies, getSessionToken } from "@/lib/auth";
import { createAppwriteAccountClient } from "@/lib/appwrite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const session = await getSessionToken();

  if (session) {
    try {
      const { account } = createAppwriteAccountClient(session);
      await account.deleteSession({ sessionId: "current" });
    } catch {
      // Clearing the local session cookie is enough if Appwrite session cleanup fails.
    }
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
