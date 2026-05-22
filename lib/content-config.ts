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
    prompt: "One polished LinkedIn post with a strong opening line, readable spacing, a clear point of view, and a practical ending."
  },
  {
    id: "instagram",
    label: "Instagram Caption",
    shortLabel: "Instagram",
    group: "instagram",
    prompt: "Three Instagram captions with a scroll-stopping first line, mobile-friendly spacing, useful context, and up to seven relevant hashtags."
  },
  {
    id: "tiktok",
    label: "TikTok Caption",
    shortLabel: "TikTok",
    group: "tiktok",
    prompt: "Three short TikTok captions with clear hooks, native-feeling language, and up to five relevant hashtags."
  },
  {
    id: "twitter",
    label: "X/Twitter Post",
    shortLabel: "X Post",
    group: "twitter",
    prompt: "One concise X/Twitter post with a sharp idea, natural voice, and a clean ending."
  },
  {
    id: "facebook",
    label: "Facebook Post",
    shortLabel: "Facebook",
    group: "facebook",
    prompt: "One Facebook post that feels conversational, community-aware, and easy to respond to."
  },
  {
    id: "youtubeShorts",
    label: "YouTube Shorts Caption",
    shortLabel: "YT Shorts",
    group: "youtube",
    prompt: "One YouTube Shorts caption with a searchable title idea, short description, and relevant tags."
  },
  {
    id: "xThread",
    label: "X Thread",
    shortLabel: "X Thread",
    group: "twitter",
    prompt: "A concise X thread with a strong opener, 5 to 7 connected posts, and a final takeaway.",
    paidOnly: true
  },
  {
    id: "shortVideoScript",
    label: "Short Video Script",
    shortLabel: "Video Script",
    group: "video",
    prompt: "A short-form video script with a hook, spoken beats, on-screen text cues, and a simple close.",
    paidOnly: true
  },
  {
    id: "carousel",
    label: "Carousel Outline",
    shortLabel: "Carousel",
    group: "carousel",
    prompt: "A carousel outline with slide-by-slide headlines, concise support points, and a clear final slide.",
    paidOnly: true
  },
  {
    id: "emailNewsletter",
    label: "Email/Newsletter Draft",
    shortLabel: "Email",
    group: "email",
    prompt: "A concise email or newsletter draft based on the source, with subject line options and a clear CTA.",
    paidOnly: true
  },
  {
    id: "repurposePack",
    label: "Repurposing Pack",
    shortLabel: "Repurpose",
    group: "repurpose",
    prompt: "Turn the source into a LinkedIn post, Instagram caption, TikTok caption, X post or thread, carousel outline, short video script, and email/newsletter draft.",
    paidOnly: true
  },
  {
    id: "hooks",
    label: "Hooks",
    shortLabel: "Hooks",
    group: "hooks",
    prompt: "Eight platform-flexible hooks with clear stakes, curiosity, and no clickbait."
  },
  {
    id: "ctas",
    label: "CTA Suggestions",
    shortLabel: "CTAs",
    group: "all",
    prompt: "Five CTA options matched to the selected CTA mode and audience intent.",
    paidOnly: true
  },
  {
    id: "platformHashtags",
    label: "Platform Hashtags",
    shortLabel: "Hashtags",
    group: "hashtags",
    prompt: "Platform-appropriate hashtag or keyword sets for LinkedIn, Instagram, TikTok, X/Twitter, Facebook, and YouTube Shorts."
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
    description: "Founder voice, credibility, visibility, trust, and audience connection."
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
    description: "Personal stories, customer moments, lessons learned, and narrative posts."
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
