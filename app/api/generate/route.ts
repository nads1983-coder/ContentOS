import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { contentTypes, defaultSelectedTypes } from "@/lib/content-config";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { captureServerError } from "@/lib/monitoring";
import { buildInput, buildInstructions, requestedTypeSet } from "@/lib/prompts";
import { recordGeneration, recordUsageEvent } from "@/lib/supabase-rest";
import { normalizePlainText } from "@/lib/text-normalize";
import {
  CtaModeId,
  ContentTypeId,
  GenerateRequest,
  GeneratedSection,
  GenerationResult,
  PresetTopicId,
  SharpnessId,
  ToneId
} from "@/types/content";

export const runtime = "nodejs";

const contentTypeIds = new Set(contentTypes.map((type) => type.id));
const toneIds = new Set<ToneId>([
  "professional",
  "bold",
  "friendly",
  "inspirational",
  "direct",
  "story-led",
  "sales-focused",
  "educational",
  "premium",
  "conversational"
]);
const sharpnessIds = new Set<SharpnessId>([
  "soft",
  "balanced",
  "direct",
  "very-direct"
]);
const ctaModeIds = new Set<CtaModeId>(["none", "soft", "website", "product"]);
const presetTopicIds = new Set<PresetTopicId>([
  "none",
  "business",
  "personal-brand",
  "motivation",
  "education",
  "sales",
  "product-promotion",
  "storytelling",
  "thought-leadership",
  "community-building",
  "announcements"
]);

function isContentTypeId(value: unknown): value is ContentTypeId {
  return typeof value === "string" && contentTypeIds.has(value as ContentTypeId);
}

function normalizeRequest(body: unknown): GenerateRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request.");
  }

  const candidate = body as Partial<GenerateRequest>;
  const source = typeof candidate.source === "string" ? candidate.source.trim() : "";
  const brandName = typeof candidate.brandName === "string" ? candidate.brandName.trim() : "";
  const audience = typeof candidate.audience === "string" ? candidate.audience.trim() : "";
  const offer = typeof candidate.offer === "string" ? candidate.offer.trim() : "";
  const brandVoice = typeof candidate.brandVoice === "string" ? candidate.brandVoice.trim() : "";
  const contentGoal = typeof candidate.contentGoal === "string" ? candidate.contentGoal.trim() : "";
  const tone = toneIds.has(candidate.tone as ToneId)
    ? (candidate.tone as ToneId)
    : "professional";
  const sharpness = sharpnessIds.has(candidate.sharpness as SharpnessId)
    ? (candidate.sharpness as SharpnessId)
    : "balanced";
  const ctaMode = ctaModeIds.has(candidate.ctaMode as CtaModeId)
    ? (candidate.ctaMode as CtaModeId)
    : "soft";
  const presetTopic = presetTopicIds.has(candidate.presetTopic as PresetTopicId)
    ? (candidate.presetTopic as PresetTopicId)
    : "none";
  const selectedTypes = Array.isArray(candidate.selectedTypes)
    ? candidate.selectedTypes.filter(isContentTypeId)
    : defaultSelectedTypes;

  if (source.length < 8) {
    throw new Error("Add a little more source material before generating.");
  }

  return {
    source: source.slice(0, 8000),
    brandName: brandName.slice(0, 180),
    audience: audience.slice(0, 240),
    offer: offer.slice(0, 240),
    brandVoice: brandVoice.slice(0, 320),
    contentGoal: contentGoal.slice(0, 180),
    tone,
    sharpness,
    ctaMode,
    presetTopic,
    selectedTypes: selectedTypes.length ? selectedTypes : defaultSelectedTypes
  };
}

function sanitizeGeneratedText(value: string) {
  return normalizePlainText(value)
    .replace(/[—–]/g, ", ")
    .replace(/--+/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ?, ?\n/g, "\n");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeGeneratedText(item))
    .filter(Boolean);
}

