import { createHash } from "node:crypto";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import { effectiveGenerationPlan } from "@/lib/generation-reservation";
import { currentUsageWindow } from "@/lib/usage";
import { profileArray } from "@/lib/workspace-contract";
import {
  IMAGE_FORMATS, IMAGE_LIMITS, IMAGE_STYLES, ImageGenerationError, isImageRecord,
  normalizeImageRequest, validateImageRequestId, validateImageResult
} from "@/lib/image-generation-contract";
import type { ImageGenerationInput, ImageGenerationResult } from "@/lib/image-generation-contract";
import type { UserProfile } from "@/types/saas";

export const IMAGE_RETENTION = {
  replayMs: 24 * 60 * 60 * 1000,
  reservationMs: 15 * 60 * 1000,
  replayBytes: 10_000_000,
  replayEntries: 8,
  concurrentRequests: 2,
  attemptsPerWindow: 6,
  attemptWindowMs: 10 * 60 * 1000,
  attemptsPerDay: 100,
  terminalIdentities: 10_000,
  usageWindows: 36
} as const;

type Document = UserProfile & Record<string, unknown>;
type Reservation = {
  requestId: string; fingerprint: string; status: "reserved" | "completed";
  createdAt: string; periodStart: string; periodEnd: string;
  style: ImageGenerationInput["style"]; format: ImageGenerationInput["format"];
  completedAt?: string; result?: ImageGenerationResult;
};
type Tombstone = { fingerprint: string; status: "completed" | "failed" | "expired" };
type Ledger = { entries: Reservation[]; tombstones: Record<string, Tombstone> };
export type ImageAdmission =
  | { status: "reserved"; requestId: string; fingerprint: string }
  | { status: "replay"; requestId: string; result: ImageGenerationResult };

function unavailable(): never {
  throw new ImageGenerationError("Image usage or reservation storage is unavailable.", 503, "image_storage_unavailable");
}
function account(data: Document, userId: string) {
  if (!userId || data.id !== userId) throw new ImageGenerationError("Account is unavailable.", 403, "account_mismatch");
}
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function validHash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function validDate(value: unknown): value is string { return typeof value === "string" && value.length <= 32 && Number.isFinite(Date.parse(value)); }

export function imageGenerationFingerprint(input: ImageGenerationInput): string {
  const normalized = normalizeImageRequest(input);
  const { requestId: _requestId, ...payload } = normalized;
  return hash(JSON.stringify(payload));
}

function readLedger(data: Document): Ledger {
  let raw: unknown[];
  try { raw = profileArray<unknown>(data.image_generation_reservations_json); } catch { return unavailable(); }
  if (raw.length > IMAGE_RETENTION.replayEntries + IMAGE_RETENTION.concurrentRequests) return unavailable();
  const entries: Reservation[] = [];
  const ids = new Set<string>();
  for (const value of raw) {
    if (!isImageRecord(value) || !validHash(value.fingerprint) ||
        !["reserved", "completed"].includes(value.status as string) ||
        !validDate(value.createdAt) || !validDate(value.periodStart) || !validDate(value.periodEnd) ||
        Date.parse(value.periodStart) >= Date.parse(value.periodEnd) ||
        !IMAGE_STYLES.includes(value.style as ImageGenerationInput["style"]) ||
        !IMAGE_FORMATS.includes(value.format as ImageGenerationInput["format"])) return unavailable();
    let id: string;
    try { id = validateImageRequestId(value.requestId); } catch { return unavailable(); }
    if (ids.has(id) || id !== value.requestId) return unavailable();
    ids.add(id);
    if (value.status === "completed" && (!validDate(value.completedAt) || !value.result)) return unavailable();
    entries.push(value as Reservation);
  }
  const rawTombstones = data.image_generation_tombstones_json ?? {};
  if (!isImageRecord(rawTombstones) || Object.keys(rawTombstones).length + entries.length > IMAGE_RETENTION.terminalIdentities) return unavailable();
  const tombstones: Record<string, Tombstone> = {};
  for (const [key, value] of Object.entries(rawTombstones)) {
    if (!validHash(key) || !isImageRecord(value) || !validHash(value.fingerprint) || !["completed", "failed", "expired"].includes(value.status as string) || ids.has(key)) return unavailable();
    tombstones[key] = { fingerprint: value.fingerprint, status: value.status as Tombstone["status"] };
  }
  if (entries.some(entry => Object.hasOwn(tombstones, hash(entry.requestId)))) return unavailable();
  return { entries, tombstones };
}

