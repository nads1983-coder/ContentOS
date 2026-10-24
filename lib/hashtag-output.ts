import type { GenerationInput } from "@/lib/generation-contract";
import type { GenerationResult } from "@/types/content";
import { buildHashtagPolicy, hashtagKey, hashtagPlatforms, hashtagTokens, isHashtagPlatform, type HashtagPlatform } from "@/lib/hashtag-policy";

// One non-billable assembly pass. Candidates must be source-grounded before
// insertion; the ordinary relevance/count/format validation still runs after it.
export function completeRequestedHashtags(result: GenerationResult, request: GenerationInput): GenerationResult {
  const policy = buildHashtagPolicy(request);
  const separate = request.selectedTypes.includes("platformHashtags");
  if (!policy.requested && !(separate && !policy.enabled)) return result;
  const unique = (tags: string[]) => [...new Map(tags.filter(policy.accepts).map(tag => [hashtagKey(tag), tag])).values()];
  const sets = new Map<HashtagPlatform, string[]>();
  const unlabelled: string[] = [];
  const separateSection = result.sections.find(section => section.type === "platformHashtags");
  if (separateSection) {
    let platform: HashtagPlatform | undefined;
    for (const line of [separateSection.body, ...separateSection.items].join("\n").split("\n")) {
      const label = line.match(/^\s*(LinkedIn|Instagram|TikTok|Facebook|YouTube Shorts|X(?:\/Twitter)?|Twitter)\s*:/i)?.[1].toLowerCase();
      if (label) platform = Object.keys(hashtagPlatforms).filter(isHashtagPlatform).find(key => hashtagPlatforms[key].toLowerCase() === label) ?? (label === "x" || label === "twitter" ? "twitter" : undefined);
      const tags = hashtagTokens(line);
      if (platform) sets.set(platform, [...(sets.get(platform) ?? []), ...tags]);
      else unlabelled.push(...tags);
    }
  }
  const forPlatform = (platform: HashtagPlatform) => {
    const caption = result.sections.find(section => section.type === platform);
    const previous = request.refinement?.section;
    const current = unique(caption ? hashtagTokens([caption.body, ...caption.items, caption.cta ?? ""].join("\n")) : []);
    if (current.length) return current;
    const preserved = unique(previous?.type === platform ? hashtagTokens([previous.body, ...previous.items].join("\n")) : []);
    if (preserved.length && !separate) return preserved;
    return unique([
      ...(sets.get(platform) ?? []), ...unlabelled,
      ...preserved,
      ...policy.suggestions(platform)
    ]).filter(tag => {
      // A labelled set for another platform does not authorize platform-specific
      // suggestions here. Explicit source mentions can legitimately cross platforms.
      const named = Object.values(hashtagPlatforms).find(name => hashtagKey(tag).startsWith(hashtagKey(name.split("/")[0])));
      return !named || named === hashtagPlatforms[platform] || request.source.toLowerCase().includes(named.toLowerCase());
    });
  };
  return { ...result, sections: result.sections.map(section => {
    if (section.type === "platformHashtags" && separate) {
      if (!policy.enabled) return { ...section, body: "Hashtags omitted as requested.", items: [], cta: "" };
      const items = Object.keys(hashtagPlatforms).filter(isHashtagPlatform).flatMap(platform => {
        const tags = forPlatform(platform);
        return tags.length ? [`${hashtagPlatforms[platform]}: ${tags.join(" ")}`] : [];
      });
      return { ...section, body: items.length ? "" : "[CONFIRM: Add a specific subject before choosing relevant hashtags.]", items, cta: "" };
    }
    if (!policy.enabled || !isHashtagPlatform(section.type)) return section;
    const existing = new Set(hashtagTokens([section.body, ...section.items, section.cta ?? ""].join("\n")).map(hashtagKey));
    return { ...section, items: [...section.items, ...forPlatform(section.type).filter(tag => !existing.has(hashtagKey(tag)))] };
  }) };
}
