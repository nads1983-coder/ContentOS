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
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}

export async function fetchAuthUser(token: string): Promise<AuthUser | null> {
  if (!isAppwriteConfigured() || !token) {
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

  cookieStore.set(SESSION_COOKIE, session.accessToken, {
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
