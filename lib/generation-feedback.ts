export type GenerationFailure = {
  accountId: string | undefined;
  source: string;
  refinement: boolean;
  requestedChange?: string;
  message: string;
  uncertain: boolean;
  canStartNew: boolean;
};

// Only terminal failures permit a fresh request ID. Unknown delivery/save
// outcomes retain the original ID for the existing replay/recovery protocol.
export function generationFailure(source: string, refinement: boolean, message: string, code?: string) {
  const canStartNew = ["unsupported_business_facts", "generation_failed", "invalid_generation", "generation_timeout", "request_failed", "request_expired"].includes(code ?? "");
  const uncertain = !code || ["generation_save_uncertain", "request_in_progress"].includes(code);
  return { source, refinement, message, uncertain, canStartNew };
}
