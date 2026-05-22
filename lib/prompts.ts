import {
  contentTypes,
  descriptionForPresetTopic,
  labelForCtaMode,
  labelForPresetTopic,
  labelForSharpness,
  labelForTone
} from "@/lib/content-config";
import { CtaModeId, ContentTypeId, GenerateRequest, SharpnessId } from "@/types/content";

const systemVoice = `
You are an AI social media content operating system for creators, entrepreneurs, small businesses, coaches, consultants, and agencies.

Product role:
- turn raw notes, ideas, transcripts, launches, offers, and stories into structured platform-ready content
- help users generate, format, repurpose, and organize content across multiple channels
- keep the output useful, specific, and ready to edit

Voice rules:
- premium but not stiff
- clear, human, and practical
- platform-aware
- audience-aware
- concise where the platform rewards brevity
- specific enough to avoid generic AI content
- natural, with varied sentence length and paragraph rhythm

Avoid:
- fake urgency
- vague inspiration
- corporate jargon
- over-polished AI phrasing
- excessive hype
- filler phrases
- generic coaching language
- repeated sentence structures
- claims that sound fabricated
- pretending to know facts not present in the source

Dash rule:
- Do not use em dashes.
- Do not use double hyphens.
- Use commas, full stops, or line breaks instead.
`.trim();

const sharpnessInstructions: Record<SharpnessId, string> = {
  soft: "Soft: use more warmth, context, and supportive framing.",
  balanced:
    "Balanced: use clear structure, practical language, and polished restraint.",
  direct:
    "Direct: be shorter, more decisive, and more focused on the core point.",
  "very-direct":
    "Very Direct: be concise and high signal. Do not become aggressive or hype-driven."
};

const ctaInstructions: Record<CtaModeId, string> = {
  none: "No CTA: do not include a call to action. Set cta to an empty string and end naturally.",
  soft: "Soft CTA: include a light conversation, save, share, or reflection prompt.",
  website:
    "Website CTA: point toward the user's website, landing page, or link in bio only when it fits naturally.",
  product:
    "Product CTA: point toward an offer, product, service, resource, booking, or demo without fake scarcity."
};

export function buildInstructions() {
  return `${systemVoice}

Return only valid JSON matching this shape:
{
  "title": "short internal label for this generation",
  "summary": "one sentence describing the content angle",
  "sections": [
    {
      "id": "stable-kebab-id",
      "type": "one requested content type id",
      "title": "section title",
      "platform": "LinkedIn | Instagram | TikTok | X/Twitter | Facebook | YouTube Shorts | Carousel | Email | Video | General",
      "body": "main copy, script, rewrite, or explanation",
      "items": ["supporting options, tags, slides, hooks, posts, or bullets"],
      "cta": "optional CTA"
    }
  ]
}

Every requested content type must have one section.
Keep copy specific, premium, useful, and realistic.
Before finalizing, remove any em dashes or double hyphens from every title, body, item, summary, and CTA.`;
}

export function buildInput(request: GenerateRequest) {
  const requestedTypes = request.selectedTypes
    .map((id) => contentTypes.find((type) => type.id === id))
    .filter((type): type is NonNullable<typeof type> => Boolean(type));

  return `
Source material:
${request.source}

Brand/business name: ${request.brandName || "Not provided"}
Target audience: ${request.audience || "Not provided"}
Offer/product/service: ${request.offer || "Not provided"}
Brand voice notes: ${request.brandVoice || "Not provided"}
Content goal: ${request.contentGoal || "Not provided"}
Tone selected: ${labelForTone(request.tone)}
Sharpness selected: ${labelForSharpness(request.sharpness)}
Sharpness behavior: ${sharpnessInstructions[request.sharpness]}
CTA mode selected: ${labelForCtaMode(request.ctaMode)}
CTA behavior: ${ctaInstructions[request.ctaMode]}
Content category selected: ${labelForPresetTopic(request.presetTopic)}
Category guidance: ${
    request.presetTopic === "none"
      ? "Use the source material as the main angle."
      : descriptionForPresetTopic(request.presetTopic)
  }

Generate these content outputs:
${requestedTypes.map((type) => `- ${type.id}: ${type.prompt}`).join("\n")}

General quality rules:
- write for creators, entrepreneurs, small businesses, coaches, consultants, and agencies
- keep the user's source material at the center
- make each output platform-native rather than copying the same post everywhere
- preserve useful details from the source, but do not invent credentials, results, data, or customer proof
- use the brand, audience, offer, brand voice, and content goal when provided
- favor clean structure, clear hooks, and practical takeaways
- avoid sounding like a generic social media manager
- avoid vague words like unlock, empower, thrive, game-changing, and revolutionary unless the source explicitly uses them
- make hooks specific to a tension, outcome, audience belief, or useful contrast
- make CTAs concrete, aligned with the selected CTA mode, and low-friction
- reduce repetitive phrasing by varying sentence openings and section structure

LinkedIn post formatting:
- strongest line first
- short readable paragraphs
- clear point of view
- useful insight or practical lesson
- 3 to 5 professional hashtags only if useful

Instagram caption formatting:
- strong first line that works in preview
- mobile-friendly spacing
- warm, visual, and easy to engage with
- up to 7 relevant hashtags

TikTok caption formatting:
- very short and hook-led
- native, direct, and low filler
- up to 5 relevant hashtags

X/Twitter formatting:
- concise and readable
- one strong idea per post
- if a thread is requested, use numbered items in the items array for each post
- avoid filler and generic hot takes

Facebook formatting:
- conversational, community-aware, and easy to respond to
- warmer than LinkedIn, but still useful

YouTube Shorts formatting:
- searchable title or caption idea
- short description
- relevant tags or keyword phrases
- short-form retention beats when a video script is requested

Short-form video script formatting:
- include hook, spoken beats, on-screen text cues, and close
- write for face-to-camera delivery unless the source implies another format
- keep it tight enough for a short-form video

Carousel outline formatting:
- use items for slide-by-slide headlines and supporting points
- keep each slide concise

Repurposing workflow:
- if Repurposing Pack is requested, include the full set in one section: LinkedIn post, Instagram caption, TikTok caption, X post or thread, carousel outline, short video script, and email/newsletter draft
- use clear labels inside body or items so the user can copy each asset

Platform hashtag rules:
- If Platform Hashtags are requested, create separate labeled sets for LinkedIn, Instagram, TikTok, X/Twitter, Facebook, and YouTube Shorts.
- LinkedIn: 3 to 5 professional hashtags.
- Instagram: 5 to 7 discoverable but specific hashtags.
- TikTok: 3 to 5 searchable tags.
- X/Twitter: 0 to 2 tags, only if useful.
- Facebook: 0 to 3 tags, restrained.
- YouTube Shorts: 8 to 12 searchable tags or keyword phrases.
- Avoid generic tags like #motivation, #success, and #inspiration unless the source makes them unusually relevant.

CTA handling:
- If CTA mode is No CTA, leave cta as an empty string for every section.
- If CTA mode is Soft CTA, keep CTAs light and engagement-oriented.
- If CTA mode is Website CTA, refer to a website, landing page, or link in bio generically.
- If CTA mode is Product CTA, reference an offer, product, service, resource, booking, or demo without fake urgency.

Forbidden punctuation:
- no em dashes
- no double hyphens
`.trim();
}

export function requestedTypeSet(ids: ContentTypeId[]) {
  return new Set(ids);
}
