import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { setAuthCookies } from "@/lib/auth";
import { getEnv, isAppwriteConfigured } from "@/lib/env";
import { upsertUserProfile } from "@/lib/appwrite-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginDiagnosticPrefix = "[LOGIN-DIAGNOSTIC]";
const expectedAppwriteEndpoint = "https://fra.cloud.appwrite.io/v1";
const expectedAppwriteProjectId = "6a2a6be900011401e963";

function safeAppwriteError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error || "Login failed.") };
  }

  const candidate = error as {
    code?: unknown;
    type?: unknown;
    message?: unknown;
  };

  return {
    code: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
    message: typeof candidate.message === "string" ? candidate.message : "Login failed."
  };
}

function loginErrorMessage(error: unknown) {
  const details = safeAppwriteError(error);

  if (details.code === 401 || details.type === "user_invalid_credentials") {
    return "Login failed. Check the email and password, then try again.";
  }

  return "Login failed. Please try again.";
}

export async function POST(request: Request) {
  const env = getEnv();

  console.log(`${loginDiagnosticPrefix} route called`, {
    endpoint: env.appwriteEndpoint,
    appwriteEndpointSource: env.appwriteEndpointSource,
    expectedEndpoint: expectedAppwriteEndpoint,
    appwriteProjectId: env.appwriteProjectId,
    appwriteProjectIdSource: env.appwriteProjectIdSource,
    expectedAppwriteProjectId,
    endpointMatchesExpected: env.appwriteEndpoint === expectedAppwriteEndpoint,
    projectIdMatchesExpected: env.appwriteProjectId === expectedAppwriteProjectId
  });

  if (!isAppwriteConfigured()) {
    return NextResponse.json({ error: "Appwrite Auth is not configured." }, { status: 503 });
  }

  const { email, password } = (await request.json()) as {
    email?: string;
    password?: string;
  };

  console.log(`${loginDiagnosticPrefix} request parsed`, {
    endpoint: env.appwriteEndpoint,
    appwriteEndpointSource: env.appwriteEndpointSource,
    appwriteProjectId: env.appwriteProjectId,
    appwriteProjectIdSource: env.appwriteProjectIdSource,
    hasEmail: Boolean(email),
    hasPassword: Boolean(password)
  });

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const { account } = createAppwriteAccountClient();
    console.log(`${loginDiagnosticPrefix} before createEmailPasswordSession`, {
      endpoint: env.appwriteEndpoint,
      appwriteEndpointSource: env.appwriteEndpointSource,
      appwriteProjectId: env.appwriteProjectId,
      appwriteProjectIdSource: env.appwriteProjectIdSource,
      hasEmail: Boolean(email),
      hasPassword: Boolean(password)
    });
    const session = await account.createEmailPasswordSession({ email, password });

    if (!session.userId) {
      return NextResponse.json({ error: "Login failed." }, { status: 401 });
    }

    try {
      await upsertUserProfile({ id: session.userId, email });
    } catch {
      // Profile sync is best effort because auth should not fail if the database is not ready yet.
    }

    await setAuthCookies({
      accessToken: session.secret,
      user: {
        id: session.userId,
        email
      },
      expiresIn: 60 * 60 * 24 * 30
    });

    return NextResponse.json({ ok: true, redirectUrl: "/dashboard" });
  } catch (error) {
    const details = safeAppwriteError(error);
    console.error(`${loginDiagnosticPrefix} createEmailPasswordSession failed`, {
      endpoint: env.appwriteEndpoint,
      appwriteEndpointSource: env.appwriteEndpointSource,
      appwriteProjectId: env.appwriteProjectId,
      appwriteProjectIdSource: env.appwriteProjectIdSource,
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
      appwriteCode: details.code,
      appwriteType: details.type,
      appwriteMessage: details.message
    });

    return NextResponse.json(
      { error: loginErrorMessage(error) },
      { status: 401 }
    );
  }
}
