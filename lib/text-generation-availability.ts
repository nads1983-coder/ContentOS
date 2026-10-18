import "server-only";

// Deploy with "paused" at both build and runtime for the restricted release.
// Unknown values fail closed; absence preserves existing full-mode behavior.
export function isTextGenerationEnabled(): boolean {
  const mode = process.env.CONTENTOS_TEXT_GENERATION_MODE;
  return mode === undefined || mode === "enabled";
}

export const TEXT_GENERATION_PAUSED_MESSAGE =
  "AI text generation is temporarily unavailable. Existing content and saved drafts remain available; no text-generation usage will be charged.";
