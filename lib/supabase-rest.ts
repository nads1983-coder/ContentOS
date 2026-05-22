import { getEnv, isSupabaseAdminConfigured } from "@/lib/env";
import { normalizePlanId, normalizeSubscriptionStatus } from "@/lib/stripe-rest";
import { currentUsageWindow } from "@/lib/usage";
import {
  BrandProfile,
  OnboardingData,
  PlanId,
  SubscriptionStatus,
  UserProfile
} from "@/types/saas";

type QueryValue = string | number | boolean | null | Array<string | number | boolean>;

function restUrl(path: string, query?: Record<string, QueryValue>) {
  const env = getEnv();
  const url = new URL(`/rest/v1/${path}`, env.supabaseUrl);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else if (value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function supabaseFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, QueryValue> } = {}
): Promise<T> {
  const env = getEnv();

  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const { query, headers, ...rest } = init;
  const response = await fetch(restUrl(path, query), {
    ...rest,
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

async function supabaseCount(
  path: string,
  init: RequestInit & { query?: Record<string, QueryValue> } = {}
) {
  const env = getEnv();

  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const { query, headers, ...rest } = init;
  const response = await fetch(restUrl(path, query), {
    ...rest,
    method: rest.method ?? "HEAD",
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      Prefer: "count=exact",
      Range: "0-0",
      ...headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase count failed: ${response.status}`);
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const total = Number.parseInt(contentRange.split("/")[1] ?? "", 10);
  return Number.isFinite(total) ? total : 0;
}

async function ensureUserProfile(userId: string, email?: string) {
  if (!email) {
    return;
  }

  await upsertUserProfile({ id: userId, email });
}

export async function getUserProfile(userId: string) {
  const profiles = await supabaseFetch<UserProfile[]>("profiles", {
    query: {
      id: `eq.${userId}`,
      select: "*"
    }
  });

  return profiles[0] ?? null;
}

export async function upsertUserProfile(profile: Partial<UserProfile> & { id: string; email: string }) {
  const [saved] = await supabaseFetch<UserProfile[]>("profiles", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      ...profile,
      updated_at: new Date().toISOString()
    })
  });

  return saved;
}

export async function listBrandProfiles(userId: string) {
  return supabaseFetch<BrandProfile[]>("brand_profiles", {
    query: {
      user_id: `eq.${userId}`,
      order: "updated_at.desc",
      select: "*"
    }
  });
}

export async function createBrandProfile(userId: string, profile: Omit<BrandProfile, "id">) {
  const [saved] = await supabaseFetch<BrandProfile[]>("brand_profiles", {
    method: "POST",
    body: JSON.stringify({
      ...profile,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  });

  return saved;
}

export async function deleteBrandProfile(userId: string, id: string) {
  return supabaseFetch<null>("brand_profiles", {
    method: "DELETE",
    query: {
      id: `eq.${id}`,
      user_id: `eq.${userId}`
    },
    headers: {
      Prefer: "return=minimal"
    }
  });
}

export async function saveOnboarding(userId: string, data: OnboardingData) {
  const [saved] = await supabaseFetch<Array<{ id: string }>>("onboarding", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      user_id: userId,
      business_name: data.businessName,
      audience: data.audience,
      niche: data.niche,
      goals: data.goals,
      preferred_platforms: data.preferredPlatforms,
      writing_tone: data.writingTone,
      updated_at: new Date().toISOString()
    })
  });

  return saved;
}

export async function recordGeneration(userId: string, payload: unknown) {
  return supabaseFetch<Array<{ id: string }>>("generation_history", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      payload,
      created_at: new Date().toISOString()
    })
  });
}

export async function recordUsageEvent(input: {
  userId: string;
  email?: string;
  eventType: "text_generation" | "image_generation";
  metadata?: Record<string, unknown>;
}) {
  await ensureUserProfile(input.userId, input.email);

  return supabaseFetch<Array<{ id: string }>>("usage_events", {
    method: "POST",
    body: JSON.stringify({
      user_id: input.userId,
      event_type: input.eventType,
      metadata: {
        email: input.email,
        ...input.metadata
      },
      created_at: new Date().toISOString()
    })
  });
}

export async function getMonthlyUsageCount(input: {
  userId: string;
  periodEnd?: string | null;
}) {
  const { periodStart, periodEnd } = currentUsageWindow(new Date(), input.periodEnd);

  const query = {
    user_id: `eq.${input.userId}`,
    created_at: [`gte.${periodStart}`, `lt.${periodEnd}`],
    select: "id"
  };

  let usageEvents = 0;
  let textUsageEvents = 0;

  try {
    usageEvents = await supabaseCount("usage_events", { query });
    textUsageEvents = await supabaseCount("usage_events", {
      query: {
        ...query,
        event_type: "eq.text_generation"
      }
    });
  } catch {
    // Fall back to generation history for older installs while usage_events is being rolled out.
  }

  try {
    const generationHistory = await supabaseCount("generation_history", { query });
    return usageEvents + Math.max(0, generationHistory - textUsageEvents);
  } catch {
    return usageEvents;
  }
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
  const queries: Record<string, QueryValue>[] = [];

  if (input.userId) {
    queries.push({ id: `eq.${input.userId}` });
  }

  if (input.email) {
    queries.push({ email: `eq.${input.email}` });
  }

  if (input.stripeCustomerId) {
    queries.push({ stripe_customer_id: `eq.${input.stripeCustomerId}` });
  }

  if (input.stripeSubscriptionId) {
    queries.push({ stripe_subscription_id: `eq.${input.stripeSubscriptionId}` });
  }

  if (!queries.length) {
    return null;
  }

  const corePayload = {
    plan: normalizePlanId(input.plan),
    subscription_status: normalizeSubscriptionStatus(input.status),
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    updated_at: new Date().toISOString()
  };
  const fullPayload = {
    ...corePayload,
    subscription_current_period_end: input.currentPeriodEnd,
    subscription_cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    subscription_canceled_at: input.canceledAt
  };
  let lastError: unknown = null;

  for (const query of queries) {
    try {
      const rows = await supabaseFetch<UserProfile[]>("profiles", {
        method: "PATCH",
        query,
        body: JSON.stringify(fullPayload)
      });

      if (rows.length) {
        return rows;
      }
    } catch (error) {
      lastError = error;

      try {
        const rows = await supabaseFetch<UserProfile[]>("profiles", {
          method: "PATCH",
          query,
          body: JSON.stringify(corePayload)
        });

        if (rows.length) {
          console.warn(
            "Subscription core fields synced, but renewal/cancellation fields could not be written. Apply the latest database schema.",
            { query }
          );
          return rows;
        }
      } catch (coreError) {
        lastError = coreError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
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
  const rows = await updateSubscriptionStatus(input);
  const [saved] = rows ?? [];
  return saved ?? null;
}
