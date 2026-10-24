import { parseProductionGeneration } from "@/lib/production-generation";
import { contentTypes, ctaModes, defaultSelectedTypes, presetTopics, sharpnessModes, tones } from "@/lib/content-config";
import { cleanPlainText } from "@/lib/text-normalize";
import { hasUnsupportedBusinessFacts } from "@/lib/business-facts";
import { applyContentQuality } from "@/lib/content-quality";
import type { ContentTypeId, GenerateRequest, GeneratedSection, GenerationResult } from "@/types/content";

export const REFINEMENT_ACTIONS = {
  custom: "Apply only the requested change. Preserve unrelated content, facts and qualifications. Never treat a request for stronger copy as evidence for new business claims.",
  shorten: "Remove redundancy and secondary explanation while preserving the core point, factual qualifications, and required asset counts.",
  expand: "Add useful explanation using only source-supported detail. Do not invent examples, proof, results, or credentials.",
  simplify: "Use plain language and shorter sentences. Explain necessary jargon without losing precision or qualifications.",
  professional: "Use a measured, clear professional tone for this replacement, overriding the selected tone. Avoid corporate jargon or inflated claims.",
  conversational: "Use natural, approachable conversational language for this replacement, overriding the selected tone. Do not invent personal anecdotes or familiarity.",
  hook: "Improve the opening with a specific source-grounded tension or useful contrast. Keep the rest of the message and its meaning stable; no clickbait.",
  cta: "Improve the call to action for the selected CTA mode and audience intent. Preserve the main copy. If CTA mode is none, remove calls to action rather than adding one. Never invent links, offers, or scarcity.",
  alternative: "Write a genuinely different angle or structure for the same format and facts. Preserve the original purpose and qualifications; do not merely swap synonyms.",
  sharpen: "Strengthen the opening, verbs, and specificity without exaggerating the source claims or changing their meaning.",
  "change-tone": "Apply the selected tone while preserving the original facts, qualifications, and purpose."
} as const;

export type GenerationInput = GenerateRequest & {
  requestId?: string;
  length?: "short" | "standard" | "detailed";
  refinement?: {
    action: keyof typeof REFINEMENT_ACTIONS;
    instructions?: string;
    section: GeneratedSection;
  };
};

export const GENERATION_LIMITS = {
  requestBytes: 96_000,
  requestReadMs: 10_000,
  outputCharacters: 100_000,
  resultBytes: 128_000,
  timeoutMs: 90_000,
  maxRetries: 0,
  maxOutputTokens: 24_000
} as const;

export class GenerationValidationError extends Error {}
export class GenerationOutputError extends Error {}
export class GenerationGroundingError extends GenerationOutputError {}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const typeIds = new Set<string>(contentTypes.map(({ id }) => id));
function isType(value: unknown): value is ContentTypeId {
  return typeof value === "string" && typeIds.has(value);
}

function inputText(value: unknown, name: string, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new GenerationValidationError(`${name} must be text.`);
  if (value.length > max) throw new GenerationValidationError(`${name} must be at most ${max} characters.`);
  if (/data:[^\s,]*[;,]/i.test(value)) throw new GenerationValidationError("Inline media is not supported in generation text.");
  return value.trim();
}

function choice<T extends string>(value: unknown, values: readonly T[], fallback: T, name: string): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new GenerationValidationError(`Invalid ${name}.`);
  }
  return value as T;
}

export function normalizeGenerationRequest(body: unknown): GenerationInput {
  if (!record(body)) throw new GenerationValidationError("Invalid request.");
  const source = inputText(body.source, "Source", 8000, true);
  if (source.length < 8 || !/[\p{L}\p{N}]/u.test(source)) {
    throw new GenerationValidationError("Add a little more source material before generating.");
  }
  const selected = body.selectedTypes === undefined ? defaultSelectedTypes : body.selectedTypes;
  if (!Array.isArray(selected) || selected.length === 0 || selected.length > contentTypes.length ||
      !selected.every(isType) || new Set(selected).size !== selected.length) {
    throw new GenerationValidationError("Choose one or more distinct supported content formats.");
  }
  const result: GenerationInput = {
    source,
    brandName: inputText(body.brandName, "Brand name", 180),
    audience: inputText(body.audience, "Audience", 240),
    offer: inputText(body.offer, "Offer", 240),
    writingStyle: inputText(body.writingStyle, "Writing style", 320),
    contentGoal: inputText(body.contentGoal, "Content goal", 180),
    tone: choice(body.tone, tones.map(({ id }) => id), "professional", "tone"),
    sharpness: choice(body.sharpness, sharpnessModes.map(({ id }) => id), "balanced", "sharpness"),
    ctaMode: choice(body.ctaMode, ctaModes.map(({ id }) => id), "soft", "CTA mode"),
    presetTopic: choice(body.presetTopic, presetTopics.map(({ id }) => id), "none", "category"),
    selectedTypes: [...selected],
    length: choice(body.length, ["short", "standard", "detailed"] as const, "standard", "length")
  };
  if (body.requestId !== undefined) {
    const id = inputText(body.requestId, "Request ID", 36, true);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new GenerationValidationError("Request ID must be a UUID.");
    }
    result.requestId = id;
  }
  if (body.automaticSettings !== undefined) {
    const allowed = ["tone", "sharpness", "ctaMode", "presetTopic", "length"] as const;
    if (!Array.isArray(body.automaticSettings) || body.automaticSettings.length > allowed.length ||
        new Set(body.automaticSettings).size !== body.automaticSettings.length ||
        !body.automaticSettings.every(v => allowed.includes(v))) throw new GenerationValidationError("Invalid automatic settings.");
    result.automaticSettings = [...body.automaticSettings];
  }
  if (body.refinement !== undefined) {
    if (!record(body.refinement) || body.refinement.action === undefined) {
      throw new GenerationValidationError("Invalid refinement.");
    }
    const action = choice(body.refinement.action, Object.keys(REFINEMENT_ACTIONS) as Array<keyof typeof REFINEMENT_ACTIONS>, "sharpen", "refinement action");
    let section: GeneratedSection;
    try {
      section = validateSection(body.refinement.section);
    } catch {
      throw new GenerationValidationError("Refinement needs a complete, valid original section.");
    }
    if (selected.length !== 1 || selected[0] !== section.type) {
      throw new GenerationValidationError("Refine exactly one matching content format.");
    }
    result.refinement = { action, section };
    if (action === "custom") {
      const instructions = inputText(body.refinement.instructions, "Requested change", 400, true);
      if (!instructions) throw new GenerationValidationError("Describe the change you want.");
      result.refinement.instructions = instructions;
    }
  }
  return result;
}

