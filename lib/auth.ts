import { cookies } from "next/headers";
import { getEnv, isSupabaseConfigured } from "@/lib/env";

export const SESSION_COOKIE = "contentos_session";
export const REFRESH_COOKIE = "contentos_refresh";

export type AuthUser = {
  id: string;
  email: string;
};

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}

async function fetchAuthUser(token: string): Promise<AuthUser | null> {
  const env = getEnv();
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { id?: string; email?: string };

  if (!data.id || !data.email) {
    return null;
  }

  return {
    id: data.id,
    email: data.email
  };
}

async function refreshSession() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  const env = getEnv();
  const response = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  });

  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;

  if (!response.ok || !data?.access_token) {
    return null;
  }

  try {
    cookieStore.set(SESSION_COOKIE, data.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: data.expires_in ?? 3600
    });

    if (data.refresh_token) {
      cookieStore.set(REFRESH_COOKIE, data.refresh_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30
      });
    }
  } catch {
    // Server components may not be allowed to mutate cookies; the refreshed
    // access token is still valid for this request.
  }

  return data.access_token;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (token) {
    const user = await fetchAuthUser(token);

    if (user) {
      return user;
    }
  }

  const refreshedToken = await refreshSession();

  if (!refreshedToken) {
    return null;
  }

  return fetchAuthUser(refreshedToken);
}

export function isAdminEmail(email: string) {
  return getEnv().adminEmails.includes(email.toLowerCase());
}
