import { NextResponse } from "next/server";
import { fetchAuthUser, setAuthCookies } from "@/lib/auth";
import { isAppwriteConfigured } from "@/lib/env";
import { upsertUserProfile } from "@/lib/appwrite-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sessionDiagnosticPrefix = "[AUTH-SESSION-DIAGNOSTIC]";

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

  const { sessionSecret, accessToken, expiresIn } = (await request.json()) as {
    sessionSecret?: string;
    accessToken?: string;
    expiresIn?: number;
  };
  const token = sessionSecret ?? accessToken;

  if (!token) {
    return NextResponse.json({ error: "Missing Appwrite session." }, { status: 400 });
  }

  const user = await fetchAuthUser(token);

  if (!user) {
    return NextResponse.json({ error: "Appwrite session could not be verified." }, { status: 401 });
  }

  await setAuthCookies({
    accessToken: token,
    expiresIn
  });

  try {
    await upsertUserProfile({ id: user.id, email: user.email });
  } catch (error) {
    const details = safeErrorDetails(error);
    console.error(`${sessionDiagnosticPrefix} profile sync failed`, {
      userId: user.id,
      appwriteCode: details.code,
      appwriteType: details.type,
      appwriteMessage: details.message
    });
    // Profile sync is best effort because auth callback should still complete.
  }

  return NextResponse.json({ ok: true, user });
}
