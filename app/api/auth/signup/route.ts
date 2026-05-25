import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";
import { sendSignupNotification } from "@/lib/signup-notify";
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
  const response = await fetch(
    `${env.supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(absoluteUrl("/auth/callback"))}`,
    {
      method: "POST",
      headers: {
        apikey: env.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    }
  );

  const data = (await response.json()) as {
    id?: string;
    email?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    session?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    } | null;
    user?: { id?: string; email?: string };
    msg?: string;
    error_description?: string;
    error?: string;
  };

  const createdUserId = data.user?.id ?? data.id;
  const createdUserEmail = data.user?.email ?? data.email ?? email;
  const accessToken = data.access_token ?? data.session?.access_token;
  const refreshToken = data.refresh_token ?? data.session?.refresh_token;
  const expiresIn = data.expires_in ?? data.session?.expires_in;

  if (!response.ok || !createdUserId) {
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

  try {
    await upsertUserProfile({ id: createdUserId, email: createdUserEmail });
  } catch {
    // Best effort until Supabase service role is configured.
  }

  try {
    await sendSignupNotification(createdUserEmail);
  } catch (error) {
    console.error("Signup notification email failed", {
      email: createdUserEmail,
      error
    });
  }

  if (accessToken) {
    await setAuthCookies({
      accessToken,
      refreshToken,
      expiresIn
    });

    return NextResponse.json({ ok: true, redirectUrl: "/dashboard" });
  }

  return NextResponse.json({
    ok: true,
    message: "Check your email to confirm your ContentOS account.",
    status: "confirmation_required"
  });
}
