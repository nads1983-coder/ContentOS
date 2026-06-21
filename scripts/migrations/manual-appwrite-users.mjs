#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { AppwriteException, Client, Databases, ID, Query, Users } from "node-appwrite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const usersPath = path.join(__dirname, "manual-users.json");
const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const dryRun = !execute;

const requiredEnv = [
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_USERS_COLLECTION_ID"
];

const profileFields = [
  "email",
  "full_name",
  "plan",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_checkout_session_id",
  "subscription_status",
  "subscription_current_period_end",
  "subscription_cancel_at_period_end",
  "subscription_canceled_at",
  "entitlement_source",
  "amount_paid",
  "created_at",
  "updated_at",
  "brand_profiles_json",
  "onboarding_json",
  "generation_history_json",
  "usage_events_json"
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) process.env[key] = value;
  }
}

function loadLocalEnv() {
  [".env.local", ".env"].forEach((file) => loadEnvFile(path.join(repoRoot, file)));
}

function requireEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (!process.env.APPWRITE_ENDPOINT && !process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
    missing.push("APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_ENDPOINT");
  }
  if (!process.env.APPWRITE_PROJECT_ID && !process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
    missing.push("APPWRITE_PROJECT_ID or NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function readManualUsers() {
  if (!fs.existsSync(usersPath)) {
    throw new Error(`Missing ${path.relative(repoRoot, usersPath)}. Copy manual-users.example.json and add local users.`);
  }

  const parsed = JSON.parse(fs.readFileSync(usersPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("manual-users.json must contain an array of users.");
  }

  return parsed.map((user, index) => {
    if (!user.email || typeof user.email !== "string") {
      throw new Error(`User at index ${index} is missing an email.`);
    }

    return {
      ...user,
      email: user.email.trim().toLowerCase()
    };
  });
}

function createClients() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  return {
    users: new Users(client),
    databases: new Databases(client)
  };
}

function isNotFound(error) {
  return error instanceof AppwriteException && (error.code === 404 || error.type === "document_not_found" || error.type === "user_not_found");
}

async function findUserByEmail(users, email) {
  const result = await users.list({ queries: [Query.equal("email", email), Query.limit(1)] });
  return result.users[0] || null;
}

async function findProfileByEmail(databases, email) {
  const result = await databases.listDocuments({
    databaseId: process.env.APPWRITE_DATABASE_ID,
    collectionId: process.env.APPWRITE_USERS_COLLECTION_ID,
    queries: [Query.equal("email", email), Query.limit(1)]
  });
  return result.documents[0] || null;
}

async function findProfileById(databases, documentId) {
  try {
    return await databases.getDocument({
      databaseId: process.env.APPWRITE_DATABASE_ID,
      collectionId: process.env.APPWRITE_USERS_COLLECTION_ID,
      documentId
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function temporaryPassword() {
  return `${crypto.randomBytes(18).toString("base64url")}Aa1!`;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function profilePayload(user, existingDocument) {
  const payload = {};

  for (const field of profileFields) {
    if (Object.prototype.hasOwnProperty.call(user, field)) {
      payload[field] = user[field];
    }
  }

  payload.email = user.email;
  payload.updated_at = user.updated_at || new Date().toISOString();

  if (!existingDocument && !payload.created_at) {
    payload.created_at = new Date().toISOString();
  }

  return compact(payload);
}

async function createOrFindAuthUser(users, user, summary) {
  const existing = await findUserByEmail(users, user.email);

  if (existing) {
    summary.found += 1;
    summary.skipped += 1;
    return { appwriteUser: existing, action: "existing-auth-user" };
  }

  const password = temporaryPassword();

  if (dryRun) {
    summary.created += 1;
    return {
      appwriteUser: { $id: user.id || ID.unique(), email: user.email },
      action: "would-create-auth-user"
    };
  }

  const created = await users.create({
    userId: user.id || ID.unique(),
    email: user.email,
    password,
    name: user.full_name || user.name || undefined
  });

  summary.created += 1;
  return { appwriteUser: created, action: "created-auth-user" };
}

async function upsertProfile(databases, appwriteUser, user, summary) {
  const existingById = await findProfileById(databases, appwriteUser.$id);
  const existingByEmail = existingById ? null : await findProfileByEmail(databases, user.email);
  const existing = existingById || existingByEmail;
  const documentId = existing?.$id || appwriteUser.$id;
  const payload = profilePayload(user, existing);

  if (existingByEmail && existingByEmail.$id !== appwriteUser.$id) {
    summary.found += 1;
  }

  if (dryRun) {
    if (existing) summary.updated += 1;
    else summary.created += 1;
    return { action: existing ? "would-update-profile" : "would-create-profile", documentId };
  }

  if (existing) {
    await databases.updateDocument({
      databaseId: process.env.APPWRITE_DATABASE_ID,
      collectionId: process.env.APPWRITE_USERS_COLLECTION_ID,
      documentId,
      data: payload
    });
    summary.updated += 1;
    return { action: "updated-profile", documentId };
  }

  await databases.createDocument({
    databaseId: process.env.APPWRITE_DATABASE_ID,
    collectionId: process.env.APPWRITE_USERS_COLLECTION_ID,
    documentId,
    data: payload
  });
  summary.created += 1;
  return { action: "created-profile", documentId };
}

async function main() {
  loadLocalEnv();
  requireEnv();

  const manualUsers = readManualUsers();
  const { users, databases } = createClients();
  const summary = {
    found: 0,
    created: 0,
    skipped: 0,
    updated: 0,
    errors: 0,
    errorDetails: []
  };

  console.log(`Manual Appwrite user import starting (${dryRun ? "dry-run" : "execute"}).`);
  console.log("Passwords are temporary and not printed. Users should use the password reset flow.");
  console.log(`Loaded ${manualUsers.length} local manual users.`);

  for (const user of manualUsers) {
    try {
      const authResult = await createOrFindAuthUser(users, user, summary);
      const profileResult = await upsertProfile(databases, authResult.appwriteUser, user, summary);
      console.log(`[ok] ${user.email}: ${authResult.action}, ${profileResult.action}:${profileResult.documentId}`);
    } catch (error) {
      summary.errors += 1;
      summary.errorDetails.push({
        email: user.email,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`[error] ${user.email}`, error);
    }
  }

  console.log("Manual import summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Manual import failed before completion.", error);
  process.exitCode = 1;
});
