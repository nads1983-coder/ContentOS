import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { getEnv, isAppwriteConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const diagnosticPrefix = "[PASSWORD-RESET-CONFIRM-DIAGNOSTIC]";
const expectedAppwriteEndpoint = "https://fra.cloud.appwrite.io/v1";
const expectedAppwriteProjectId = "6a2a6be900011401e963";

type ResetConfirmBody = {
  userId?: unknown;
  secret?: unknown;
  password?: unknown;
};

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

function safeConfirmError(error: unknown) {
  const details = safeErrorDetails(error);

  if (details.code === 404 || details.type === "project_not_found") {
    return "Password reset is not configured correctly. Please contact support.";
  }

  if (details.code === 401 || details.code === 403) {
    return "This reset link is invalid or has expired. Please request a new password reset link.";
  }

  return "Password reset could not be completed. Please try again.";
}

export async function POST(request: Request) {
  const env = getEnv();

  console.log(`${diagnosticPrefix} route called`, {
    endpoint: env.appwriteEndpoint,
    appwriteEndpointSource: env.appwriteEndpointSource,
    expectedEndpoint: expectedAppwriteEndpoint,
    endpointMatchesExpected: env.appwriteEndpoint === expectedAppwriteEndpoint,
    appwriteProjectId: env.appwriteProjectId,
    appwriteProjectIdSource: env.appwriteProjectIdSource,
    expectedAppwriteProjectId,
    projectIdMatchesExpected: env.appwriteProjectId === expectedAppwriteProjectId
  });

  if (!isAppwriteConfigured()) {
    return NextResponse.json({ error: "Password reset is not configured yet." }, { status: 503 });
  }

  let body: ResetConfirmBody;
  try {
    body = (await request.json()) as ResetConfirmBody;
  } catch (error) {
    const details = safeErrorDetails(error);
    console.error(`${diagnosticPrefix} request_json_failed`, {
      message: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { error: "Send a valid password reset request." },
      { status: 400 }
    );
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  const password = typeof body.password === "string" ? body.password : "";

  console.log(`${diagnosticPrefix} request parsed`, {
    hasUserId: Boolean(userId),
    hasSecret: Boolean(secret),
    hasPassword: Boolean(password),
    passwordLengthValid: password.length >= 8
  });

  if (!userId || !secret || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const { account } = createAppwriteAccountClient();
    await account.updateRecovery({ userId, secret, password });

    console.log(`${diagnosticPrefix} updateRecovery succeeded`, {
      hasUserId: Boolean(userId)
    });

    return NextResponse.json({
      ok: true,
      message: "Your password has been updated. You can now log in."
    });
  } catch (error) {
    const details = safeErrorDetails(error);

    console.error(`${diagnosticPrefix} updateRecovery failed`, {
      endpoint: env.appwriteEndpoint,
      appwriteEndpointSource: env.appwriteEndpointSource,
      appwriteProjectId: env.appwriteProjectId,
      appwriteProjectIdSource: env.appwriteProjectIdSource,
      hasUserId: Boolean(userId),
      appwriteCode: details.code,
      appwriteType: details.type,
      appwriteMessage: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { error: safeConfirmError(error) },
      { status: 400 }
    );
  }
}
