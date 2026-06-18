import { AppwriteException, ID, Models, Query } from "node-appwrite";
import { createAppwriteAdminClient } from "@/lib/appwrite";
import { getEnv, isAppwriteAdminConfigured } from "@/lib/env";
import { normalizePlanId, normalizeSubscriptionStatus } from "@/lib/stripe-rest";
import { currentUsageWindow } from "@/lib/usage";
import { hasManualLifetimeEntitlement } from "@/lib/entitlements";
import {
  BrandProfile,
  OnboardingData,
  PlanId,
  SubscriptionStatus,
  UserProfile
} from "@/types/saas";

type AppwriteProfileDocument = Models.Document & Partial<UserProfile> & {
  brand_profiles_json?: string;
  onboarding_json?: string;
  generation_history_json?: string;
  usage_events_json?: string;
};

type UsageEvent = {
  id: string;
  user_id: string;
  event_type: "text_generation" | "image_generation";
  metadata?: Record<string, unknown>;
  created_at: string;
};

type GenerationHistoryItem = {
  id: string;
  user_id: string;
  payload: unknown;
  created_at: string;
};

function userCollection() {
  const env = getEnv();

  if (!isAppwriteAdminConfigured()) {
    throw new Error("Appwrite is not configured.");
  }

  return {
    databaseId: env.appwriteDatabaseId,
    collectionId: env.appwriteUsersCollectionId
  };
}

function isNotFound(error: unknown) {
  return error instanceof AppwriteException && (error.code === 404 || error.type === "document_not_found");
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}

function safeJsonArray<T>(value: unknown): T[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toUserProfile(document: AppwriteProfileDocument): UserProfile {
  return {
    id: document.$id,
    email: document.email ?? "",
    full_name: document.full_name ?? undefined,
    plan: normalizePlanId(document.plan),
    stripe_customer_id: document.stripe_customer_id,
    stripe_subscription_id: document.stripe_subscription_id,
    subscription_status: normalizeSubscriptionStatus(document.subscription_status),
    subscription_current_period_end: document.subscription_current_period_end ?? null,
    subscription_cancel_at_period_end: document.subscription_cancel_at_period_end ?? false,
    subscription_canceled_at: document.subscription_canceled_at ?? null,
    entitlement_source: document.entitlement_source ?? null
  };
}

function profilePayload(profile: Partial<UserProfile> & { id: string; email: string }) {
  return stripUndefined({
    email: profile.email,
    full_name: profile.full_name ?? undefined,
    plan: normalizePlanId(profile.plan),
    stripe_customer_id: profile.stripe_customer_id,
    stripe_subscription_id: profile.stripe_subscription_id,
    subscription_status: normalizeSubscriptionStatus(profile.subscription_status),
    subscription_current_period_end: profile.subscription_current_period_end ?? null,
    subscription_cancel_at_period_end: profile.subscription_cancel_at_period_end ?? false,
    subscription_canceled_at: profile.subscription_canceled_at ?? null,
    entitlement_source: profile.entitlement_source ?? undefined,
    updated_at: new Date().toISOString()
  });
}

async function getProfileDocument(userId: string) {
  const { databases } = createAppwriteAdminClient();
  const collection = userCollection();

  try {
    return await databases.getDocument<AppwriteProfileDocument>({
      ...collection,
      documentId: userId
    });
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }

    throw error;
  }
}

async function updateProfileDocument(userId: string, data: Record<string, unknown>) {
  const { databases } = createAppwriteAdminClient();
  const collection = userCollection();

  return databases.updateDocument<AppwriteProfileDocument>({
    ...collection,
    documentId: userId,
    data: stripUndefined(data)
  });
}

export async function getUserProfile(userId: string) {
  const document = await getProfileDocument(userId);
  return document ? toUserProfile(document) : null;
}

export async function getUserProfileByEmail(email: string) {
  const { databases } = createAppwriteAdminClient();
  const collection = userCollection();
  const result = await databases.listDocuments<AppwriteProfileDocument>({
    ...collection,
    queries: [Query.equal("email", email), Query.limit(1)]
  });

  return result.documents[0] ? toUserProfile(result.documents[0]) : null;
}

export async function getUserProfileForUser(userId: string, email?: string) {
  const profile = await getUserProfile(userId);

  if (profile || !email) {
    return profile;
  }

  return getUserProfileByEmail(email);
}

export async function upsertUserProfile(profile: Partial<UserProfile> & { id: string; email: string }) {
  const { databases } = createAppwriteAdminClient();
  const collection = userCollection();
  const existing = await getProfileDocument(profile.id);
  const payload = profilePayload(profile);

  if (existing) {
    const saved = await databases.updateDocument<AppwriteProfileDocument>({
      ...collection,
      documentId: profile.id,
      data: payload
    });
    return toUserProfile(saved);
  }

  try {
    const saved = await databases.createDocument<AppwriteProfileDocument>({
      ...collection,
      documentId: profile.id,
      data: {
        ...payload,
        created_at: new Date().toISOString()
      }
    });
    return toUserProfile(saved);
  } catch (error) {
    const existingByEmail = await getUserProfileByEmail(profile.email);

    if (!existingByEmail) {
      throw error;
    }

    const saved = await updateProfileDocument(existingByEmail.id, {
      ...payload,
      email: profile.email
    });
    return toUserProfile(saved);
  }
}

