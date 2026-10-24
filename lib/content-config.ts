import {
  CtaModeId,
  ContentTypeId,
  FilterId,
  PresetTopicId,
  SharpnessId,
  ToneId
} from "@/types/content";

export type ContentTypeConfig = {
  id: ContentTypeId;
  label: string;
  shortLabel: string;
  group: FilterId;
  prompt: string;
  paidOnly?: boolean;
};

export const contentTypes: ContentTypeConfig[] = [
  {
    id: "linkedin",
    label: "LinkedIn Post",
    shortLabel: "LinkedIn",
    group: "linkedin",
    prompt: "One LinkedIn post: open with the supplied point or useful contrast, develop a focused professional perspective in short paragraphs, and end practically. No invented professional experience."
  },
  {
    id: "instagram",
    label: "Instagram Caption",
    shortLabel: "Instagram",
    group: "instagram",
    prompt: "Three Instagram caption alternatives: vary the angle using supplied details, use conversational mobile-friendly copy, and prefer three to five genuinely relevant hashtags, including source-supported themes and synonyms. Use fewer when appropriate. No stock backstory or forced motivational ending."
  },
  {
    id: "tiktok",
    label: "TikTok Caption",
    shortLabel: "TikTok",
    group: "tiktok",
    prompt: "Three short TikTok caption alternatives with distinct spoken-style hooks, minimal setup, and up to five source-supported tags. No forced slang or invented video events."
  },
  {
    id: "twitter",
    label: "X/Twitter Post",
    shortLabel: "X Post",
    group: "twitter",
    prompt: "One concise X/Twitter post expressing one clear idea with natural rhythm, minimal setup and zero to two supported hashtags. Do not compress away factual qualifications."
  },
  {
    id: "facebook",
    label: "Facebook Post",
    shortLabel: "Facebook",
    group: "facebook",
    prompt: "One conversational Facebook post with enough source-grounded context to stand alone and an optional relevant question if CTA settings allow. Do not assume a shared community history."
  },
  {
    id: "youtubeShorts",
    label: "YouTube Shorts Caption",
    shortLabel: "YT Shorts",
    group: "youtube",
    prompt: "One YouTube Shorts caption: a specific searchable title, concise source-grounded description and optional supported tags. Do not promise unseen footage or results."
  },
  {
    id: "xThread",
    label: "X Thread",
    shortLabel: "X Thread",
    group: "twitter",
    prompt: "A concise X thread with a source-grounded opener, 5 to 7 connected numbered posts that advance distinct points, and a final takeaway. No invented evidence to fill posts.",
    paidOnly: true
  },
  {
    id: "shortVideoScript",
    label: "Short Video Script",
    shortLabel: "Video Script",
    group: "video",
    prompt: "A short-form video script with a speakable hook, varied spoken beats, short on-screen cues and a natural close. Mark suggested staging as directions, not events that happened.",
    paidOnly: true
  },
  {
    id: "carousel",
    label: "Carousel Outline",
    shortLabel: "Carousel",
    group: "carousel",
    prompt: "A carousel with an inviting cover, distinct source-grounded points on successive slides, concise support and a clear final slide. Avoid repeating the cover claim on every slide.",
    paidOnly: true
  },
  {
    id: "emailNewsletter",
    label: "Email/Newsletter Draft",
    shortLabel: "Email",
    group: "email",
    prompt: "A concise email/newsletter with accurate subject-line options, a direct personal opening without invented familiarity, a useful body and a CTA only when allowed.",
    paidOnly: true
  },
  {
    id: "repurposePack",
    label: "Repurposing Pack",
    shortLabel: "Repurpose",
    group: "repurpose",
    prompt: "Repurpose the same facts into labelled LinkedIn, Instagram, TikTok, X, carousel, short-video and email assets. Adapt opening, pacing and structure to each platform instead of copying the same caption.",
    paidOnly: true
  },
  {
    id: "hooks",
    label: "Hooks",
    shortLabel: "Hooks",
    group: "hooks",
    prompt: "Eight genuinely different hooks using supplied facts, useful contrasts, direct statements or relevant questions. No invented stakes, audience beliefs, statistics or clickbait."
  },
  {
    id: "ctas",
    label: "CTA Suggestions",
    shortLabel: "CTAs",
    group: "all",
    prompt: "Five concise, distinct CTA options matched to the selected mode and supplied intent. Use feasible actions only; no invented links, giveaways or deadlines. No CTA means no action requests.",
    paidOnly: true
  },
  {
    id: "platformHashtags",
    label: "Platform Hashtags",
    shortLabel: "Hashtags",
    group: "hashtags",
    prompt: "One set of five additional relevant hashtags, different from all caption hashtags and unique within this set. Caption tags remain independent and automatic. Use fewer if unsupported; never infer a niche from the brand name."
  }
];

