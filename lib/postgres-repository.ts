import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { CostQuote } from "@/lib/ai-cost";
import { profiles } from "@/lib/db/app-schema";
import { normalizePlanId, normalizeSubscriptionStatus } from "@/lib/stripe-rest";
import { currentUsageWindow } from "@/lib/usage";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { workspaceFromProfile, updateWorkspaceProfile } from "@/lib/workspace-contract";
import { reserveGenerationInProfile, completeGenerationInProfile, failGenerationInProfile } from "@/lib/generation-reservation";
import type { GenerateRequest, GenerationResult } from "@/types/content";
import type { BrandProfile, OnboardingData, UserProfile, PlanId, SubscriptionStatus } from "@/types/saas";

type Document = UserProfile & Record<string, unknown>;
type UsageEvent = { id: string; user_id: string; event_type: string; created_at: string; credit_source?: string };
type HistoryItem = { id: string; user_id: string; created_at: string; payload: unknown; credit_source?: string };
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
  return { id: d.id, email: d.email, full_name: d.full_name ?? undefined, plan: normalizePlanId(d.plan), subscription_status: normalizeSubscriptionStatus(d.subscription_status), stripe_customer_id: d.stripe_customer_id ?? undefined, stripe_subscription_id: d.stripe_subscription_id ?? undefined, stripe_checkout_session_id: d.stripe_checkout_session_id ?? undefined, subscription_current_period_start: d.subscription_current_period_start ?? null, subscription_current_period_end: d.subscription_current_period_end ?? null, subscription_usage_transition_start: d.subscription_usage_transition_start ?? null, subscription_usage_transition_end: d.subscription_usage_transition_end ?? null, subscription_cancel_at_period_end: d.subscription_cancel_at_period_end ?? false, subscription_cancel_at: d.subscription_cancel_at ?? null, subscription_canceled_at: d.subscription_canceled_at ?? null, entitlement_source: d.entitlement_source ?? null, amount_paid: d.amount_paid ?? null, paid_creator_lifetime_status: d.paid_creator_lifetime_status ?? null, paid_creator_lifetime_purchase_id: d.paid_creator_lifetime_purchase_id ?? null };
}
// Readers do not need replay bodies or terminal IDs. Never use this projection
// as the basis for a write: mutate() must re-read the complete locked document.
function readerData() {
  return sql<Document>`${profiles.data} - ARRAY['image_generation_reservations_json', 'image_generation_tombstones_json', 'generation_reservations_json', 'generation_tombstones_json']::text[]`;
}
async function document(id: string) {
  return (await getDb().select({ data: readerData() }).from(profiles).where(eq(profiles.id, id)).limit(1))[0]?.data ?? null;
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
export async function getWorkspace(userId: string) {
  const data = await document(userId);
  if (!data) throw new Error("Account profile is unavailable.");
  return workspaceFromProfile(data, userId);
}
export async function saveWorkspace(userId: string, input: unknown) {
  return mutate(userId, data => updateWorkspaceProfile(data, userId, input));
}
// Each operation commits before returning; provider/network work belongs between reserve and complete.
export async function reserveTextGeneration(userId: string, requestId: string, request: GenerateRequest, quote?: CostQuote) {
  if (quote) return (await import("@/lib/commercial-ledger")).reserveCommercial(userId, requestId, quote, data => reserveGenerationInProfile(data, userId, requestId, request, new Date(), true));
  return mutate(userId, data => reserveGenerationInProfile(data, userId, requestId, request));
}
export async function completeTextGeneration(userId: string, requestId: string, fingerprint: string, result: GenerationResult, quote?: CostQuote) {
  if (quote) return (await import("@/lib/commercial-ledger")).finishCommercial(userId, requestId, quote, true, data => completeGenerationInProfile(data, userId, requestId, fingerprint, result));
  return mutate(userId, data => completeGenerationInProfile(data, userId, requestId, fingerprint, result));
}
export async function failTextGeneration(userId: string, requestId: string, fingerprint: string, quote?: CostQuote) {
  if (quote) return (await import("@/lib/commercial-ledger")).finishCommercial(userId, requestId, quote, false, data => failGenerationInProfile(data, userId, requestId, fingerprint));
  return mutate(userId, data => failGenerationInProfile(data, userId, requestId, fingerprint));
}
// Only trusted server billing code may look up an email. User access always uses the session ID.
export async function getUserProfileByEmail(email: string) {
  const row = (await getDb().select({ data: readerData() }).from(profiles).where(eq(profiles.email, email.trim().toLowerCase())).limit(1))[0];
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
  periodStart?: string | null;
  transitionStart?: string | null;
  transitionEnd?: string | null;
  eventType?: "text_generation" | "image_generation";
}) {
  const d = await document(input.userId);
  const { periodStart, periodEnd } = currentUsageWindow(new Date(), input.periodEnd, input.periodStart, input.transitionStart, input.transitionEnd);
  const start = Date.parse(periodStart), end = Date.parse(periodEnd);
  const inWindow = (v: { created_at: string }) => Date.parse(v.created_at) >= start && Date.parse(v.created_at) < end;
  const events = array<UsageEvent>(d?.usage_events_json).filter(inWindow);
  const counters = d?.generation_usage_json as Record<string, number> | undefined;
  const textCount = Math.max(counters?.[periodStart] ?? 0, events.filter(e => e.event_type === "text_generation" && e.credit_source !== "purchased").length, array<HistoryItem>(d?.generation_history_json).filter(inWindow).filter(h=>h.credit_source!=="purchased").length);
  const imageCounters = d?.image_generation_usage_json as Record<string, number> | undefined;
  const imageCount = Math.max(imageCounters?.[periodStart] ?? 0, events.filter(e => e.event_type === "image_generation").length);
  if (input.eventType === "text_generation") return textCount;
  if (input.eventType === "image_generation") return imageCount;
  return events.filter(e => e.event_type !== "text_generation" && e.event_type !== "image_generation").length + textCount + imageCount;
}
export async function updateSubscriptionStatus(input: {
  userId?: string;
  email?: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: string | null;
  canceledAt?: string | null;
  entitlementSource?: string;
  amountPaid?: number;
  expectedStripeSubscriptionId?: string;
}) {
  const matching = new Map<string, UserProfile>();
  if (input.userId) { const p = await getUserProfile(input.userId); if (p) matching.set(p.id, p); }
  if (input.email) { const p = await getUserProfileByEmail(input.email); if (p) matching.set(p.id, p); }
  const updated: UserProfile[] = [];
  for (const id of matching.keys()) {
    updated.push(await mutate(id, d => {
      if (hasLifetimeEntitlement(profile(d))) return { data: d, result: profile(d) };
      // A delayed deletion must not replace a newer subscription after an earlier read.
      if (input.expectedStripeSubscriptionId !== undefined && d.stripe_subscription_id !== input.expectedStripeSubscriptionId) return { data: d, result: profile(d) };
      const sameSubscription = Boolean(input.stripeSubscriptionId && input.stripeSubscriptionId === d.stripe_subscription_id);
      const oldEnd = typeof d.subscription_current_period_end === "string" ? Date.parse(d.subscription_current_period_end) : NaN;
      const newEnd = typeof input.currentPeriodEnd === "string" ? Date.parse(input.currentPeriodEnd) : NaN;
      const newStart = typeof input.currentPeriodStart === "string" ? Date.parse(input.currentPeriodStart) : NaN;
      const preservePeriod = sameSubscription && (!Number.isFinite(newEnd) || (Number.isFinite(oldEnd) && newEnd < oldEnd));
      const periodEnd = preservePeriod ? d.subscription_current_period_end : input.currentPeriodEnd ?? null;
      const periodStart = preservePeriod ? d.subscription_current_period_start
        : input.currentPeriodStart ?? (sameSubscription && Number.isFinite(newEnd) && newEnd === oldEnd ? d.subscription_current_period_start : null);
      let transitionStart = sameSubscription ? d.subscription_usage_transition_start : null;
      let transitionEnd = sameSubscription ? d.subscription_usage_transition_end : null;
      if (transitionEnd && transitionEnd !== periodEnd) {
        if (periodStart && periodStart === d.subscription_current_period_start && Number.isFinite(newEnd) && newEnd > oldEnd) {
          transitionEnd = periodEnd;
        } else { transitionStart = null; transitionEnd = null; }
      }
      // Existing subscriptions previously used a calendar (or inferred) window.
      // Keep that window's start until the first verified Stripe period
      // ends, so backfilling dates cannot grant a second allowance mid-cycle.
      if (sameSubscription && !d.subscription_current_period_start && !transitionEnd &&
          ["active", "trialing"].includes(String(d.subscription_status)) &&
          Number.isFinite(newStart) && Number.isFinite(newEnd) && newStart <= Date.now() && Date.now() < newEnd && !preservePeriod) {
        const oldWindow = currentUsageWindow(new Date(), d.subscription_current_period_end);
        if (Date.parse(oldWindow.periodStart) !== newStart) {
          transitionStart = oldWindow.periodStart;
          transitionEnd = input.currentPeriodEnd;
        }
      }
      const data = { ...d, ...clean({ subscription_current_period_start: periodStart ?? null, subscription_current_period_end: periodEnd ?? null,
        subscription_usage_transition_start: transitionStart ?? null, subscription_usage_transition_end: transitionEnd ?? null, plan: normalizePlanId(input.plan), subscription_status: normalizeSubscriptionStatus(input.status), stripe_customer_id: input.stripeCustomerId, stripe_subscription_id: input.stripeSubscriptionId, stripe_checkout_session_id: input.stripeCheckoutSessionId, subscription_cancel_at_period_end: input.cancelAtPeriodEnd ?? false, subscription_cancel_at: input.cancelAt ?? null, subscription_canceled_at: input.canceledAt ?? null, entitlement_source: input.entitlementSource, amount_paid: input.amountPaid, updated_at: new Date().toISOString() }) };
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
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: string | null;
  canceledAt?: string | null;
  entitlementSource?: string;
  amountPaid?: number;
}) {
  await upsertUserProfile({ id: input.userId, email: input.email });
  return (await updateSubscriptionStatus(input))[0] ?? null;
}

export async function reserveImageGeneration(userId: string, input: import("@/lib/image-generation-contract").ImageGenerationInput, quote?: CostQuote) {
  const { reserveImageInProfile } = await import("@/lib/image-generation-reservation");
  if (quote) return (await import("@/lib/commercial-ledger")).reserveCommercial(userId, input.requestId, quote, data => reserveImageInProfile(data, userId, input));
  return mutate(userId, data => reserveImageInProfile(data, userId, input));
}
export async function completeImageGeneration(userId: string, requestId: string, fingerprint: string, result: import("@/lib/image-generation-contract").ImageGenerationResult, quote?: CostQuote) {
  const { completeImageInProfile } = await import("@/lib/image-generation-reservation");
  if (quote) return (await import("@/lib/commercial-ledger")).finishCommercial(userId, requestId, quote, result.creditCharged, data => completeImageInProfile(data, userId, requestId, fingerprint, result));
  return mutate(userId, data => completeImageInProfile(data, userId, requestId, fingerprint, result));
}
export async function failImageGeneration(userId: string, requestId: string, fingerprint: string, quote?: CostQuote) {
  const { failImageInProfile } = await import("@/lib/image-generation-reservation");
  if (quote) return (await import("@/lib/commercial-ledger")).finishCommercial(userId, requestId, quote, false, data => failImageInProfile(data, userId, requestId, fingerprint));
  return mutate(userId, data => failImageInProfile(data, userId, requestId, fingerprint));
}
