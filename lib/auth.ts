import { cookies } from "next/headers";
import { getEnv, isSupabaseConfigured } from "@/lib/env";

export const SESSION_COOKIE = "contentos_session";

export type AuthUser = {
  id: string;
  email: string;
};

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? "";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();

  if (!token || !isSupabaseConfigured()) {
    return null;
  }

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

export function isAdminEmail(email: string) {
  return getEnv().adminEmails.includes(email.toLowerCase());
}
