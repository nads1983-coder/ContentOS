export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "contentos-theme";

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Runs in the head before the first paint. Keep this independent of React and
// tolerate storage being unavailable (for example, in a private browser).
export const themeInitScript = `(() => {
  let preference = "system";
  try { preference = localStorage.getItem("${THEME_STORAGE_KEY}"); } catch {}
  preference = preference === "light" || preference === "dark" ? preference : "system";
  const theme = preference === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#050509" : "#faf8fc");
})();`;
