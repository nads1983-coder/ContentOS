import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  return NextResponse.json({ ok: true });
}