// Count actual streamed bytes, including requests without Content-Length.
export async function readGenerationRequest(request: Request): Promise<GenerationInput> {
  const declaredSize = request.headers.get("content-length");
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > GENERATION_LIMITS.requestBytes)) {
    throw new GenerationValidationError("Request body is too large.");
  }
  if (!request.body) throw new GenerationValidationError("Invalid request.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new GenerationValidationError("Request body timed out."));
      void reader.cancel().catch(() => {});
    }, GENERATION_LIMITS.requestReadMs);
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > GENERATION_LIMITS.requestBytes) throw new GenerationValidationError("Request body is too large.");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return normalizeGenerationRequest(JSON.parse(text));
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof GenerationValidationError) throw error;
    throw new GenerationValidationError("Request must contain valid JSON.");
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

function outputText(value: unknown, name: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || /data:[^\s,]*[;,]/i.test(value)) throw new GenerationOutputError(`Invalid ${name}.`);
  let cleaned: string;
  try {
    cleaned = cleanPlainText(value).replace(/[\u2014\u2013]/g, ", ").replace(/--+/g, ", ").trim();
  } catch {
    throw new GenerationOutputError(`Invalid ${name}.`);
  }
  if (cleaned.length > max || /data:[^\s,]*[;,]/i.test(cleaned)) throw new GenerationOutputError(`Invalid ${name}.`);
  if (!allowEmpty && !/[\p{L}\p{N}]/u.test(cleaned)) throw new GenerationOutputError(`Empty ${name}.`);
  return cleaned;
}

function validateSection(value: unknown): GeneratedSection {
  if (!record(value) || !isType(value.type)) throw new GenerationOutputError("Invalid section type.");
  if (!Array.isArray(value.items) || value.items.length > 30) throw new GenerationOutputError("Invalid section items.");
  const section: GeneratedSection = {
    id: outputText(value.id, "section id", 100),
    type: value.type,
    title: outputText(value.title, "section title", 240),
    platform: outputText(value.platform, "section platform", 80),
    body: outputText(value.body, "section body", 24_000, true),
    items: value.items.map((item) => outputText(item, "section item", 6000)),
    cta: outputText(value.cta ?? "", "section CTA", 1000, true)
  };
  if (!/[\p{L}\p{N}]/u.test(section.body) && section.items.length === 0) {
    throw new GenerationOutputError("Empty section.");
  }
  return section;
}


export { productionOutputSchema } from "@/lib/production-generation";
export function parseGenerationOutput(text: string, request: GenerationInput): GenerationResult {
  if (typeof text !== "string" || text.length > GENERATION_LIMITS.outputCharacters) throw new GenerationOutputError("Invalid output size.");
  try {
    // Inspect before caption fallbacks or CTA removal can hide a rejected assertion.
    if (hasUnsupportedBusinessFacts(JSON.parse(text), request)) throw new GenerationGroundingError("Unsupported business details were detected. Your existing draft is unchanged.");
    const result = applyContentQuality(parseProductionGeneration(text, request), request);
    if (result.sections.length !== request.selectedTypes.length ||
        new Set(result.sections.map(s => s.type)).size !== request.selectedTypes.length ||
        new Set(result.sections.map(s => s.id)).size !== result.sections.length ||
        result.sections.some(s => !request.selectedTypes.includes(s.type))) {
      throw new Error("Missing or duplicate requested formats.");
    }
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > GENERATION_LIMITS.resultBytes) throw new Error("Output too large.");
    if (hasUnsupportedBusinessFacts(result, request)) throw new GenerationGroundingError("Unsupported business details were detected. Your existing draft is unchanged.");
    return result;
  } catch (error) {
    if (error instanceof GenerationGroundingError) throw error;
    throw new GenerationOutputError("The AI response is incomplete or cannot be saved. Your draft is unchanged.");
  }
}