function withoutHashtags(value: string) {
  return value
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMeaningfulCaption(value: string) {
  const withoutTags = withoutHashtags(value);
  return withoutTags.split(/\s+/).filter(Boolean).length >= 7;
}

function fallbackCaptionFromSource(source: string, type: ContentTypeId) {
  const cleaned = withoutHashtags(sanitizeGeneratedText(source))
    .split(/\n{2,}|\.\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, type === "tiktok" ? 1 : 2)
    .join(". ");

  if (!cleaned) {
    return type === "tiktok"
      ? "A quick look at the idea behind this update."
      : "A practical look at the idea behind this update.\n\nUse this as a starting point for a clearer, more useful caption.";
  }

  const ending = cleaned.endsWith(".") || cleaned.endsWith("!") || cleaned.endsWith("?") ? "" : ".";
  return type === "tiktok"
    ? `${cleaned}${ending}`.slice(0, 180)
    : `${cleaned}${ending}`;
}

function normalizeSections(value: unknown, selectedTypes: ContentTypeId[]): GeneratedSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const requested = requestedTypeSet(selectedTypes);

  const normalized = value.map((section, index): GeneratedSection | null => {
      const candidate = section as Partial<GeneratedSection>;
      const type = isContentTypeId(candidate.type) ? candidate.type : selectedTypes[index];

      if (!type || !requested.has(type)) {
        return null;
      }

      return {
        id:
          typeof candidate.id === "string" && candidate.id
            ? candidate.id
            : `${type}-${index + 1}`,
        type,
        title:
          typeof candidate.title === "string" && candidate.title
            ? sanitizeGeneratedText(candidate.title)
            : contentTypes.find((item) => item.id === type)?.label ?? "Output",
        platform:
          typeof candidate.platform === "string" && candidate.platform
            ? sanitizeGeneratedText(candidate.platform)
            : "General",
        body: typeof candidate.body === "string" ? sanitizeGeneratedText(candidate.body) : "",
        items: asStringArray(candidate.items),
        cta:
          typeof candidate.cta === "string"
            ? sanitizeGeneratedText(candidate.cta)
            : undefined
      };
    });

  return normalized.filter((section): section is GeneratedSection => section !== null);
}

function parseOpenAIJson(text: string, request: GenerateRequest): GenerationResult {
  const parsed = JSON.parse(text) as {
    title?: unknown;
    summary?: unknown;
    sections?: unknown;
  };

  const sections = normalizeSections(parsed.sections, request.selectedTypes).map((section) => {
    if ((section.type === "instagram" || section.type === "tiktok") && !hasMeaningfulCaption(section.body)) {
      return {
        ...section,
        body: fallbackCaptionFromSource(request.source, section.type)
      };
    }

    return section;
  });

  if (!sections.length) {
    throw new Error("The model returned an empty generation.");
  }

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: request.source,
    tone: request.tone,
    sharpness: request.sharpness,
    ctaMode: request.ctaMode,
    presetTopic: request.presetTopic,
    selectedTypes: request.selectedTypes,
    title:
      typeof parsed.title === "string" && parsed.title
        ? sanitizeGeneratedText(parsed.title)
        : "Social Content Set",
    summary:
      typeof parsed.summary === "string" && parsed.summary
        ? sanitizeGeneratedText(parsed.summary)
        : "Generated social content from your source material.",
    sections: sections.map((section) => ({
      ...section,
      cta: request.ctaMode === "none" ? "" : section.cta
    }))
  };
}

export async function POST(nextRequest: NextRequest) {
  let request: GenerateRequest;

  try {
    request = normalizeRequest(await nextRequest.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured. Add your OpenAI key to .env.local or your deployment environment."
      },
      { status: 500 }
    );
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.2",
      instructions: buildInstructions(),
      input: buildInput(request),
      text: {
        format: {
          type: "json_schema",
          name: "social_content_generation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "summary", "sections"],
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              sections: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "type", "title", "platform", "body", "items", "cta"],
                  properties: {
                    id: { type: "string" },
                    type: { type: "string" },
                    title: { type: "string" },
                    platform: { type: "string" },
                    body: { type: "string" },
                    items: {
                      type: "array",
                      items: { type: "string" }
                    },
                    cta: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    });

    const result = parseOpenAIJson(response.output_text, request);
    const user = await getCurrentUser();

    if (user && isSupabaseAdminConfigured()) {
      try {
        await recordGeneration(user.id, result);
      } catch (error) {
        captureServerError(error, { route: "/api/generate", userId: user.id });
      }

      try {
        await recordUsageEvent({
          userId: user.id,
          email: user.email,
          eventType: "text_generation",
          metadata: {
            generationId: result.id,
            selectedTypes: request.selectedTypes,
            outputCount: result.sections.length
          }
        });
      } catch (error) {
        captureServerError(error, { route: "/api/generate", userId: user.id, event: "usage" });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    captureServerError(error, { route: "/api/generate" });
    return NextResponse.json(
      {
        error:
          "Generation failed. Check the API key, model access, and source material, then try again."
      },
      { status: 500 }
    );
  }
}
