import { usesPostgres } from "@/lib/backend";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { getEnv, isAppwriteConfigured } from "@/lib/env";

export const SESSION_COOKIE = "contentos_appwrite_session";
export const REFRESH_COOKIE = "contentos_refresh";

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

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}

export async function fetchAuthUser(token: string): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  // Legacy locally signed cookies cannot be revoked by Appwrite. Require a real provider session.
  if (token.startsWith("contentos.v1.")) return null;

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
  const token = session.accessToken;

  if (!token) {
    throw new Error("Cannot set an auth cookie without an Appwrite session token.");
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
  if (usesPostgres()) {
    try {
      const { auth } = await import("@/lib/auth-config");
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session || session.user.disabled || !session.user.emailVerified) return null;
      return { id: session.user.id, email: session.user.email };
    } catch { console.error("[auth] session lookup unavailable"); return null; }
  }
  const token = await getSessionToken();
  return fetchAuthUser(token);
}

export function isAdminEmail(email: string) {
  return getEnv().adminEmails.includes(email.toLowerCase());
}
