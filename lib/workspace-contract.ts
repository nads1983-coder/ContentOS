import type { Draft, GenerateRequest, GenerationResult, StudioStore } from "@/types/content";
import type { BrandProfile } from "@/types/saas";
import { contentTypes, tones, sharpnessModes, ctaModes, presetTopics } from "@/lib/content-config";

export type WorkspacePreferences = Required<Pick<GenerateRequest, "brandName" | "audience" | "offer" | "writingStyle" | "contentGoal">> &
  Partial<Pick<GenerateRequest, "tone" | "sharpness" | "ctaMode" | "presetTopic" | "selectedTypes" | "automaticSettings">> & { brandProfileId?: string; brandColors?: string; visualStyle?: string; length?: "short" | "standard" | "detailed" };
export type WorkspaceSnapshot = {
  revision: number;
  store: StudioStore;
  preferences: WorkspacePreferences;
  brandProfiles: BrandProfile[];
  unavailableHistoryCount?: number;
};
export type WorkspaceWriteInput = Pick<WorkspaceSnapshot, "revision" | "store" | "preferences">;
export const MAX_WORKSPACE_BYTES = 1_000_000;

export class WorkspaceError extends Error {
  status: number;
  code: string;
  revision?: number;
  constructor(message: string, status = 400, code = "invalid_workspace", revision?: number) {
    super(message);
    this.name = "WorkspaceError";
    this.status = status;
    this.code = code;
    this.revision = revision;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("Invalid workspace object.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 16000): string {
  if (typeof value !== "string" || value.length > max || /data:[^\s,]*[;,]/i.test(value)) {
    throw new WorkspaceError("Workspace text is invalid or too large. Inline media is not supported.");
  }
  return value;
}
function timestamp(value: unknown): string {
  const result = text(value, 80);
  if (!Number.isFinite(Date.parse(result))) throw new WorkspaceError("Invalid workspace timestamp.");
  return result;
}
function choice<T extends string>(value: unknown, options: readonly { id: T }[]): T {
  if (!options.some(option => option.id === value)) throw new WorkspaceError("Invalid workspace option.");
  return value as T;
}
function list<T>(value: unknown, limit: number, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > limit) throw new WorkspaceError("Invalid workspace list.");
  return value.map(parse);
}
function creativePreferences(value: Record<string, unknown>) {
  const result: Pick<WorkspacePreferences, "automaticSettings" | "length"> = {};
  if (value.length !== undefined) result.length = choice(value.length, [{ id: "short" }, { id: "standard" }, { id: "detailed" }] as const);
  if (value.automaticSettings !== undefined) {
    result.automaticSettings = list(value.automaticSettings, 5, item => choice(item, ["tone", "sharpness", "ctaMode", "presetTopic", "length"].map(id => ({ id })))) as GenerateRequest["automaticSettings"];
    if (new Set(result.automaticSettings).size !== result.automaticSettings!.length) throw new WorkspaceError("Duplicate automatic settings.");
  }
  return result;
}
function settings(value: Record<string, unknown>) {
  return {
    tone: choice(value.tone, tones),
    selectedTypes: list(value.selectedTypes, contentTypes.length, item => choice(item, contentTypes)),
    ...(value.sharpness !== undefined ? { sharpness: choice(value.sharpness, sharpnessModes) } : {}),
    ...(value.ctaMode !== undefined ? { ctaMode: choice(value.ctaMode, ctaModes) } : {}),
    ...(value.presetTopic !== undefined ? { presetTopic: choice(value.presetTopic, presetTopics) } : {})
  };
}
export function parseWorkspaceGeneration(value: unknown): GenerationResult {
  const v = object(value);
  return {
    id: text(v.id, 160), createdAt: timestamp(v.createdAt), source: text(v.source),
    title: text(v.title, 1000), summary: text(v.summary), ...settings(v),
    sections: list(v.sections, 100, item => {
      const section = object(item);
      return {
        id: text(section.id, 160), type: choice(section.type, contentTypes),
        title: text(section.title, 1000), platform: text(section.platform, 160), body: text(section.body, 32000),
        items: list(section.items, 100, entry => text(entry)),
        ...(section.cta !== undefined ? { cta: text(section.cta) } : {}),
        ...(section.revisionSource === "manual" || section.revisionSource === "refined" ? { revisionSource: section.revisionSource } : {})
      };
    })
  };
}
function draft(value: unknown): Draft {
  const v = object(value);
  const brand = Object.fromEntries((["brandName", "audience", "offer", "writingStyle", "contentGoal"] as const)
    .filter(key => v[key] !== undefined).map(key => [key, text(v[key], key === "writingStyle" ? 320 : key === "brandName" || key === "contentGoal" ? 180 : 240)]));
  return { id: text(v.id, 160), updatedAt: timestamp(v.updatedAt), title: text(v.title, 1000), source: text(v.source), ...settings(v), ...brand, ...creativePreferences(v) };
}
export function parseWorkspaceWrite(value: unknown): WorkspaceWriteInput {
  const v = object(value);
  if (Object.keys(v).some(key => !["revision", "store", "preferences"].includes(key))) throw new WorkspaceError("Unexpected workspace fields.");
  if (!Number.isSafeInteger(v.revision) || (v.revision as number) < 0 || (v.revision as number) >= Number.MAX_SAFE_INTEGER) throw new WorkspaceError("Invalid workspace revision.");
  const store = object(v.store), p = object(v.preferences);
  if (store.version !== 1) throw new WorkspaceError("Unsupported studio state version.");
  const preferences: WorkspacePreferences = {
    brandName: text(p.brandName, 180), audience: text(p.audience, 240), offer: text(p.offer, 240),
    writingStyle: text(p.writingStyle, 320), contentGoal: text(p.contentGoal, 180)
  };
  if (p.brandProfileId !== undefined) preferences.brandProfileId = text(p.brandProfileId, 160);
  if (p.brandColors !== undefined) preferences.brandColors = text(p.brandColors, 180);
  if (p.visualStyle !== undefined) preferences.visualStyle = text(p.visualStyle, 180);
  Object.assign(preferences, creativePreferences(p));
  if (p.tone !== undefined) preferences.tone = choice(p.tone, tones);
  if (p.sharpness !== undefined) preferences.sharpness = choice(p.sharpness, sharpnessModes);
  if (p.ctaMode !== undefined) preferences.ctaMode = choice(p.ctaMode, ctaModes);
  if (p.presetTopic !== undefined) preferences.presetTopic = choice(p.presetTopic, presetTopics);
  if (p.selectedTypes !== undefined) preferences.selectedTypes = list(p.selectedTypes, contentTypes.length, item => choice(item, contentTypes));
  // Explicit projection intentionally excludes image/base64 fields and arbitrary profile data.
  const result: WorkspaceWriteInput = {
    revision: v.revision as number, preferences,
    store: { version: 1, recent: list(store.recent, 100, parseWorkspaceGeneration), saved: list(store.saved, 50, parseWorkspaceGeneration), drafts: list(store.drafts, 20, draft) }
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_WORKSPACE_BYTES) throw new WorkspaceError("Workspace is too large.", 413);
  return result;
}

export function profileArray<T>(value: unknown): T[] {
  if (value === undefined || value === null || value === "") return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null) return [];
  if (!Array.isArray(parsed)) throw new Error("Stored account data is malformed.");
  return parsed as T[];
}
export function assertWorkspaceAccount(data: Record<string, unknown>, userId: string) {
  if (!userId || data.id !== userId) throw new WorkspaceError("Account profile is unavailable.", 403, "account_mismatch");
}
export function workspaceFromProfile(data: Record<string, unknown>, userId: string): WorkspaceSnapshot {
  assertWorkspaceAccount(data, userId);
  const brands = profileArray<BrandProfile>(data.brand_profiles_json).filter(p => !p.user_id || p.user_id === userId);
  const onboarding = data.onboarding_json ? object(typeof data.onboarding_json === "string" ? JSON.parse(data.onboarding_json) : data.onboarding_json) : {};
  const initial: WorkspaceWriteInput = {
    revision: 0, store: { version: 1, recent: [], saved: [], drafts: [] },
    preferences: { brandName: typeof onboarding.businessName === "string" ? onboarding.businessName.slice(0, 180) : "", audience: typeof onboarding.audience === "string" ? onboarding.audience.slice(0, 240) : "", offer: "", writingStyle: typeof onboarding.niche === "string" ? onboarding.niche.slice(0, 320) : "", contentGoal: typeof onboarding.goals === "string" ? onboarding.goals.slice(0, 180) : "", ...(tones.some(t => t.id === onboarding.writingTone) ? { tone: onboarding.writingTone as GenerateRequest["tone"] } : {}) }
  };
  const stored = data.studio_state_json;
  let state: WorkspaceWriteInput;
  const history: GenerationResult[] = [];
  let unavailableHistoryCount = 0;
  try {
    state = stored == null ? initial : parseWorkspaceWrite(typeof stored === "string" ? JSON.parse(stored) : stored);
    for (const entry of profileArray<unknown>(data.generation_history_json)) {
      try {
        const item = object(entry);
        if (item.user_id && item.user_id !== userId) continue;
        history.push(parseWorkspaceGeneration(item.payload));
      } catch {
        // Reading omits unrenderable legacy records, but never rewrites the original history.
        unavailableHistoryCount++;
      }
    }
  } catch {
    // A malformed overall container or saved studio state still needs explicit repair.
    throw new Error("Stored workspace content is malformed; repair is required.");
  }
  // Server history survives a stale browser's smaller recent list; explicit edits win by ID.
  const seen = new Set<string>();
  const recent = [...state.store.recent, ...history].filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100);
  return { ...state, store: { ...state.store, recent }, brandProfiles: brands, ...(unavailableHistoryCount ? { unavailableHistoryCount } : {}) };
}
export function updateWorkspaceProfile<T extends Record<string, unknown>>(data: T, userId: string, input: unknown) {
  const current = workspaceFromProfile(data, userId);
  const next = parseWorkspaceWrite(input);
  if (next.revision !== current.revision) throw new WorkspaceError("Workspace changed. Reload before saving.", 409, "stale_revision", current.revision);
  if (next.preferences.brandProfileId && !current.brandProfiles.some(p => p.id === next.preferences.brandProfileId)) throw new WorkspaceError("Unknown brand profile.");
  const updated = { ...data, studio_state_json: { ...next, revision: current.revision + 1 } };
  return { data: updated, result: workspaceFromProfile(updated, userId) };
}
