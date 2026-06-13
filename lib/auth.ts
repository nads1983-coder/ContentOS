import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { getEnv, isAppwriteConfigured } from "@/lib/env";

export const SESSION_COOKIE = "contentos_appwrite_session";
export const REFRESH_COOKIE = "contentos_refresh";
const signedSessionPrefix = "contentos.v1";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: AuthUser;
};

type SignedSessionPayload = AuthUser & {
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecret() {
  const env = getEnv();
  return process.env.AUTH_SESSION_SECRET?.trim() || env.appwriteApiKey || env.appwriteProjectId;
}

function signPayload(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function createSignedSessionToken(user: AuthUser, expiresIn = 60 * 60 * 24 * 30) {
  const payload = base64UrlEncode(JSON.stringify({
    id: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + expiresIn
  } satisfies SignedSessionPayload));
  const signature = signPayload(payload);
  return `${signedSessionPrefix}.${payload}.${signature}`;
}

function verifySignedSessionToken(token: string): AuthUser | null {
  if (!token.startsWith(`${signedSessionPrefix}.`)) {
    return null;
  }

  const [, version, payload, signature] = token.split(".");

  if (version !== "v1" || !payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<SignedSessionPayload>;

    if (!parsed.id || !parsed.email || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email
    };
  } catch {
    return null;
  }
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}

export async function fetchAuthUser(token: string): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const signedUser = verifySignedSessionToken(token);
  if (signedUser) {
    return signedUser;
  }

  if (!isAppwriteConfigured()) {
    return null;
  }

  try {
    const { account } = createAppwriteAccountClient(token);
    const user = await account.get();

    if (!user.$id || !user.email) {
      return null;
    }

    return {
      id: user.$id,
      email: user.email
    };
  } catch {
    return null;
  }
}

export async function setAuthCookies(session: AuthSession) {
  const cookieStore = await cookies();
  const token = session.user
    ? createSignedSessionToken(session.user, session.expiresIn)
    : session.accessToken;

  if (!token) {
    throw new Error("Cannot set an auth cookie without a session token or user.");
  }

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.expiresIn ?? 60 * 60 * 24 * 30
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  return fetchAuthUser(token);
}

export function isAdminEmail(email: string) {
  return getEnv().adminEmails.includes(email.toLowerCase());
}
