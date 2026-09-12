import { isAppwriteConfigured, isAppwriteAdminConfigured } from "@/lib/env";
export function usesPostgres() {
  return process.env.CONTENTOS_BACKEND === "postgres";
}

export function isAuthConfigured() { return usesPostgres() ? Boolean(process.env.DATABASE_URL && (process.env.BETTER_AUTH_SECRET || process.env.AUTH_SESSION_SECRET)) : isAppwriteConfigured(); }
export function isDatabaseConfigured() { return usesPostgres() ? Boolean(process.env.DATABASE_URL) : isAppwriteAdminConfigured(); }
