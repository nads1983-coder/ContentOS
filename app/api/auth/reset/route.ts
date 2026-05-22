import { NextResponse } from "next/server";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  const { email } = (await request.json()) as { email?: string };

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const env = getEnv();
  const response = await fetch(`${env.supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      redirect_to: absoluteUrl("/login")
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Password reset failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
