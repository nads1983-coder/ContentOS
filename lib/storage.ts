"use client";

import type { Draft, GenerationResult, StudioStore } from "@/types/content";
import { cleanPlainText } from "@/lib/text-normalize";

const STORAGE_KEY = "social-content-os:v1";
const emptyStore: StudioStore = {
  version: 1,
  recent: [],
  saved: [],
  drafts: []
};

function cleanString(value: unknown) {
  return typeof value === "string" ? cleanPlainText(value) : "";
}

type NormalizableGenerationResult = GenerationResult & {
  created_at?: unknown;
  generatedAt?: unknown;
  timestamp?: unknown;
};

function cleanTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function timestampFromResult(result: NormalizableGenerationResult) {
  return cleanTimestamp(result.createdAt)
    || cleanTimestamp(result.created_at)
    || cleanTimestamp(result.generatedAt)
    || cleanTimestamp(result.timestamp);
}

function cleanGenerationResult(result: NormalizableGenerationResult): GenerationResult {
  return {
    ...result,
    createdAt: timestampFromResult(result),
    source: cleanString(result.source),
    title: cleanString(result.title),
    summary: cleanString(result.summary),
    sections: result.sections.map((section) => ({
      ...section,
      title: cleanString(section.title),
      platform: cleanString(section.platform),
      body: cleanString(section.body),
      items: section.items.map(cleanString).filter(Boolean),
      cta: cleanString(section.cta)
    }))
  };
}

function cleanDraft(draft: Draft): Draft {
  return {
    ...draft,
    updatedAt: cleanTimestamp(draft.updatedAt),
    title: cleanString(draft.title),
    source: cleanString(draft.source)
  };
}

export function readStore(): StudioStore {
  if (typeof window === "undefined") {
    return emptyStore;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyStore;
    }

    const parsed = JSON.parse(raw) as Partial<StudioStore>;
    if (parsed.version !== 1) {
      return emptyStore;
    }

    return {
      version: 1,
      recent: Array.isArray(parsed.recent) ? parsed.recent.map(cleanGenerationResult) : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved.map(cleanGenerationResult) : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts.map(cleanDraft) : []
    };
  } catch {
    return emptyStore;
  }
}

export function writeStore(store: StudioStore) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...store,
        recent: store.recent.map(cleanGenerationResult).slice(0, 20),
        saved: store.saved.map(cleanGenerationResult).slice(0, 50),
        drafts: store.drafts.map(cleanDraft).slice(0, 20)
      })
    );
  } catch {
    // Some embedded or private browsing contexts disable localStorage.
  }
}

export function addRecent(store: StudioStore, result: GenerationResult): StudioStore {
  const cleanedResult = {
    ...cleanGenerationResult(result),
    createdAt: timestampFromResult(result) || new Date().toISOString()
  };

  return {
    ...store,
    recent: [cleanedResult, ...store.recent.filter((item) => item.id !== result.id)].slice(0, 20)
  };
}

export function toggleSaved(store: StudioStore, result: GenerationResult): StudioStore {
  const exists = store.saved.some((item) => item.id === result.id);
  const cleanedResult = {
    ...cleanGenerationResult(result),
    createdAt: timestampFromResult(result) || new Date().toISOString()
  };

  return {
    ...store,
    saved: exists
      ? store.saved.filter((item) => item.id !== result.id)
      : [cleanedResult, ...store.saved].slice(0, 50)
  };
}

export function removeSaved(store: StudioStore, id: string): StudioStore {
  return {
    ...store,
    saved: store.saved.filter((item) => item.id !== id)
  };
}

export function upsertDraft(store: StudioStore, draft: Draft): StudioStore {
  const cleanedDraft = cleanDraft(draft);

  return {
    ...store,
    drafts: [cleanedDraft, ...store.drafts.filter((item) => item.id !== draft.id)].slice(0, 20)
  };
}

export function monthlyStoredGenerationCount(store: StudioStore, now = new Date()) {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();

  return store.recent.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return createdAt.getUTCFullYear() === year && createdAt.getUTCMonth() === month;
  }).length;
}

export { cleanGenerationResult, cleanDraft };
