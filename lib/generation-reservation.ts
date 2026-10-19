import { createHash } from "node:crypto";
import { contentTypes } from "@/lib/content-config";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { usesLifetimeCredits } from "@/lib/lifetime-access";
import { normalizePlanId, normalizeSubscriptionStatus, planHasActiveEntitlement } from "@/lib/stripe-rest";
import { currentUsageWindow, monthlyLimitForPlan } from "@/lib/usage";
import { assertWorkspaceAccount, parseWorkspaceGeneration, profileArray } from "@/lib/workspace-contract";
import type { GenerateRequest, GenerationResult } from "@/types/content";
import type { GenerationInput } from "@/lib/generation-contract";
import type { PlanId, UserProfile } from "@/types/saas";

export class GenerationReservationError extends Error {
  status: number;
  code: string;
  retryAfterSeconds?: number;
  constructor(message: string, status: number, code: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "GenerationReservationError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export type GenerationAdmission =
  | { status: "reserved"; requestId: string; fingerprint: string; plan: PlanId }
  | { status: "replay"; requestId: string; result: GenerationResult };
type Reservation = {
  requestId: string;
  fingerprint: string;
  status: "reserved" | "completed" | "failed";
  plan: PlanId;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  completedAt?: string;
  failedAt?: string;
  result?: GenerationResult;
};
type UsageEvent = { id: string; user_id?: string; event_type: string; created_at: string };
type HistoryItem = { id: string; user_id?: string; created_at: string; payload: unknown };
type Document = UserProfile & Record<string, unknown>;
type TombstoneStatus = "completed" | "failed" | "expired";
type Tombstones = Record<string, TombstoneStatus>;
export const GENERATION_RETENTION = {
  replayMs: 30 * 24 * 60 * 60 * 1000,
  reservationMs: 15 * 60 * 1000,
  replayBytes: 4_000_000,
  replayEntries: 2000,
  concurrentRequests: 16
} as const;
export const TEXT_ATTEMPT_BUDGET = { windowMs: 60_000, max: 20, dailyMax: 100 } as const;

function admitTextAttempt(data: Document, now: Date) {
  const stored = data.text_generation_attempts_json ?? [];
  if (!Array.isArray(stored) || stored.length > TEXT_ATTEMPT_BUDGET.max || stored.some(time => !Number.isSafeInteger(time) || time < 0)) {
    throw new GenerationReservationError("Generation attempt accounting is unavailable.", 503, "invalid_attempt_budget");
  }
  const time = now.getTime();
  const day = now.toISOString().slice(0, 10), dayStart = Date.parse(`${day}T00:00:00.000Z`);
  // Existing profiles may have minute accounting only; preserve the known attempts from today.
  const daily = data.text_generation_daily_attempts_json === undefined
    ? { day, count: stored.filter(at => at >= dayStart && at < dayStart + 86_400_000).length }
    : data.text_generation_daily_attempts_json;
  if (!daily || typeof daily !== "object" || Array.isArray(daily) ||
      !("day" in daily) || typeof daily.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(daily.day) ||
      !Number.isFinite(Date.parse(daily.day)) || new Date(daily.day).toISOString().slice(0, 10) !== daily.day || daily.day > day ||
      !("count" in daily) || typeof daily.count !== "number" || !Number.isSafeInteger(daily.count) || daily.count < 0 || daily.count > TEXT_ATTEMPT_BUDGET.dailyMax) {
    throw new GenerationReservationError("Generation attempt accounting is unavailable.", 503, "invalid_attempt_budget");
  }
  const count = daily.day === day ? daily.count : 0;
  const recent = (stored as number[]).filter(at => at > time - TEXT_ATTEMPT_BUDGET.windowMs).sort((a, b) => a - b);
  if (recent.length >= TEXT_ATTEMPT_BUDGET.max || count >= TEXT_ATTEMPT_BUDGET.dailyMax) {
    const rollingWait = recent.length >= TEXT_ATTEMPT_BUDGET.max ? recent[0] + TEXT_ATTEMPT_BUDGET.windowMs - time : 0;
    const dailyWait = count >= TEXT_ATTEMPT_BUDGET.dailyMax ? dayStart + 86_400_000 - time : 0;
    const retryAfter = Math.max(1, Math.ceil(Math.max(rollingWait, dailyWait) / 1000));
    throw new GenerationReservationError("Too many generation attempts. Please wait before trying again.", 429, "generation_attempt_limit", retryAfter);
  }
  // Persisted in the admission transaction, independently of successful credits and replay retention.
  return { recent: [...recent, time], daily: { day, count: count + 1 } };
}

export function effectiveGenerationPlan(data: UserProfile, now = new Date()): PlanId {
  if (usesLifetimeCredits(data, now)) return "pro_studio";
  const profile = { ...data, plan: normalizePlanId(data.plan), subscription_status: normalizeSubscriptionStatus(data.subscription_status) };
  if (hasLifetimeEntitlement(profile)) return profile.plan;
  if (!planHasActiveEntitlement(profile.plan, profile.subscription_status)) return "free";
  // A stale active billing record must not extend an expired paid subscription.
  if (profile.subscription_current_period_end && !(Date.parse(profile.subscription_current_period_end) > now.getTime())) return "free";
  return profile.plan;
}
function requestIdentity(requestId: string) {
  if (typeof requestId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(requestId)) {
    throw new GenerationReservationError("A valid requestId is required.", 400, "invalid_request_id");
  }
}
export function generationFingerprint(request: GenerateRequest): string {
  if (!request || typeof request.source !== "string" || request.source.length < 8 || request.source.length > 8000 || !Array.isArray(request.selectedTypes) || !request.selectedTypes.length || request.selectedTypes.length > contentTypes.length || request.selectedTypes.some(id => !contentTypes.some(type => type.id === id))) {
    throw new GenerationReservationError("Invalid generation request.", 400, "invalid_request");
  }
  // Only normalized model inputs contribute; property ordering and requestId do not.
  const extended = request as GenerationInput;
  const section = extended.refinement?.section;
  const payload = {
    source: request.source, brandName: request.brandName ?? "", audience: request.audience ?? "",
    offer: request.offer ?? "", writingStyle: request.writingStyle ?? "", contentGoal: request.contentGoal ?? "",
    tone: request.tone, sharpness: request.sharpness, ctaMode: request.ctaMode, presetTopic: request.presetTopic,
    selectedTypes: [...new Set(request.selectedTypes)].sort(), length: extended.length ?? "standard",
    refinement: extended.refinement ? { action: extended.refinement.action, section: section ? { id: section.id, type: section.type, title: section.title, platform: section.platform, body: section.body, items: section.items, cta: section.cta ?? "" } : null } : null
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function reservations(data: Document): Reservation[] {
  const entries = profileArray<Reservation>(data.generation_reservations_json);
  if (entries.some(r => !r || typeof r.requestId !== "string" || typeof r.fingerprint !== "string" || !["reserved", "completed", "failed"].includes(r.status) || !Number.isFinite(Date.parse(r.createdAt)))) {
    throw new GenerationReservationError("Stored generation reservations are unavailable.", 503, "invalid_reservations");
  }
  return entries;
}
function counters(data: Document, field: "generation_usage_json" | "image_generation_usage_json" = "generation_usage_json"): Record<string, number> {
  const value = data[field];
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value) || Object.entries(value).some(([key, n]) =>
    !Number.isSafeInteger(n) || (n as number) < 0 ||
    (field === "image_generation_usage_json" && (key.length > 32 || !Number.isFinite(Date.parse(key)))))) {
    throw new GenerationReservationError("Stored generation usage is unavailable.", 503, "invalid_usage");
  }
  return value as Record<string, number>;
}
function usageInWindow(data: Document, userId: string, start: string, end: string) {
  const inWindow = (item: { user_id?: string; created_at: string }) => (!item.user_id || item.user_id === userId) && Date.parse(item.created_at) >= Date.parse(start) && Date.parse(item.created_at) < Date.parse(end);
  const events = profileArray<UsageEvent>(data.usage_events_json).filter(inWindow);
  const text = events.filter(e => e.event_type === "text_generation").length;
  const history = profileArray<HistoryItem>(data.generation_history_json).filter(inWindow).length;
  const images = Math.max(events.filter(e => e.event_type === "image_generation").length, counters(data, "image_generation_usage_json")[start] ?? 0);
  return { text: Math.max(text, history, counters(data)[start] ?? 0), other: images + events.filter(e => e.event_type !== "text_generation" && e.event_type !== "image_generation").length };
}
function requestHash(requestId: string) {
  return createHash("sha256").update(requestId).digest("hex");
}
function terminalRequests(data: Document): Tombstones {
  const value = data.generation_tombstones_json;
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value) || Object.entries(value).some(([key, status]) => !/^[a-f0-9]{64}$/.test(key) || !["completed", "failed", "expired"].includes(status as string))) {
    throw new GenerationReservationError("Stored generation tombstones are unavailable.", 503, "invalid_reservations");
  }
  return value as Tombstones;
}
function rejectTerminal(status: TombstoneStatus | undefined) {
  if (!status) return;
  if (status === "failed") throw new GenerationReservationError("This attempt failed. It will not be regenerated automatically.", 409, "request_failed");
  throw new GenerationReservationError("This request is no longer replayable. It will not be regenerated. Start a new request explicitly if needed.", 410, "request_expired");
}
function retainedLedger(data: Document, now: Date) {
  const entries = reservations(data), tombstones = { ...terminalRequests(data) };
  const keep = new Set<Reservation>();
  const completed: Reservation[] = [];
  for (const entry of entries) {
    const hash = requestHash(entry.requestId);
    if (Object.hasOwn(tombstones, hash)) continue;
    if (entry.status === "failed") tombstones[hash] = "failed";
    else if (entry.status === "reserved") {
      // The provider may have succeeded before a process crash. Expiry is terminal, not a retry lease.
      if (now.getTime() - Date.parse(entry.createdAt) >= GENERATION_RETENTION.reservationMs) tombstones[hash] = "expired";
      else keep.add(entry);
    } else if (!entry.result || now.getTime() - Date.parse(entry.completedAt ?? entry.createdAt) >= GENERATION_RETENTION.replayMs) tombstones[hash] = "completed";
    else completed.push(entry);
  }
  let bytes = 0, count = 0;
  // Pressure evicts the oldest replay results, never their terminal request identity.
  for (const entry of completed.sort((a, b) => Date.parse(b.completedAt ?? b.createdAt) - Date.parse(a.completedAt ?? a.createdAt))) {
    const size = Buffer.byteLength(JSON.stringify(entry), "utf8") + 1;
    if (bytes + size <= GENERATION_RETENTION.replayBytes && count < GENERATION_RETENTION.replayEntries) {
      keep.add(entry);
      bytes += size;
      count++;
    } else tombstones[requestHash(entry.requestId)] = "completed";
  }
  const retained = entries.filter(entry => keep.has(entry));
  // Exact rejection of arbitrary old IDs needs durable metadata per request. Only these hashes grow;
  // fully bounded lifetime storage would require a new timestamped/signed request-ID protocol.
  const updated = retained.length === entries.length ? data : { ...data, generation_reservations_json: retained, generation_tombstones_json: tombstones };
  return { data: updated, entries: retained, tombstones };
}
export function reserveGenerationInProfile(data: Document, userId: string, requestId: string, request: GenerateRequest, now = new Date()): { data: Document; result: GenerationAdmission } {
  assertWorkspaceAccount(data, userId);
  requestIdentity(requestId);
  const fingerprint = generationFingerprint(request), ledger = retainedLedger(data, now);
  const { entries } = ledger;
  rejectTerminal(ledger.tombstones[requestHash(requestId)]);
  data = ledger.data;
  const existing = entries.find(r => r.requestId === requestId);
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new GenerationReservationError("requestId was already used for different inputs.", 409, "request_mismatch");
    if (existing.status === "completed" && existing.result) return { data, result: { status: "replay", requestId, result: existing.result } };
    throw new GenerationReservationError(existing.status === "failed" ? "This attempt failed or has an uncertain outcome. It will not be regenerated automatically." : "This generation is already in progress or awaiting reconciliation.", 409, existing.status === "failed" ? "request_failed" : "request_in_progress");
  }
  if (entries.some(r => r.fingerprint === fingerprint && r.status === "reserved")) throw new GenerationReservationError("An identical generation is already in progress.", 409, "duplicate_in_progress");
  if (entries.filter(r => r.status === "reserved").length >= GENERATION_RETENTION.concurrentRequests) throw new GenerationReservationError("Too many generations are in progress. Wait for them to finish before starting another.", 429, "generation_concurrency_limit");
  const plan = effectiveGenerationPlan(data, now);
  if (plan === "free" && request.selectedTypes.some(id => contentTypes.find(type => type.id === id)?.paidOnly)) throw new GenerationReservationError("These outputs require a paid plan.", 403, "paid_output_required");
  const { periodStart, periodEnd } = currentUsageWindow(now, hasLifetimeEntitlement(data) ? null : data.subscription_current_period_end);
  const used = usageInWindow(data, userId, periodStart, periodEnd);
  const pending = entries.filter(r => r.status === "reserved" && Date.parse(r.createdAt) >= Date.parse(periodStart) && Date.parse(r.createdAt) < Date.parse(periodEnd)).length;
  if (!usesLifetimeCredits(data, now) && used.text + used.other + pending >= monthlyLimitForPlan(plan)) throw new GenerationReservationError("Monthly generation limit reached.", 429, "quota_exceeded");
  const attempts = admitTextAttempt(data, now);
  const reservation: Reservation = { requestId, fingerprint, plan, status: "reserved", createdAt: now.toISOString(), periodStart, periodEnd };
  const updated = { ...data, text_generation_attempts_json: attempts.recent, text_generation_daily_attempts_json: attempts.daily, generation_reservations_json: [...entries, reservation], generation_usage_json: { ...counters(data), [periodStart]: used.text } };
  return { data: updated, result: { status: "reserved", requestId, fingerprint, plan } };
}
function matchingReservation(data: Document, userId: string, requestId: string, fingerprint: string, now: Date) {
  assertWorkspaceAccount(data, userId);
  requestIdentity(requestId);
  const ledger = retainedLedger(data, now), { entries } = ledger;
  rejectTerminal(ledger.tombstones[requestHash(requestId)]);
  const entry = entries.find(r => r.requestId === requestId);
  if (!entry || entry.fingerprint !== fingerprint) throw new GenerationReservationError("Generation reservation does not match this account and request.", 409, "reservation_mismatch");
  return { entries, entry, data: ledger.data };
}
export function completeGenerationInProfile(data: Document, userId: string, requestId: string, fingerprint: string, result: GenerationResult, now = new Date()): { data: Document; result: GenerationResult } {
  const matched = matchingReservation(data, userId, requestId, fingerprint, now);
  const { entries, entry } = matched;
  data = matched.data;
  if (entry.status === "completed" && entry.result) return { data, result: entry.result };
  if (entry.status !== "reserved") throw new GenerationReservationError("This generation attempt is terminal.", 409, "request_failed");
  const clean = parseWorkspaceGeneration(result);
  if (!clean.sections.length || !clean.id || Buffer.byteLength(JSON.stringify(clean), "utf8") > 128_000) throw new GenerationReservationError("Generated output is invalid or too large.", 502, "invalid_result");
  const completed: Reservation = { ...entry, status: "completed", completedAt: now.toISOString(), result: clean };
  // Charge the admission window even if the provider returns after the month boundary.
  const used = usageInWindow(data, userId, entry.periodStart, entry.periodEnd);
  const event = { id: requestId, user_id: userId, event_type: "text_generation", created_at: entry.createdAt, metadata: { generationId: clean.id, requestId } };
  const history = { id: requestId, user_id: userId, created_at: entry.createdAt, payload: clean };
  return {
    data: {
      ...data,
      ...retainedLedger({ ...data, generation_reservations_json: entries.map(r => r.requestId === requestId ? completed : r) }, now).data,
      generation_usage_json: { ...counters(data), [entry.periodStart]: used.text + 1 },
      usage_events_json: [event, ...profileArray<UsageEvent>(data.usage_events_json)].slice(0, 500),
      generation_history_json: [history, ...profileArray<HistoryItem>(data.generation_history_json)].slice(0, 100)
    }, result: clean
  };
}
export function failGenerationInProfile(data: Document, userId: string, requestId: string, fingerprint: string, now = new Date()): { data: Document; result: void } {
  assertWorkspaceAccount(data, userId);
  requestIdentity(requestId);
  const ledger = retainedLedger(data, now);
  if (ledger.tombstones[requestHash(requestId)]) return { data: ledger.data, result: undefined };
  const { entries, entry } = matchingReservation(ledger.data, userId, requestId, fingerprint, now);
  data = ledger.data;
  if (entry.status !== "reserved") return { data, result: undefined };
  return { data: { ...data, generation_reservations_json: entries.map(r => r.requestId === requestId ? { ...r, status: "failed", failedAt: now.toISOString() } : r) }, result: undefined };
}
