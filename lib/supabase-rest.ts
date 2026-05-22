import { getEnv, isSupabaseAdminConfigured } from "@/lib/env";
import { BrandProfile, OnboardingData, PlanId, UserProfile } from "@/types/saas";

type QueryValue = string | number | boolean | null;

function restUrl(path: string, query?: Record<string, QueryValue>) {
  const env = getEnv();
  const url = new URL(`/rest/v1/${path}`, env.supabaseUrl);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null) {
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
      plan: "free",
      subscription_status: "none",
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

export async function updateSubscriptionStatus(input: {
  userId?: string;
  email?: string;
  plan: PlanId;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const query: Record<string, QueryValue> | null = input.userId
    ? { id: `eq.${input.userId}` }
    : input.email
      ? { email: `eq.${input.email}` }
      : null;

  if (!query) {
    return null;
  }

  return supabaseFetch<UserProfile[]>("profiles", {
    method: "PATCH",
    query,
    body: JSON.stringify({
      plan: input.plan,
      subscription_status: input.status,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      updated_at: new Date().toISOString()
    })
  });
}
