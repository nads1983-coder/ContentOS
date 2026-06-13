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