function compact(ledger: Ledger, now: Date): Ledger {
  const tombstones = { ...ledger.tombstones };
  const pending: Reservation[] = [];
  const completed: Reservation[] = [];
  for (const entry of ledger.entries) {
    const expired = entry.status === "reserved"
      ? now.getTime() - Date.parse(entry.createdAt) >= IMAGE_RETENTION.reservationMs
      : now.getTime() - Date.parse(entry.completedAt!) >= IMAGE_RETENTION.replayMs;
    if (expired) tombstones[hash(entry.requestId)] = { fingerprint: entry.fingerprint, status: entry.status === "reserved" ? "expired" : "completed" };
    else if (entry.status === "reserved") pending.push(entry);
    else completed.push(entry);
  }
  let bytes = 0;
  const kept: Reservation[] = [];
  for (const entry of completed.sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))) {
    const size = Buffer.byteLength(JSON.stringify(entry), "utf8") + 1;
    if (kept.length < IMAGE_RETENTION.replayEntries && bytes + size <= IMAGE_RETENTION.replayBytes) {
      kept.push(entry); bytes += size;
    } else tombstones[hash(entry.requestId)] = { fingerprint: entry.fingerprint, status: "completed" };
  }
  return { entries: [...pending, ...kept], tombstones };
}
function withLedger(data: Document, ledger: Ledger): Document {
  return { ...data, image_generation_reservations_json: ledger.entries, image_generation_tombstones_json: ledger.tombstones };
}
function rejectTerminal(terminal: Tombstone | undefined, fingerprint: string) {
  if (!terminal) return;
  if (terminal.fingerprint !== fingerprint) throw new ImageGenerationError("This request ID belongs to different image inputs.", 409, "request_mismatch");
  if (terminal.status === "failed") throw new ImageGenerationError("This image attempt failed. Start a new request explicitly to try again.", 409, "request_failed");
  throw new ImageGenerationError("This image request is no longer replayable. It will not regenerate automatically.", 410, "request_expired");
}

function readCounters(data: Document): Record<string, number> {
  const value = data.image_generation_usage_json ?? {};
  if (!isImageRecord(value) || Object.keys(value).length > IMAGE_RETENTION.usageWindows + IMAGE_RETENTION.concurrentRequests ||
      Object.entries(value).some(([key, count]) => !validDate(key) || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)) return unavailable();
  return value as Record<string, number>;
}
function usageEvents(data: Document): Array<Record<string, unknown>> {
  let values: unknown[];
  try { values = profileArray<unknown>(data.usage_events_json); } catch { return unavailable(); }
  if (values.length > 5000 || values.some(value => !isImageRecord(value) || typeof value.event_type !== "string" || !validDate(value.created_at))) return unavailable();
  return values as Array<Record<string, unknown>>;
}
function usedInWindow(data: Document, userId: string, start: string, end: string) {
  const events = usageEvents(data).filter(event => event.event_type === "image_generation" &&
    (!event.user_id || event.user_id === userId) && Date.parse(event.created_at as string) >= Date.parse(start) && Date.parse(event.created_at as string) < Date.parse(end));
  return Math.max(readCounters(data)[start] ?? 0, events.length);
}
function boundedCounters(values: Record<string, number>, entries: Reservation[]) {
  const keep = new Set(Object.keys(values).sort((a, b) => Date.parse(b) - Date.parse(a)).slice(0, IMAGE_RETENTION.usageWindows));
  for (const entry of entries) if (entry.status === "reserved") keep.add(entry.periodStart);
  return Object.fromEntries(Object.entries(values).filter(([key]) => keep.has(key)));
}

