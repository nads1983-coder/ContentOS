import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth";
import { upsertUserProfile } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  const { email, password } = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const env = getEnv();
  const response = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    user?: { id?: string; email?: string };
    error_description?: string;
  };

  if (!response.ok || !data.access_token || !data.user?.id || !data.user.email) {
    return NextResponse.json(
      { error: data.error_description ?? "Login failed." },
      { status: 401 }
    );
  }

  try {
    await upsertUserProfile({ id: data.user.id, email: data.user.email });
  } catch {
    // Profile sync is best effort because auth should not fail if DB service role is not set yet.
  }

  (await cookies()).set(SESSION_COOKIE, data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: data.expires_in ?? 3600
  });

  return NextResponse.json({ ok: true });
}
