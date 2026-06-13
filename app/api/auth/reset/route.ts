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
  console.log(`${diagnosticPrefix} step 1 route called`);

  if (!isAppwriteConfigured()) {
    console.error(`${diagnosticPrefix} step 1 failed Appwrite Auth is not configured`);
    return NextResponse.json(
      { success: false, diagnostic: "Appwrite Auth is not configured." },
      { status: 503 }
    );
  }

  const { email } = (await request.json()) as { email?: string };
  console.log(`${diagnosticPrefix} step 2 request parsed`, {
    emailDomain: email ? emailDomainOnly(email) : "missing"
  });

  if (!email) {
    console.warn(`${diagnosticPrefix} step 2 failed missing email`);
    return NextResponse.json(
      { success: false, diagnostic: "Email is required." },
      { status: 400 }
    );
  }

  const redirectUrl = absoluteUrl("/reset-password");
  console.log(`${diagnosticPrefix} step 3 recovery request prepared`, {
    emailDomain: emailDomainOnly(email),
    redirectUrl,
    expectedProductionRedirectUrl: "https://getcontentos.co/reset-password"
  });

  try {
    const { account } = createAppwriteAccountClient();
    console.log(`${diagnosticPrefix} step 4 before createRecovery`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });

    await account.createRecovery({
      email,
      url: redirectUrl
    });

    console.log(`${diagnosticPrefix} step 5 after createRecovery`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });

    return NextResponse.json({
      success: true,
      diagnostic: "createRecovery succeeded"
    });
  } catch (error) {
    const details = appwriteErrorDetails(error);
    const diagnostic = details.message || "createRecovery failed";

    console.error(`${diagnosticPrefix} step 6 catch createRecovery failed`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl,
      appwriteCode: details.code,
      appwriteType: details.type,
      appwriteMessage: details.message
    });

    return NextResponse.json(
      {
        success: false,
        diagnostic
      },
      { status: 500 }
    );
  }
}
