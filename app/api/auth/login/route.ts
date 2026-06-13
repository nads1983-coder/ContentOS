import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { setAuthCookies } from "@/lib/auth";
import { isAppwriteConfigured } from "@/lib/env";
import { upsertUserProfile } from "@/lib/appwrite-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAppwriteConfigured()) {
    return NextResponse.json({ error: "Appwrite Auth is not configured." }, { status: 503 });
  }

  const { email, password } = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const { account } = createAppwriteAccountClient();
    const session = await account.createEmailPasswordSession({ email, password });

    if (!session.secret || !session.userId) {
      return NextResponse.json({ error: "Login failed." }, { status: 401 });
    }

    try {
      await upsertUserProfile({ id: session.userId, email });
    } catch {
      // Profile sync is best effort because auth should not fail if the database is not ready yet.
    }

    await setAuthCookies({
      accessToken: session.secret,
      expiresIn: 60 * 60 * 24 * 30
    });

    return NextResponse.json({ ok: true, redirectUrl: "/dashboard" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 401 }
    );
  }
}