export async function listBrandProfiles(userId: string) {
  const document = await getProfileDocument(userId);
  return safeJsonArray<BrandProfile>(document?.brand_profiles_json);
}

export async function createBrandProfile(userId: string, profile: Omit<BrandProfile, "id">) {
  const profiles = await listBrandProfiles(userId);
  const saved = {
    ...profile,
    id: ID.unique(),
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as BrandProfile;

  await updateProfileDocument(userId, {
    brand_profiles_json: JSON.stringify([saved, ...profiles])
  });

  return saved;
}

export async function deleteBrandProfile(userId: string, id: string) {
  const profiles = await listBrandProfiles(userId);
  await updateProfileDocument(userId, {
    brand_profiles_json: JSON.stringify(profiles.filter((profile) => profile.id !== id))
  });
  return null;
}

export async function saveOnboarding(userId: string, data: OnboardingData) {
  await updateProfileDocument(userId, {
    onboarding_json: JSON.stringify({
      ...data,
      updated_at: new Date().toISOString()
    })
  });

  return { id: userId };
}

export async function recordGeneration(userId: string, payload: unknown) {
  const document = await getProfileDocument(userId);
  const history = safeJsonArray<GenerationHistoryItem>(document?.generation_history_json);
  const saved = {
    id: ID.unique(),
    user_id: userId,
    payload,
    created_at: new Date().toISOString()
  };

  await updateProfileDocument(userId, {
    generation_history_json: JSON.stringify([saved, ...history].slice(0, 100))
  });

  return [saved];
}

export async function recordUsageEvent(input: {
  userId: string;
  email?: string;
  eventType: "text_generation" | "image_generation";
  metadata?: Record<string, unknown>;
}) {
  const profile = await upsertUserProfile({ id: input.userId, email: input.email ?? "" });
  const document = await getProfileDocument(profile.id);
  const events = safeJsonArray<UsageEvent>(document?.usage_events_json);
  const saved = {
    id: ID.unique(),
    user_id: profile.id,
    event_type: input.eventType,
    metadata: {
      email: input.email,
      ...input.metadata
    },
    created_at: new Date().toISOString()
  };

  await updateProfileDocument(profile.id, {
    usage_events_json: JSON.stringify([saved, ...events].slice(0, 500))
  });

  return [saved];
}

export async function getMonthlyUsageCount(input: {
  userId: string;
  periodEnd?: string | null;
  eventType?: "text_generation" | "image_generation";
}) {
  const document = await getProfileDocument(input.userId);
  const events = safeJsonArray<UsageEvent>(document?.usage_events_json);
  const generationHistory = safeJsonArray<GenerationHistoryItem>(document?.generation_history_json);
  const { periodStart, periodEnd } = currentUsageWindow(new Date(), input.periodEnd);
  const startTime = new Date(periodStart).getTime();
  const endTime = new Date(periodEnd).getTime();
  const inWindow = (createdAt: string) => {
    const time = new Date(createdAt).getTime();
    return time >= startTime && time < endTime;
  };
  const usageEvents = events.filter((event) =>
    inWindow(event.created_at) && (!input.eventType || event.event_type === input.eventType)
  );

  if (input.eventType) {
    return usageEvents.length;
  }

  const textUsageEvents = events.filter((event) => inWindow(event.created_at) && event.event_type === "text_generation");
  const historyCount = generationHistory.filter((item) => inWindow(item.created_at)).length;
  return usageEvents.length + Math.max(0, historyCount - textUsageEvents.length);
}

export async function updateSubscriptionStatus(input: {
  userId?: string;
  email?: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
}) {
  const matchingProfiles: UserProfile[] = [];

  if (input.userId) {
    const profile = await getUserProfile(input.userId);
    if (profile) matchingProfiles.push(profile);
  }

  if (input.email) {
    const profile = await getUserProfileByEmail(input.email);
    if (profile && !matchingProfiles.some((item) => item.id === profile.id)) matchingProfiles.push(profile);
  }

  if (!matchingProfiles.length) {
    return [];
  }

  const updated: UserProfile[] = [];

  for (const profile of matchingProfiles) {
    if (hasManualLifetimeEntitlement(profile)) {
      updated.push(profile);
      continue;
    }

    const saved = await updateProfileDocument(profile.id, {
      plan: normalizePlanId(input.plan),
      subscription_status: normalizeSubscriptionStatus(input.status),
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      subscription_current_period_end: input.currentPeriodEnd ?? null,
      subscription_cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      subscription_canceled_at: input.canceledAt ?? null,
      updated_at: new Date().toISOString()
    });
    updated.push(toUserProfile(saved));
  }

  return updated;
}

export async function syncUserSubscriptionState(input: {
  userId: string;
  email: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
}) {
  await upsertUserProfile({ id: input.userId, email: input.email });
  const rows = await updateSubscriptionStatus(input);
  const [saved] = rows;
  return saved ?? null;
}
