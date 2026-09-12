import "server-only";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
export type AuthUser = { id: string; email: string };

export async function getCurrentUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  try {
    const { auth } = await import("@/lib/auth-config");
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session || session.user.disabled || !session.user.emailVerified) return null;
    return { id: session.user.id, email: session.user.email };
  } catch { console.error("[auth] session lookup unavailable"); return null; }
}

export function isAdminEmail(email: string) {
  return getEnv().adminEmails.includes(email.toLowerCase());
}
