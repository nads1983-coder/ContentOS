import { Account, Client, Databases } from "node-appwrite";
import { getEnv, isAppwriteConfigured } from "@/lib/env";

export function createAppwriteClient() {
  const env = getEnv();

  if (!isAppwriteConfigured()) {
    throw new Error("Appwrite is not configured.");
  }

  return new Client()
    .setEndpoint(env.appwriteEndpoint)
    .setProject(env.appwriteProjectId);
}

export function createAppwriteAccountClient(sessionSecret?: string) {
  const client = createAppwriteClient();

  if (sessionSecret) {
    client.setSession(sessionSecret);
  }

  return {
    account: new Account(client),
    client
  };
}

export function createAppwriteAdminClient() {
  const env = getEnv();
  const client = createAppwriteClient();

  if (!env.appwriteApiKey) {
    throw new Error("Appwrite API key is not configured.");
  }

  client.setKey(env.appwriteApiKey);

  return {
    account: new Account(client),
    databases: new Databases(client),
    client
  };
}

/** Keep Appwrite's real session while using its ordinary, rate-limited login endpoint.
 * The public endpoint returns the credential in Set-Cookie, not the JSON secret field.
 * No sessions.write permission or elevated API key is needed for password login.
 */
export async function createAppwritePasswordSession(email: string, password: string) {
  const env = getEnv();
  const response = await fetch(`${env.appwriteEndpoint.replace(/\/$/, "")}/account/sessions/email`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Appwrite-Project": env.appwriteProjectId },
    body: JSON.stringify({ email, password }), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const session = await response.json() as { userId?: string; expire?: string; code?: number; type?: string };
  if (!response.ok) throw Object.assign(new Error("Appwrite sign-in failed."), { code: response.status, type: session.type });
  const cookiePrefix = `a_session_${env.appwriteProjectId}=`;
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith(cookiePrefix));
  const secret = cookie ? decodeURIComponent(cookie.slice(cookiePrefix.length).split(";")[0]) : "";
  if (!secret || !session.userId || !session.expire || !Number.isFinite(Date.parse(session.expire))) {
    throw new Error("Appwrite did not return a valid session.");
  }
  return { userId: session.userId, expire: session.expire, secret };
}
