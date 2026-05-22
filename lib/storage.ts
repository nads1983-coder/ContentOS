"use client";

import { Draft, GenerationResult, StudioStore } from "@/types/content";

const STORAGE_KEY = "social-content-os:v1";
const emptyStore: StudioStore = {
  version: 1,
  recent: [],
  saved: [],
  drafts: []
};

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
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : []
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
        recent: store.recent.slice(0, 20),
        saved: store.saved.slice(0, 50),
        drafts: store.drafts.slice(0, 20)
      })
    );
  } catch {
    // Some embedded or private browsing contexts disable localStorage.
  }
}

export function addRecent(store: StudioStore, result: GenerationResult): StudioStore {
  return {
    ...store,
    recent: [result, ...store.recent.filter((item) => item.id !== result.id)].slice(0, 20)
  };
}

export function toggleSaved(store: StudioStore, result: GenerationResult): StudioStore {
  const exists = store.saved.some((item) => item.id === result.id);

  return {
    ...store,
    saved: exists
      ? store.saved.filter((item) => item.id !== result.id)
      : [result, ...store.saved].slice(0, 50)
  };
}

export function removeSaved(store: StudioStore, id: string): StudioStore {
  return {
    ...store,
    saved: store.saved.filter((item) => item.id !== id)
  };
}

export function upsertDraft(store: StudioStore, draft: Draft): StudioStore {
  return {
    ...store,
    drafts: [draft, ...store.drafts.filter((item) => item.id !== draft.id)].slice(0, 20)
  };
}
