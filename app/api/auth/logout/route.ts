import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
