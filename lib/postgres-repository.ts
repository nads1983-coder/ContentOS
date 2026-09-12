import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/app-schema";
import { normalizePlanId, normalizeSubscriptionStatus } from "@/lib/stripe-rest";
import { currentUsageWindow } from "@/lib/usage";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import type { BrandProfile, OnboardingData, UserProfile, PlanId, SubscriptionStatus } from "@/types/saas";

type Document = UserProfile & Record<string, unknown>;
type UsageEvent = { id: string; user_id: string; event_type: string; created_at: string };
type HistoryItem = { id: string; user_id: string; created_at: string; payload: unknown };
const clean = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
function array<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string" && value) {
    const parsed = JSON.parse(value); // Fail safely rather than overwrite malformed source data.
    if (Array.isArray(parsed)) return parsed as T[];
  }
  return [];
}
function profile(d: Document): UserProfile {
  return { id: d.id, email: d.email, full_name: d.full_name ?? undefined, plan: normalizePlanId(d.plan), subscription_status: normalizeSubscriptionStatus(d.subscription_status), stripe_customer_id: d.stripe_customer_id ?? undefined, stripe_subscription_id: d.stripe_subscription_id ?? undefined, stripe_checkout_session_id: d.stripe_checkout_session_id ?? undefined, subscription_current_period_end: d.subscription_current_period_end ?? null, subscription_cancel_at_period_end: d.subscription_cancel_at_period_end ?? false, subscription_canceled_at: d.subscription_canceled_at ?? null, entitlement_source: d.entitlement_source ?? null, amount_paid: d.amount_paid ?? null };
}
async function document(id: string) {
  return (await getDb().select().from(profiles).where(eq(profiles.id, id)).limit(1))[0]?.data ?? null;
}
// Row locks prevent concurrent edits from dropping history, usage or billing changes.
async function mutate<T>(id: string, fn: (d: Document) => { data: Document; result: T }) {
  return getDb().transaction(async tx => {
    const row = (await tx.select().from(profiles).where(eq(profiles.id, id)).for("update"))[0];
    if (!row) throw new Error("Account profile is unavailable.");
    const { data, result } = fn(row.data);
    await tx.update(profiles).set({ data, updatedAt: new Date() }).where(eq(profiles.id, id));
    return result;
  });
}
export async function getUserProfile(id: string) { const d = await document(id); return d ? profile(d) : null; }
// Only trusted server billing code may look up an email. User access always uses the session ID.
export async function getUserProfileByEmail(email: string) {
  const row = (await getDb().select().from(profiles).where(eq(profiles.email, email.trim().toLowerCase())).limit(1))[0];
  return row ? profile(row.data) : null;
}
export async function getUserProfileForUser(id: string, _email?: string) { return getUserProfile(id); }
export async function upsertUserProfile(input: Partial<UserProfile> & { id: string; email: string }) {
  const email = input.email.trim().toLowerCase();
  const patch = clean({ ...input, email, updated_at: new Date().toISOString() });
  const data = { plan: "free", subscription_status: "none", created_at: new Date().toISOString(), ...patch } as Document;
  const [row] = await getDb().insert(profiles).values({ id: input.id, email, data }).onConflictDoUpdate({
    target: profiles.id,
    set: { data: sql`${profiles.data} || ${JSON.stringify(patch)}::jsonb`, email, updatedAt: new Date() }
  }).returning();
  return profile(row.data);
}
export async function listBrandProfiles(id: string) { return array<BrandProfile>((await document(id))?.brand_profiles_json); }
export async function createBrandProfile(id: string, input: Omit<BrandProfile, "id">) {
  return mutate(id, d => {
    const saved = { ...input, id: randomUUID(), user_id: id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    return { data: { ...d, brand_profiles_json: [saved, ...array<BrandProfile>(d.brand_profiles_json)] }, result: saved };
  });
}
export async function deleteBrandProfile(id: string, brandId: string) {
  return mutate(id, d => ({ data: { ...d, brand_profiles_json: array<BrandProfile>(d.brand_profiles_json).filter(p => p.id !== brandId) }, result: null }));
}
export async function saveOnboarding(id: string, input: OnboardingData) {
  return mutate(id, d => ({ data: { ...d, onboarding_json: { ...input, updated_at: new Date().toISOString() } }, result: { id } }));
}
export async function recordGeneration(id: string, payload: unknown) {
  return mutate(id, d => {
    const saved = { id: randomUUID(), user_id: id, payload, created_at: new Date().toISOString() };
    return { data: { ...d, generation_history_json: [saved, ...array<HistoryItem>(d.generation_history_json)].slice(0, 100) }, result: [saved] };
  });
}
export async function recordUsageEvent(input: {
  userId: string;
  email?: string;
  eventType: "text_generation" | "image_generation";
  metadata?: Record<string, unknown>;
}) {
  await upsertUserProfile({ id: input.userId, email: input.email ?? "" });
  return mutate(input.userId, d => {
    const saved = { id: randomUUID(), user_id: input.userId, event_type: input.eventType, metadata: { ...input.metadata, email: input.email }, created_at: new Date().toISOString() };
    return { data: { ...d, usage_events_json: [saved, ...array<UsageEvent>(d.usage_events_json)].slice(0, 500) }, result: [saved] };
  });
}
export async function getMonthlyUsageCount(input: {
  userId: string;
  periodEnd?: string | null;
  eventType?: "text_generation" | "image_generation";
}) {
  const d = await document(input.userId);
  const { periodStart, periodEnd } = currentUsageWindow(new Date(), input.periodEnd);
  const start = Date.parse(periodStart), end = Date.parse(periodEnd);
  const inWindow = (v: { created_at: string }) => Date.parse(v.created_at) >= start && Date.parse(v.created_at) < end;
  const events = array<UsageEvent>(d?.usage_events_json).filter(inWindow);
  if (input.eventType) return events.filter(e => e.event_type === input.eventType).length;
  return events.length + Math.max(0, array<HistoryItem>(d?.generation_history_json).filter(inWindow).length - events.filter(e => e.event_type === "text_generation").length);
}
export async function updateSubscriptionStatus(input: {
  userId?: string;
  email?: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  entitlementSource?: string;
  amountPaid?: number;
}) {
  const matching = new Map<string, UserProfile>();
  if (input.userId) { const p = await getUserProfile(input.userId); if (p) matching.set(p.id, p); }
  if (input.email) { const p = await getUserProfileByEmail(input.email); if (p) matching.set(p.id, p); }
  const updated: UserProfile[] = [];
  for (const id of matching.keys()) {
    updated.push(await mutate(id, d => {
      if (hasLifetimeEntitlement(profile(d))) return { data: d, result: profile(d) };
      const data = { ...d, ...clean({ plan: normalizePlanId(input.plan), subscription_status: normalizeSubscriptionStatus(input.status), stripe_customer_id: input.stripeCustomerId, stripe_subscription_id: input.stripeSubscriptionId, stripe_checkout_session_id: input.stripeCheckoutSessionId, subscription_current_period_end: input.currentPeriodEnd ?? null, subscription_cancel_at_period_end: input.cancelAtPeriodEnd ?? false, subscription_canceled_at: input.canceledAt ?? null, entitlement_source: input.entitlementSource, amount_paid: input.amountPaid, updated_at: new Date().toISOString() }) };
      return { data, result: profile(data) };
    }));
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
  stripeCheckoutSessionId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  entitlementSource?: string;
  amountPaid?: number;
}) {
  await upsertUserProfile({ id: input.userId, email: input.email });
  return (await updateSubscriptionStatus(input))[0] ?? null;
}
