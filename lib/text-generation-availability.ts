import "server-only";

// Deploy with "paused" at both build and runtime for the restricted release.
// Unknown values fail closed; absence preserves existing full-mode behavior.
export function isTextGenerationEnabled(accountId?: string): boolean {
  const mode = process.env.CONTENTOS_TEXT_GENERATION_MODE;
  if (mode === "pilot") {
    const accounts = (process.env.CONTENTOS_TEXT_GENERATION_PILOT_ACCOUNTS ?? "").split(",").map(id => id.trim()).filter(Boolean);
    return !!accountId && accounts.includes(accountId);
  }
  return mode === undefined || mode === "enabled";
}

export const TEXT_GENERATION_PAUSED_MESSAGE =
  "AI text generation is temporarily unavailable. Existing content and saved drafts remain available; no text-generation usage will be charged.";
