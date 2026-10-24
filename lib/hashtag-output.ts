import type { GenerationInput } from "@/lib/generation-contract";
import type { GenerationResult, GeneratedSection } from "@/types/content";
import { buildHashtagPolicy, hashtagKey, hashtagTokens, isHashtagPlatform } from "@/lib/hashtag-policy";
import { socialHashtag } from "@/lib/post-format";

const sectionTags = (section: GeneratedSection) => hashtagTokens([section.body, ...section.items, section.cta ?? ""].join("\n"));
const withoutTags = (text: string) => text.replace(socialHashtag, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const unique = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.filter(tag => { const key = hashtagKey(tag); if (seen.has(key)) return false; seen.add(key); return true; });
};

export function captionHashtags(result: GenerationResult) {
  return unique(result.sections.filter(section => isHashtagPlatform(section.type)).flatMap(sectionTags));
}

// Local edits/refinement must not leave duplicated additional choices in the
// saved/exported pack. Caption tags always take priority.
export function excludeCaptionHashtags(result: GenerationResult): GenerationResult {
  const used = new Set(captionHashtags(result).map(hashtagKey));
  return { ...result, sections: result.sections.map(section => {
    if (section.type !== "platformHashtags") return section;
    const tags = sectionTags(section);
    if (!tags.length) return section;
    const items = unique(tags).filter(tag => !used.has(hashtagKey(tag)));
    return { ...section, body: items.length ? "" : "No additional relevant hashtags beyond those in your posts.", items, cta: "" };
  }) };
}

// Captions allocate first, without reading the optional set. All additions pass
// the same source policy and caps before exclusion from the additional pool.
export function completeRequestedHashtags(result: GenerationResult, request: GenerationInput): GenerationResult {
  const policy = buildHashtagPolicy(request);
  const accepted = (tags: string[]) => unique(tags.filter(policy.accepts));
  const sections = result.sections.map(section => {
    if (!isHashtagPlatform(section.type) || !policy.enabled) return section;
    const previous = request.refinement?.section;
    const current = accepted(sectionTags(section));
    const prior = previous?.type === section.type ? accepted(sectionTags(previous)) : [];
    const limit = policy.limit(section.type);
    const target = Number.isFinite(limit) ? limit : Math.max(5, current.length, prior.length);
    const items = accepted([...current, ...prior, ...policy.suggestions(section.type)]).slice(0, target);
    return { ...section, body: withoutTags(section.body), cta: withoutTags(section.cta ?? ""),
      items: [...section.items.map(withoutTags).filter(Boolean), ...items] };
  });
  const used = new Set([...captionHashtags({ ...result, sections }), ...(request.refinement?.captionHashtags ?? [])].map(hashtagKey));
  return { ...result, sections: sections.map(section => {
    if (section.type !== "platformHashtags" || !request.selectedTypes.includes("platformHashtags")) return section;
    if (!policy.enabled) return { ...section, body: "Hashtags omitted as requested.", items: [], cta: "" };
    const candidates = accepted([...sectionTags(section), ...policy.platforms.flatMap(platform => policy.suggestions(platform))]);
    const items = candidates.filter(tag => !used.has(hashtagKey(tag))).slice(0, policy.limit("platformHashtags"));
    const body = items.length ? "" : candidates.length ? "No additional relevant hashtags beyond those in your posts." : "[CONFIRM: Add a specific subject before choosing relevant hashtags.]";
    return { ...section, body, items, cta: "" };
  }) };
}
