import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { isAppwriteConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const diagnosticPrefix = "[PASSWORD-RESET-DIAGNOSTIC]";

function emailDomainOnly(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain || "unknown";
}

function appwriteErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown Appwrite recovery error." };
  }

  const candidate = error as {
    code?: unknown;
    type?: unknown;
    message?: unknown;
  };

  return {
    code: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
    message: typeof candidate.message === "string" ? candidate.message : "Unknown Appwrite recovery error."
  };
}

export async function POST(request: Request) {
  console.log(`${diagnosticPrefix} route called`);

  if (!isAppwriteConfigured()) {
    console.error(`${diagnosticPrefix} Appwrite Auth is not configured`);
    return NextResponse.json({ error: "Appwrite Auth is not configured." }, { status: 503 });
  }

  const { email } = (await request.json()) as { email?: string };

  if (!email) {
    console.warn(`${diagnosticPrefix} missing email`);
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const redirectUrl = absoluteUrl("/reset-password");
  console.log(`${diagnosticPrefix} recovery requested`, {
    emailDomain: emailDomainOnly(email),
    redirectUrl,
    expectedProductionRedirectUrl: "https://getcontentos.co/reset-password"
  });

  try {
    const { account } = createAppwriteAccountClient();
    await account.createRecovery({
      email,
      url: redirectUrl
    });

    console.log(`${diagnosticPrefix} createRecovery succeeded`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });

    return NextResponse.json({ ok: true, message: "Check your inbox for a password reset link." });
  } catch (error) {
    const details = appwriteErrorDetails(error);
    console.error(`${diagnosticPrefix} createRecovery failed`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl,
      appwriteCode: details.code,
      appwriteType: details.type,
      appwriteMessage: details.message
    });

    return NextResponse.json(
      { error: "Password reset email could not be sent. Please try again or contact support." },
      { status: 500 }
    );
  }
}
