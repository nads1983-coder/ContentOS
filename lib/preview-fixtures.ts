import type { GenerationInput } from "@/lib/generation-contract";

// Opt-in transport fixtures, never an authentication or billing bypass.
export function previewFixturesEnabled() {
  if (process.env.CONTENTOS_PREVIEW_FIXTURES !== "1") return false;
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.CONTENTOS_ISOLATED_BRANCH !== "br-divine-term-b2rihbxv" ||
      !["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech", "ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(url.hostname) ||
      url.pathname !== "/contentos" ||
      ["OPENAI_API_KEY", "STRIPE_SECRET_KEY", "RESEND_API_KEY"].some(key => Boolean(process.env[key]))) {
    throw new Error("Preview isolation is not configured safely.");
  }
  return true;
}
export function isPreviewAccount(email: string) {
  return /^premium-preview-[a-z0-9-]+@example\.invalid$/.test(email);
}
export function previewTextResponse(input: GenerationInput) {
  if (!previewFixturesEnabled()) throw new Error("Preview fixtures are disabled.");
  return {
    status: "completed",
    output_text: JSON.stringify({
      title: "Preview content pack",
      summary: "Synthetic transport fixture. This is not a live AI result.",
      sections: input.selectedTypes.map(type => ({
        id: "preview-" + type, type, title: type, platform: type,
        body: input.refinement ? "Revised preview draft. " + input.source : input.source,
        items: ["hooks", "carousel", "xThread", "repurposePack", "platformHashtags"].includes(type)
          ? ["Preview variation one: " + input.source.slice(0, 140), "Preview variation two: " + input.source.slice(0, 140)] : [],
        cta: ""
      }))
    }),
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  };
}
