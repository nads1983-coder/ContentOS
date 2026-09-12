import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb, getPool } from "@/lib/db/client";
import * as schema from "@/lib/db/auth-schema";
import { queueAuthMail } from "@/lib/auth-mail";
import { APIError } from "better-auth/api";
import { upsertUserProfile } from "@/lib/postgres-repository";

const baseURL = process.env.BETTER_AUTH_URL || (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://getcontentos.co");

// Loaded only for the replacement backend; legacy production remains available until cutover.
export const auth = betterAuth({
  appName: "ContentOS",
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SESSION_SECRET,
  baseURL,
  trustedOrigins: [baseURL],
  basePath: "/api/account",
  database: drizzleAdapter(getDb(), { provider: "pg", schemaName: "contentos_auth", schema, transaction: true }),
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: true, revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
    sendResetPassword: async ({ user, url }) => { void queueAuthMail(user, url, "reset"); },
    onPasswordReset: async ({ user }) => {
      // A consumed emailed token proves ownership, including migrated accounts without hashes.
      await getPool().query('UPDATE contentos_auth."user" SET email_verified=true,legacy_account=false,updated_at=now() WHERE id=$1', [user.id]);
    }
  },
  emailVerification: { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false, expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => { void queueAuthMail(user, url, "verification"); void queueAuthMail(user, "", "signup_notice"); }
  },
  databaseHooks: {
    user: { create: { before: async user => {
      // Reserve orphaned legacy profiles without reactivating deleted accounts or transferring their data.
      const reserved = await getPool().query('SELECT 1 FROM contentos_app.profiles WHERE email=$1 LIMIT 1', [user.email.toLowerCase()]);
      if (reserved.rowCount) throw new APIError("BAD_REQUEST", { message: "Unable to create this account. Contact support." });
      return { data: user };
    }, after: async user => { await upsertUserProfile({ id: user.id, email: user.email, full_name: user.name }); } } },
    session: { create: { before: async session => {
      const result = await getPool().query('SELECT disabled,email_verified FROM contentos_auth."user" WHERE id=$1', [session.userId]);
      if (!result.rows[0] || result.rows[0].disabled || !result.rows[0].email_verified) throw new APIError("FORBIDDEN", { message: "Verify your email before signing in." });
      return { data: session };
    } } }
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  user: { additionalFields: { disabled: { type: "boolean", defaultValue: false, input: false }, legacyAccount: { type: "boolean", defaultValue: false, input: false } } },
  verification: { storeIdentifier: "hashed" },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60, customRules: {
    "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 3600, max: 5 },
    "/request-password-reset": { window: 3600, max: 5 }, "/send-verification-email": { window: 3600, max: 5 },
    "/reset-password": { window: 60, max: 5 }
  } },
  advanced: { cookiePrefix: "contentos", database: { generateId: () => randomUUID() }, ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] } }
});
