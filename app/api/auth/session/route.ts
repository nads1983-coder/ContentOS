import { NextResponse } from "next/server";
import { fetchAuthUser, setAuthCookies } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { upsertUserProfile } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  const { accessToken, refreshToken, expiresIn } = (await request.json()) as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };

  if (!accessToken) {
    return NextResponse.json({ error: "Missing Supabase session." }, { status: 400 });
  }

  const user = await fetchAuthUser(accessToken);

  if (!user) {
    return NextResponse.json({ error: "Supabase session could not be verified." }, { status: 401 });
  }

  await setAuthCookies({
    accessToken,
    refreshToken,
    expiresIn
  });

  try {
    await upsertUserProfile({ id: user.id, email: user.email });
  } catch {
    // Profile sync is best effort because auth callback should still complete.
  }

  return NextResponse.json({ ok: true, user });
}
