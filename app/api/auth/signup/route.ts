import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { setAuthCookies } from "@/lib/auth";
import { isAppwriteConfigured } from "@/lib/env";
import { sendSignupNotification } from "@/lib/signup-notify";
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

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Use an email and a password with at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const { account } = createAppwriteAccountClient();
    const createdUser = await account.create({
      userId: ID.unique(),
      email,
      password
    });
    const session = await account.createEmailPasswordSession({ email, password });
    const createdUserEmail = createdUser.email || email;

    try {
      await upsertUserProfile({ id: createdUser.$id, email: createdUserEmail });
    } catch {
      // Best effort until the Appwrite database collection is configured.
    }

    try {
      await sendSignupNotification(createdUserEmail);
    } catch (error) {
      console.error("Signup notification email failed", {
        email: createdUserEmail,
        error
      });
    }

    if (session.secret) {
      await setAuthCookies({
        accessToken: session.secret,
        expiresIn: 60 * 60 * 24 * 30
      });
    }

    return NextResponse.json({ ok: true, redirectUrl: "/dashboard" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Unable to create account. Please try again."
      },
      { status: 400 }
    );
  }
}
