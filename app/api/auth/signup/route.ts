import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
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

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Use an email and a password with at least 8 characters." },
      { status: 400 }
    );
  }

  const env = getEnv();
  const response = await fetch(`${env.supabaseUrl}/auth/v1/signup`, {
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
    msg?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !data.user?.id) {
    return NextResponse.json(
      {
        error:
          data.error_description ??
          data.msg ??
          data.error ??
          "Unable to create account. Please try again."
      },
      { status: 400 }
    );
  }

  const profileEmail = data.user.email ?? email;

  try {
    await upsertUserProfile({ id: data.user.id, email: profileEmail });
  } catch {
    // Best effort until Supabase service role is configured.
  }

  if (data.access_token) {
    (await cookies()).set(SESSION_COOKIE, data.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: data.expires_in ?? 3600
    });

    return NextResponse.json({ ok: true, redirectUrl: "/dashboard" });
  }

  return NextResponse.json({
    ok: true,
    message: "Check your email to confirm your ContentOS account.",
    status: "confirmation_required"
  });
}
