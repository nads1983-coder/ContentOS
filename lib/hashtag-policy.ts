import type { GenerateRequest, GeneratedSection } from "@/types/content";
import { brandContextScope } from "@/lib/brand-context";
import { conceptualHashtags, hashtagMaximums } from "@/lib/hashtag-context";
import { socialHashtag } from "@/lib/post-format";

type HashtagRequest = GenerateRequest & { refinement?: { instructions?: string; section?: GeneratedSection } };
export const hashtagKey = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
export const hashtagTokens = (text: string) => text.match(socialHashtag) ?? [];
export const hashtagPlatforms = {
  linkedin: "LinkedIn", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", twitter: "X/Twitter", youtubeShorts: "YouTube Shorts"
} as const;
export type HashtagPlatform = keyof typeof hashtagPlatforms;
export const isHashtagPlatform = (value: string): value is HashtagPlatform => Object.hasOwn(hashtagPlatforms, value);

// Interpret instructions, not mentions of an instruction inside a question or
// educational topic ("Why are hashtags not working?", "Discuss no hashtags").
export function hashtagChoice(text: string): boolean | undefined {
  let choice: boolean | undefined;
  for (const sentence of text.replace(/[\u2018\u2019]/g, "'").split(/[.!?;,\n]/)) {
    const clause = sentence.trim().replace(/^please\s+/i, "");
    if (/^(?:why|how|what|when|should|can|could|would|does|do|is|are)\b/i.test(clause) && !/^do not\b/i.test(clause)) continue;
    if (/^(?:no|without|omit|avoid|exclude|remove|leave out|do not (?:use|include|add)|don't (?:use|include|add)|use no)\s+(?:any\s+)?hashtags?\b/i.test(clause) ||
        /^(?:use|include|add|keep)\s+(?:exactly\s+|only\s+)?(?:0|zero)\s+hashtags?\b/i.test(clause) ||
        /^(?:write|create|generate|make)\b.*\b(?:post|caption|content)\b.*\b(?:without|with no) hashtags?\b/i.test(clause) ||
        /^hashtags?\s*:\s*(?:none|off|no)\b/i.test(clause)) choice = false;
    else if (/^(?:use|include|add|keep|suggest|recommend|generate|give me)\b[^.!?\n]{0,80}(?:#[\p{L}\p{N}_]+|\bhashtags?\b)/iu.test(clause) ||
        /^(?:write|create|generate|make)\b.*\b(?:post|caption|content)\b.*\bwith hashtags?\b/i.test(clause)) choice = true;
  }
  return choice;
}

const generic = new Set(["hashtag", "hashtags", "platformhashtags", "post", "posts", "content", "tips", "why", "are", "not", "my", "the"]);
const socialThemes: Record<HashtagPlatform, string[]> = {
  linkedin: ["LinkedInTips", "ContentStrategy", "SocialMediaMarketing", "LinkedInGrowth"],
  instagram: ["InstagramTips", "ContentStrategy", "SocialMediaMarketing", "InstagramGrowth"],
  tiktok: ["TikTokTips", "ContentStrategy", "SocialMediaMarketing", "TikTokStrategy"],
  facebook: ["FacebookTips", "ContentStrategy", "SocialMediaMarketing"],
  twitter: ["ContentStrategy", "SocialMediaMarketing"],
  youtubeShorts: ["YouTubeShortsTips", "ContentStrategy", "SocialMediaMarketing"]
};
const canonical = new Map(["Consistency", "ShowingUp", "LinkedInPresence", "LinkedInGrowth", "PersonalBranding", "ProfessionalGrowth", "ProfessionalDevelopment", "SkillDevelopment", "Learning", "Coding", "Programming", "SoftwareDevelopment", "Productivity", "TimeManagement", "Creativity", "CreativeProcess"].map(tag => [hashtagKey(tag), `#${tag}`]));

export function buildHashtagPolicy(request: HashtagRequest) {
  const scope = brandContextScope(request);
  const current = [request.source, request.refinement?.instructions ?? ""].join("\n");
  const choice = hashtagChoice(request.refinement?.instructions ?? "") ?? hashtagChoice(request.source);
  const selected = request.selectedTypes.includes("platformHashtags");
  const enabled = choice ?? (selected ? true : hashtagChoice(request.writingStyle ?? "") ?? true);
  const allowed = new Set<string>();
  const explicit = new Set<string>();
  const denied = new Set<string>();
  const concepts = new Set<string>();
  const topicParts: string[] = [];
  if (scope.identity && request.brandName) allowed.add(hashtagKey(request.brandName));
  const brandPattern = request.brandName ? new RegExp(`(?<![\\p{L}\\p{N}])${request.brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu") : null;
  for (const text of [request.source, request.refinement?.instructions ?? "", scope.savedFacts ? request.offer ?? "" : "", scope.identity ? request.audience ?? "" : ""]) {
    const topic = (brandPattern ? text.replace(brandPattern, "") : text).split(/(?<=[.!?;])\s+|\n/)
      .filter(clause => !/^\s*(?:please\s+)?(?:no|omit|avoid|exclude|remove|without|do not|don't)\b/i.test(clause)).join(" ");
    topicParts.push(topic);
    for (const key of conceptualHashtags(topic)) { allowed.add(key); concepts.add(canonical.get(key) ?? `#${key}`); }
    const words = topic.normalize("NFKC").toLowerCase().replace(/(\d),(?=\d{3}\b)/g, "$1").match(/[\p{L}\p{N}]+/gu) ?? [];
    for (let i = 0; i < words.length; i++) for (let length = 1; length <= 4 && i + length <= words.length; length++) allowed.add(words.slice(i, i + length).join(""));
  }
  const topic = topicParts.join(" ");
  // YouTube as the subject supports discovery themes, not claims about the
  // author's channel, income or niche. Platform selection cannot activate these.
  if (/\byoutube\b/i.test(topic)) for (const tag of ["YouTube", "OnlineVideo", "VideoContent", "VideoDiscovery", "DigitalMedia", "YouTubeVideos", "VideoSharing", "DigitalContent", "OnlineContent", "YouTubeCommunity"]) {
    allowed.add(hashtagKey(tag)); concepts.add(`#${tag}`);
  }
  const socialTopic = /\bhashtags?\b/i.test(topic) && /\b(?:posts?|posting|social|reach|engagement|work(?:ing)?|effectiveness|strategy|strategies)\b/i.test(topic);
  const selectedPlatforms = request.selectedTypes.filter(isHashtagPlatform);
  const platforms = selectedPlatforms.length ? selectedPlatforms : Object.keys(hashtagPlatforms).filter(isHashtagPlatform);
  for (const platform of platforms) if (socialTopic) for (const tag of socialThemes[platform]) allowed.add(hashtagKey(tag));
  for (const [preferences, isCurrent] of [[request.writingStyle ?? "", false], [current, true]] as const) for (const clause of preferences.split(/[.!?\n]/)) {
    const negative = /\b(?:no|avoid|exclude|omit|remove|without|do not use|don't use)\b/i.test(clause);
    for (const tag of hashtagTokens(clause)) {
      const key = hashtagKey(tag);
      if (negative) denied.add(key);
      else { if (isCurrent) { allowed.add(key); explicit.add(tag); } denied.delete(key); }
    }
  }
  const accepts = (tag: string) => enabled && !generic.has(hashtagKey(tag)) && allowed.has(hashtagKey(tag)) && !denied.has(hashtagKey(tag)) &&
    (scope.identity || !request.brandName || hashtagKey(tag) !== hashtagKey(request.brandName));
  const suggestions = (platform: HashtagPlatform) => [...new Set([
    ...(socialTopic && platforms.includes(platform) ? socialThemes[platform].map(tag => `#${tag}`) : []), ...concepts, ...explicit
  ])].filter(accepts);
  const existingPreference = request.refinement?.section && hashtagTokens([request.refinement.section.body, ...request.refinement.section.items].join("\n")).some(accepts);
  const instructions = [request.refinement?.instructions, request.source, request.writingStyle].filter((v): v is string => Boolean(v));
  const count = instructions.map(text => text.match(/\b(?:use|include|add|keep)\s+(?:up to\s+|only\s+|exactly\s+)?(\d{1,2})\s+hashtags?\b/i)).find(Boolean);
  const explicitTags = instructions.some(text => text.split(/[.!?\n]/).some(clause => /\b(?:use|include|add|keep)\b/i.test(clause) && (/\ball\s+(?:the\s+)?hashtags?\b/i.test(clause) || hashtagTokens(clause).some(accepts))));
  const limit = (type: string) => count ? Number(count[1]) : type === "platformHashtags" ? 5 : explicitTags ? Infinity : hashtagMaximums[type] ?? 5;
  return { enabled, accepts, suggestions, platforms, limit, requested: enabled && (selected || choice === true || Boolean(existingPreference)) };
}

export function hashtagPromptContext(request: HashtagRequest) {
  const policy = buildHashtagPolicy(request);
  if (!policy.enabled) return "Hashtag instruction: omit all hashtags, including the separate set, because an explicit no-hashtag preference applies.";
  return [
    `Hashtag instruction: ${policy.requested ? "meaningful suggestions explicitly requested" : "use relevant platform defaults when appropriate"}. Questions about hashtags not working are subjects, not omission instructions.`,
    "Every platform caption gets its own relevant tags automatically, whether or not Hashtags is selected. Keep them in items, grouped after one blank line below the post. Facebook, LinkedIn and YouTube allow up to five; never stop at one when several useful themes are supported. Do not pad sparse topics.",
    "The optional Hashtags format is ONE set of five additional subject-relevant choices, distinct from the union of caption tags and unique within the set. Do not repeat platform-labelled caption sets or remove caption tags to supply it. Use fewer if five supported alternatives are unavailable. #Hashtags alone is not useful.",
    ...policy.platforms.map(platform => `${hashtagPlatforms[platform]} source-derived candidates (not business claims or mandatory quotas): ${policy.suggestions(platform).join(" ") || "choose meaningful tags supported by the actual subject; do not invent a niche"}`)
  ].join("\n");
}
