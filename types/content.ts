export type ContentTypeId =
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "facebook"
  | "youtubeShorts"
  | "xThread"
  | "shortVideoScript"
  | "emailNewsletter"
  | "carousel"
  | "ctas"
  | "hooks"
  | "repurposePack"
  | "platformHashtags";

export type ToneId =
  | "professional"
  | "bold"
  | "friendly"
  | "inspirational"
  | "direct"
  | "story-led"
  | "sales-focused"
  | "educational"
  | "premium"
  | "conversational";

export type SharpnessId = "soft" | "balanced" | "direct" | "very-direct";

export type CtaModeId = "none" | "soft" | "website" | "product";

export type PresetTopicId =
  | "none"
  | "business"
  | "personal-brand"
  | "motivation"
  | "education"
  | "sales"
  | "product-promotion"
  | "storytelling"
  | "thought-leadership"
  | "community-building"
  | "announcements";

export type FilterId =
  | "all"
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "facebook"
  | "hashtags"
  | "hooks"
  | "carousel"
  | "youtube"
  | "video"
  | "email"
  | "repurpose"
  | "saved";

export type GeneratedSection = {
  id: string;
  type: ContentTypeId;
  title: string;
  platform: string;
  body: string;
  items: string[];
  cta?: string;
};

export type GenerationResult = {
  id: string;
  createdAt: string;
  source: string;
  tone: ToneId;
  sharpness?: SharpnessId;
  ctaMode?: CtaModeId;
  presetTopic?: PresetTopicId;
  selectedTypes: ContentTypeId[];
  title: string;
  summary: string;
  sections: GeneratedSection[];
};

export type Draft = {
  id: string;
  updatedAt: string;
  title: string;
  source: string;
  tone: ToneId;
  sharpness?: SharpnessId;
  ctaMode?: CtaModeId;
  presetTopic?: PresetTopicId;
  selectedTypes: ContentTypeId[];
};

export type StudioStore = {
  version: 1;
  recent: GenerationResult[];
  saved: GenerationResult[];
  drafts: Draft[];
};

export type GenerateRequest = {
  source: string;
  brandName?: string;
  audience?: string;
  offer?: string;
  brandVoice?: string;
  contentGoal?: string;
  tone: ToneId;
  sharpness: SharpnessId;
  ctaMode: CtaModeId;
  presetTopic: PresetTopicId;
  selectedTypes: ContentTypeId[];
};
