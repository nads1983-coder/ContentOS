// Shared wire contract. No server-only imports or unchecked generated text.
export type GenerationProgress = {
  status: "pending" | "failed";
  requestId: string;
  stage: "draft" | "review" | "correction" | "revalidation" | "save";
  nextStage: string;
  running: boolean;
  reviewedUnits: number;
  totalUnits: number;
  error?: string;
  code?: string;
  diagnostic?: string;
};

export function generationProgressMessage(progress: GenerationProgress) {
  if (progress.status === "failed") return progress.error ?? "Validation stopped. Your existing draft is unchanged.";
  switch (progress.stage) {
    case "draft": return "Writing your content. Your existing draft is unchanged.";
    case "review": return `Checking facts: ${progress.reviewedUnits} of ${progress.totalUnits} units reviewed.`;
    case "correction": return "Correcting unsupported claims before a fresh factual check.";
    case "revalidation": return `Rechecking corrected content: ${progress.reviewedUnits} of ${progress.totalUnits} units reviewed.`;
    case "save": return "Validation complete. Saving your content.";
  }
}
