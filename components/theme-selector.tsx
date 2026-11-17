"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { normalizeThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const THEME_EVENT = "contentos-theme-change";

function getPreference() {
  return normalizeThemePreference(document.documentElement.dataset.themePreference);
}

function getServerPreference(): ThemePreference | null {
  return null;
}

function subscribe(listener: () => void) {
  window.addEventListener(THEME_EVENT, listener);
  return () => window.removeEventListener(THEME_EVENT, listener);
}

function applyPreference(preference: ThemePreference) {
  const theme = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#050509" : "#faf8fc");
  window.dispatchEvent(new Event(THEME_EVENT));
}

// One listener per document, shared by every selector, including dialogs/menus.
export function ThemeRuntime() {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getPreference() === "system") applyPreference("system");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === THEME_STORAGE_KEY || event.key === null)) {
        applyPreference(normalizeThemePreference(event.newValue));
      }
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    // Another tab can change storage between parsing the head and hydration.
    // Re-read after subscribing, also restoring attributes on a dev remount.
    let preference = getPreference();
    try { preference = normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* Storage is optional. */ }
    applyPreference(preference);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

export function ThemeSelector() {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  return (
    <label className="inline-flex shrink-0 items-center gap-2 text-xs text-muted">
      <span className="sr-only xl:not-sr-only">Theme</span>
      <select
        aria-label="Colour theme"
        value={preference ?? "system"}
        disabled={preference === null}
        onChange={event => {
          const next = normalizeThemePreference(event.target.value);
          try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Retain it for this visit. */ }
          applyPreference(next);
        }}
        className="min-h-11 w-24 rounded border border-divider/20 bg-ink px-2 text-sm text-bone hover:border-violet focus-visible:outline-offset-2"
      >
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
