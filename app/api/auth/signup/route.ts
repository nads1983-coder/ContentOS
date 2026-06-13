import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { setAuthCookies } from "@/lib/auth";
import { isAppwriteConfigured } from "@/lib/env";
import { sendSignupNotification } from "@/lib/signup-notify";
import { upsertUserProfile } from "@/lib/appwrite-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const signupDiagnosticPrefix = "[SIGNUP-DIAGNOSTIC]";

function emailDomainOnly(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain || "unknown";
}

function safeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error || "Unknown error") };
  }

  const candidate = error as {
    code?: unknown;
    type?: unknown;
    message?: unknown;
  };

  return {
    code: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
    message: typeof candidate.message === "string" ? candidate.message : "Unknown error"
  };
}

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
    } catch (error) {
      const details = safeErrorDetails(error);
      console.error(`${signupDiagnosticPrefix} profile sync failed`, {
        userId: createdUser.$id,
        emailDomain: emailDomainOnly(createdUserEmail),
        appwriteCode: details.code,
        appwriteType: details.type,
        appwriteMessage: details.message
      });
      // Best effort until the Appwrite database collection is configured.
    }

    try {
      await sendSignupNotification(createdUserEmail);
    } catch (error) {
      const details = safeErrorDetails(error);
      console.error("Signup notification email failed", {
        emailDomain: emailDomainOnly(createdUserEmail),
        message: details.message
      });
    }

    await setAuthCookies({
      accessToken: session.secret,
      user: {
        id: createdUser.$id,
        email: createdUserEmail
      },
      expiresIn: 60 * 60 * 24 * 30
    });

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