function consumeAttempt(data: Document, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const value = data.image_generation_attempts_json ?? { day: today, count: 0, recent: [] };
  if (!isImageRecord(value) || typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
      !Number.isFinite(Date.parse(value.day)) || value.day > today ||
      typeof value.count !== "number" || !Number.isSafeInteger(value.count) || value.count < 0 || value.count > IMAGE_RETENTION.attemptsPerDay ||
      !Array.isArray(value.recent) || value.recent.length > IMAGE_RETENTION.attemptsPerWindow || !value.recent.every(validDate)) return unavailable();
  const count = value.day === today ? value.count : 0;
  const recent = (value.recent as string[]).filter(date => now.getTime() - Date.parse(date) < IMAGE_RETENTION.attemptWindowMs);
  if (count >= IMAGE_RETENTION.attemptsPerDay || recent.length >= IMAGE_RETENTION.attemptsPerWindow) {
    const dailyWait = count >= IMAGE_RETENTION.attemptsPerDay
      ? Date.parse(`${today}T00:00:00.000Z`) + 24 * 60 * 60 * 1000 - now.getTime() : 0;
    const rollingWait = recent.length >= IMAGE_RETENTION.attemptsPerWindow
      ? Math.min(...recent.map(Date.parse)) + IMAGE_RETENTION.attemptWindowMs - now.getTime() : 0;
    throw new ImageGenerationError("Image attempt limit reached. Wait before starting another image.", 429, "image_attempt_limit", Math.max(1, Math.ceil(Math.max(dailyWait, rollingWait) / 1000)));
  }
  return { day: today, count: count + 1, recent: [...recent, now.toISOString()] };
}

export function reserveImageInProfile(data: Document, userId: string, input: ImageGenerationInput, now = new Date()): { data: Document; result: ImageAdmission } {
  account(data, userId);
  const request = normalizeImageRequest(input);
  const fingerprint = imageGenerationFingerprint(request);
  const ledger = compact(readLedger(data), now);
  rejectTerminal(ledger.tombstones[hash(request.requestId)], fingerprint);
  const existing = ledger.entries.find(entry => entry.requestId === request.requestId);
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new ImageGenerationError("This request ID belongs to different image inputs.", 409, "request_mismatch");
    if (existing.status === "completed") {
      let result: ImageGenerationResult;
      try { result = validateImageResult(existing.result); } catch { return unavailable(); }
      return { data: withLedger(data, ledger), result: { status: "replay", requestId: request.requestId, result } };
    }
    throw new ImageGenerationError("This image is in progress or awaiting reconciliation.", 409, "request_in_progress");
  }
  if (effectiveGenerationPlan(data, now) !== "pro_studio") throw new ImageGenerationError("Image generation is available on active Pro Studio plans.", 403, "image_plan_required");
  if (Object.keys(ledger.tombstones).length + ledger.entries.length >= IMAGE_RETENTION.terminalIdentities) {
    throw new ImageGenerationError("Image request storage needs maintenance. No new image was admitted.", 503, "image_identity_capacity");
  }
  const pending = ledger.entries.filter(entry => entry.status === "reserved");
  if (pending.some(entry => entry.fingerprint === fingerprint)) throw new ImageGenerationError("An identical image is already in progress.", 409, "duplicate_in_progress");
  if (pending.length >= IMAGE_RETENTION.concurrentRequests) {
    const wait = Math.min(...pending.map(entry => Date.parse(entry.createdAt))) + IMAGE_RETENTION.reservationMs - now.getTime();
    throw new ImageGenerationError("Too many images are in progress. Wait for an existing attempt to finish.", 429, "image_concurrency_limit", Math.max(1, Math.ceil(wait / 1000)));
  }
  const { periodStart, periodEnd } = currentUsageWindow(now, hasLifetimeEntitlement(data) ? null : data.subscription_current_period_end);
  const used = usedInWindow(data, userId, periodStart, periodEnd);
  const reservedInWindow = pending.filter(entry => Date.parse(entry.createdAt) >= Date.parse(periodStart) && Date.parse(entry.createdAt) < Date.parse(periodEnd)).length;
  if (used + reservedInWindow >= IMAGE_LIMITS.monthlyCredits) throw new ImageGenerationError("You have used this month's Pro Studio image credits.", 429, "image_quota_exceeded");
  ledger.entries.push({
    requestId: request.requestId, fingerprint, status: "reserved", createdAt: now.toISOString(),
    periodStart, periodEnd, style: request.style, format: request.format
  });
  return {
    data: {
      ...withLedger(data, ledger), image_generation_usage_json: boundedCounters({ ...readCounters(data), [periodStart]: used }, ledger.entries),
      image_generation_attempts_json: consumeAttempt(data, now)
    },
    result: { status: "reserved", requestId: request.requestId, fingerprint }
  };
}