export const tones: Array<{ id: ToneId; label: string; description: string }> = [
  {
    id: "professional",
    label: "Professional",
    description: "Clear, credible, and polished for business audiences."
  },
  {
    id: "bold",
    label: "Bold",
    description: "Confident, memorable, and opinionated without sounding reckless."
  },
  {
    id: "friendly",
    label: "Friendly",
    description: "Warm, accessible, and easy to engage with."
  },
  {
    id: "inspirational",
    label: "Inspirational",
    description: "Encouraging and energizing while staying grounded."
  },
  {
    id: "direct",
    label: "Direct",
    description: "Brief, clear, and practical with minimal filler."
  },
  {
    id: "story-led",
    label: "Story-led",
    description: "Narrative-first, human, and built around a clear moment."
  },
  {
    id: "sales-focused",
    label: "Sales-focused",
    description: "Benefit-led, conversion-aware, and low on fluff."
  },
  {
    id: "educational",
    label: "Educational",
    description: "Useful, structured, and easy to learn from."
  },
  {
    id: "premium",
    label: "Premium",
    description: "Elegant, selective, and high-trust."
  },
  {
    id: "conversational",
    label: "Conversational",
    description: "Natural, human, and built for two-way engagement."
  }
];

export const sharpnessModes: Array<{
  id: SharpnessId;
  label: string;
  description: string;
}> = [
  {
    id: "soft",
    label: "Soft",
    description: "Gentler framing with more warmth and context."
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Clear, useful, and polished without overdoing it."
  },
  {
    id: "direct",
    label: "Direct",
    description: "Shorter, clearer, and more decisive."
  },
  {
    id: "very-direct",
    label: "Very Direct",
    description: "Blunt, concise, and high signal without hype."
  }
];

export const ctaModes: Array<{
  id: CtaModeId;
  label: string;
  description: string;
}> = [
  {
    id: "none",
    label: "No CTA",
    description: "End with the idea. No prompt to comment, click, or buy."
  },
  {
    id: "soft",
    label: "Soft CTA",
    description: "Use a light conversation prompt or save/share cue."
  },
  {
    id: "website",
    label: "Website CTA",
    description: "Invite the reader to visit a site or landing page."
  },
  {
    id: "product",
    label: "Product CTA",
    description: "Point to an offer, product, service, or resource without pressure."
  }
];

export const presetTopics: Array<{
  id: PresetTopicId;
  label: string;
  description: string;
}> = [
  {
    id: "none",
    label: "No category",
    description: "Use only the source material."
  },
  {
    id: "business",
    label: "Business",
    description: "Operations, strategy, growth, systems, and practical business lessons."
  },
  {
    id: "personal-brand",
    label: "Personal Brand",
    description: "Founder style, credibility, visibility, trust, and audience connection."
  },
  {
    id: "motivation",
    label: "Motivation",
    description: "Encouragement, momentum, resilience, standards, and mindset."
  },
  {
    id: "education",
    label: "Education",
    description: "How-to content, frameworks, explainers, tutorials, and useful lessons."
  },
  {
    id: "sales",
    label: "Sales",
    description: "Objections, offers, buying triggers, trust, and conversion."
  },
  {
    id: "product-promotion",
    label: "Product Promotion",
    description: "Product benefits, launches, use cases, features, and customer outcomes."
  },
  {
    id: "storytelling",
    label: "Storytelling",
    description: "Personal stories, customer moments and lessons only from supplied events; never invent a backstory."
  },
  {
    id: "thought-leadership",
    label: "Thought Leadership",
    description: "Point-of-view content, industry commentary, beliefs, and sharp observations."
  },
  {
    id: "community-building",
    label: "Community Building",
    description: "Conversation starters, audience rituals, belonging, and participation."
  },
  {
    id: "announcements",
    label: "Announcements",
    description: "Launches, updates, milestones, events, releases, and timely news."
  }
];

export const filters: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitter", label: "X/Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "video", label: "Video" },
  { id: "carousel", label: "Carousel" },
  { id: "email", label: "Email" },
  { id: "repurpose", label: "Repurpose" },
  { id: "hashtags", label: "Hashtags" },
  { id: "hooks", label: "Hooks" },
  { id: "saved", label: "Saved" }
];

export const defaultSelectedTypes: ContentTypeId[] = [
  "linkedin",
  "instagram",
  "tiktok",
  "twitter",
  "platformHashtags"
];

export function labelForContentType(id: ContentTypeId) {
  return contentTypes.find((type) => type.id === id)?.label ?? id;
}

export function labelForTone(id: ToneId) {
  return tones.find((tone) => tone.id === id)?.label ?? "Professional";
}

export function labelForSharpness(id: SharpnessId) {
  return sharpnessModes.find((mode) => mode.id === id)?.label ?? "Balanced";
}

export function labelForCtaMode(id: CtaModeId) {
  return ctaModes.find((mode) => mode.id === id)?.label ?? "Soft CTA";
}

export function labelForPresetTopic(id: PresetTopicId) {
  return presetTopics.find((topic) => topic.id === id)?.label ?? "No category";
}

export function descriptionForPresetTopic(id: PresetTopicId) {
  return presetTopics.find((topic) => topic.id === id)?.description ?? "";
}
