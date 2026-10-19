import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { base64Url } from "@better-auth/utils/base64";
import { createHash } from "@better-auth/utils/hash";
import { eq } from "drizzle-orm";
import { authAdapterDatabase, getAuthDatabase } from "@/lib/auth-database";
import { profiles } from "@/lib/db/app-schema";
import * as schema from "@/lib/db/auth-schema";
import { queueAuthMail } from "@/lib/auth-mail";
import { APIError } from "better-auth/api";
import { upsertUserProfile } from "@/lib/postgres-repository";

const baseURL = process.env.BETTER_AUTH_URL || (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://getcontentos.co");

// Authentication and email run only in the server runtime.
export const auth = betterAuth({
  appName: "ContentOS",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],
  basePath: "/api/account",
  database: drizzleAdapter(authAdapterDatabase(), { provider: "pg", schemaName: "contentos_auth", schema, transaction: true }),
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: true, revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
    sendResetPassword: async ({ user, url }) => { await queueAuthMail(user, url, "reset"); },
    onPasswordReset: async ({ user }) => {
      // Revoke first: a subsequent metadata failure must not leave old sessions usable.
      await getAuthDatabase().delete(schema.session).where(eq(schema.session.userId, user.id));
      // A consumed emailed token proves ownership, including migrated accounts without hashes.
      await getAuthDatabase().update(schema.user).set({ emailVerified: true, legacyAccount: false, updatedAt: new Date() }).where(eq(schema.user.id, user.id));
    }
  },
  emailVerification: { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false, expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => { await queueAuthMail(user, url, "verification"); await queueAuthMail(user, "", "signup_notice"); }
  },
  databaseHooks: {
    verification: { delete: { before: async (verification, context) => {
      if (context?.path !== "/reset-password") return;
      const token = context.body?.token || context.query?.token;
      if (typeof token !== "string" || !token || !(verification.expiresAt instanceof Date) ||
          !Number.isFinite(verification.expiresAt.getTime()) || verification.expiresAt.getTime() < Date.now()) return;
      const identifier = `reset-password:${token}`;
      const digest = await createHash("SHA-256").digest(new TextEncoder().encode(identifier));
      const hashedIdentifier = base64Url.encode(new Uint8Array(digest), { padding: false });
      if (verification.identifier !== hashedIdentifier && verification.identifier !== identifier) return;
      // Runs in token consumption's transaction, before either credential update or legacy creation.
      // A failed revoke must roll back consumption and stop the password write.
      await getAuthDatabase().delete(schema.session).where(eq(schema.session.userId, verification.value));
    } } },
    user: { create: { before: async user => {
      // Reserve orphaned legacy profiles without reactivating deleted accounts or transferring their data.
      const reserved = await getAuthDatabase().select({ id: profiles.id }).from(profiles).where(eq(profiles.email, user.email.toLowerCase())).limit(1);
      if (reserved.length) throw new APIError("BAD_REQUEST", { message: "Unable to create this account. Contact support." });
      return { data: user };
    }, after: async user => { await upsertUserProfile({ id: user.id, email: user.email, full_name: user.name }); } } },
    session: { create: { before: async session => {
      const [user] = await getAuthDatabase().select({ disabled: schema.user.disabled, emailVerified: schema.user.emailVerified }).from(schema.user).where(eq(schema.user.id, session.userId)).limit(1);
      if (!user || user.disabled || !user.emailVerified) throw new APIError("FORBIDDEN", { message: "Verify your email before signing in." });
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