export function completeImageInProfile(data: Document, userId: string, requestId: string, fingerprint: string, result: ImageGenerationResult, now = new Date()): { data: Document; result: ImageGenerationResult } {
  account(data, userId);
  const id = validateImageRequestId(requestId);
  const ledger = compact(readLedger(data), now);
  rejectTerminal(ledger.tombstones[hash(id)], fingerprint);
  const entry = ledger.entries.find(item => item.requestId === id);
  if (!entry || entry.fingerprint !== fingerprint) throw new ImageGenerationError("Image reservation does not match.", 409, "reservation_mismatch");
  if (entry.status === "completed") return { data: withLedger(data, ledger), result: validateImageResult(entry.result) };
  const clean = validateImageResult(result);
  if (clean.style !== entry.style || clean.format !== entry.format) throw new ImageGenerationError("Image result does not match the reserved format.", 502, "invalid_image_result");
  const used = usedInWindow(data, userId, entry.periodStart, entry.periodEnd);
  const completed: Reservation = { ...entry, status: "completed", completedAt: now.toISOString(), result: clean };
  const retained = compact({ ...ledger, entries: [completed, ...ledger.entries.filter(item => item !== entry)] }, now);
  const events = usageEvents(data);
  const event = {
    id: `image:${id}`, user_id: userId, event_type: "image_generation", created_at: entry.createdAt,
    metadata: { requestId: id, format: clean.format, style: clean.style, background: "openai_textless" }
  };
  return {
    data: {
      ...withLedger(data, retained),
      image_generation_usage_json: boundedCounters({ ...readCounters(data), [entry.periodStart]: used + (clean.creditCharged ? 1 : 0) }, retained.entries),
      // Replay bodies live only in the bounded ledger, never in history or usage events.
      ...(clean.creditCharged ? { usage_events_json: [event, ...events].slice(0, 500) } : {})
    }, result: clean
  };
}

export function failImageInProfile(data: Document, userId: string, requestId: string, fingerprint: string, now = new Date()): { data: Document; result: void } {
  account(data, userId);
  const id = validateImageRequestId(requestId), ledger = compact(readLedger(data), now);
  const terminal = ledger.tombstones[hash(id)];
  if (terminal) {
    if (terminal.fingerprint !== fingerprint) throw new ImageGenerationError("Image reservation does not match.", 409, "reservation_mismatch");
    return { data: withLedger(data, ledger), result: undefined };
  }
  const entry = ledger.entries.find(item => item.requestId === id);
  if (!entry || entry.fingerprint !== fingerprint) throw new ImageGenerationError("Image reservation does not match.", 409, "reservation_mismatch");
  if (entry.status === "completed") return { data: withLedger(data, ledger), result: undefined };
  ledger.entries = ledger.entries.filter(item => item !== entry);
  ledger.tombstones[hash(id)] = { fingerprint, status: "failed" };
  // Admission only held capacity; failure releases that hold, not a monetary refund.
  return { data: withLedger(data, ledger), result: undefined };
}
