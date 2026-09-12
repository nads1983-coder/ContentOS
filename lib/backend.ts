export function usesPostgres() { return true; }
export function isAuthConfigured() { return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET); }
export function isDatabaseConfigured() { return Boolean(process.env.DATABASE_URL); }
