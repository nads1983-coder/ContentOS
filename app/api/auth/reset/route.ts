import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { getEnv, isAppwriteConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const diagnosticPrefix = "[PASSWORD-RESET-DIAGNOSTIC]";
const expectedAppwriteEndpoint = "https://fra.cloud.appwrite.io/v1";
const expectedAppwriteProjectId = "6a2a6be900011401e963";

console.log(`${diagnosticPrefix} module loaded`);

type ResetBody = {
  email?: unknown;
};

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
    stack?: unknown;
  };

  return {
    code: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
    message: typeof candidate.message === "string" ? candidate.message : "Unknown error",
    stack: typeof candidate.stack === "string" ? candidate.stack.split("\n").slice(0, 3).join("\n") : undefined
  };
}

function safeResetError(error: unknown) {
  const details = safeErrorDetails(error);

  if (details.code === 404 || details.type === "project_not_found") {
    return "Password reset is not configured correctly. Please contact support.";
  }

  if (details.code === 401) {
    return "Password reset could not be started. Please check the email address and try again.";
  }

  return "Password reset could not be started. Please try again.";
}

function normaliseBaseUrl(value: string | undefined, fallback = "https://getcontentos.co") {
  const candidate = value?.trim() || fallback;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function recoveryUrl() {
  const appUrl = normaliseBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const siteUrl = normaliseBaseUrl(process.env.NEXT_PUBLIC_SITE_URL, appUrl);
  return new URL("/reset-password", siteUrl).toString();
}

export async function POST(request: Request) {
  console.log(`${diagnosticPrefix} POST handler entered`);

  const env = getEnv();
  const redirectUrl = recoveryUrl();

  console.log(`${diagnosticPrefix} route configuration`, {
    endpoint: env.appwriteEndpoint,
    appwriteEndpointSource: env.appwriteEndpointSource,
    expectedEndpoint: expectedAppwriteEndpoint,
    endpointMatchesExpected: env.appwriteEndpoint === expectedAppwriteEndpoint,
    appwriteProjectId: env.appwriteProjectId,
    appwriteProjectIdSource: env.appwriteProjectIdSource,
    expectedAppwriteProjectId,
    projectIdMatchesExpected: env.appwriteProjectId === expectedAppwriteProjectId,
    hasServerProjectId: Boolean(process.env.APPWRITE_PROJECT_ID?.trim()),
    hasPublicProjectId: Boolean(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim()),
    redirectUrl,
    expectedProductionRedirectUrl: "https://getcontentos.co/reset-password"
  });

  if (!isAppwriteConfigured()) {
    console.error(`${diagnosticPrefix} Appwrite missing configuration`, {
      endpoint: env.appwriteEndpoint,
      appwriteEndpointSource: env.appwriteEndpointSource,
      appwriteProjectId: env.appwriteProjectId,
      appwriteProjectIdSource: env.appwriteProjectIdSource
    });

    return NextResponse.json(
      { error: "Password reset is not configured yet." },
      { status: 503 }
    );
  }

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch (error) {
    const details = safeErrorDetails(error);
    console.error(`${diagnosticPrefix} request_json_failed`, {
      message: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { error: "Send a valid reset request." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  console.log(`${diagnosticPrefix} request parsed`, {
    hasEmail: Boolean(email),
    emailDomain: email ? emailDomainOnly(email) : "missing"
  });

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const { account } = createAppwriteAccountClient();

    console.log(`${diagnosticPrefix} before createRecovery`, {
      emailDomain: emailDomainOnly(email),
      appwriteProjectId: env.appwriteProjectId,
      appwriteProjectIdSource: env.appwriteProjectIdSource,
      endpoint: env.appwriteEndpoint,
      appwriteEndpointSource: env.appwriteEndpointSource,
      hasServerProjectId: Boolean(process.env.APPWRITE_PROJECT_ID?.trim()),
      hasPublicProjectId: Boolean(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim()),
      redirectUrl
    });

    await account.createRecovery({
      email,
      url: redirectUrl
    });

    console.log(`${diagnosticPrefix} createRecovery succeeded`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });

    return NextResponse.json({
      ok: true,
      message: "Check your inbox for a password reset link."
    });
  } catch (error) {
    const details = safeErrorDetails(error);

    console.error(`${diagnosticPrefix} createRecovery failed`, {
      emailDomain: emailDomainOnly(email),
      endpoint: env.appwriteEndpoint,
      appwriteEndpointSource: env.appwriteEndpointSource,
      appwriteProjectId: env.appwriteProjectId,
      appwriteProjectIdSource: env.appwriteProjectIdSource,
      redirectUrl,
      appwriteCode: details.code,
      appwriteType: details.type,
      appwriteMessage: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { error: safeResetError(error) },
      { status: 500 }
    );
  }
}
