import type { GenerationInput } from "@/lib/generation-contract";
import type { GenerationResult } from "@/types/content";
import { normalizePostSection, socialPostTypes } from "@/lib/post-format";
import { hashtagMaximums, labelledHashtagMaximum } from "@/lib/hashtag-context";
import { buildHashtagPolicy, isHashtagPlatform } from "@/lib/hashtag-policy";
import { completeRequestedHashtags } from "@/lib/hashtag-output";

// A fragment inside a URL or identifier is not a social hashtag.
const tagPattern = /(?<![\p{L}\p{N}_/=?&.%:-])#[\p{L}\p{N}_]+/gu;
const compact = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const tags = (value: string) => value.match(tagPattern) ?? [];

function cleanFiller(value: string, request: GenerationInput) {
  const original = value;
  const preferences = `${request.source}\n${request.writingStyle}\n${request.refinement?.instructions ?? ""}`.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  if (request.tone === "inspirational" || request.presetTopic === "motivation") return value;
  // Only remove complete, nonfactual stock phrases. Never rewrite business facts
  // or treat arbitrary words such as "family" or "journey" as prohibited.
  const removable = [
    { phrase: "every creative journey deserves a little spark", pattern: /,\s*because every creative journey deserves a little spark(?=[.!?])/gi },
    { phrase: "here's to supporting each other and crafting what matters", pattern: /(?:^|(?<=[.!?])\s+|\n)Here['\u2019]s to supporting each other and crafting what matters[.!?](?=\s|$)/gi },
    { phrase: "here's the thing", pattern: /^Here['\u2019]s the thing[.!:]\s*/i }
  ];
  for (const { phrase, pattern } of removable) if (!preferences.includes(phrase)) value = value.replace(pattern, "");
  return value.replace(/\n{3,}/g, "\n\n").trim() || original;
}

export function applyContentQuality(result: GenerationResult, request: GenerationInput): GenerationResult {
  const policy = buildHashtagPolicy(request, result.sections.filter(s => isHashtagPlatform(s.type)).map(s => s.body.replace(tagPattern, "")));
  const supported = policy.accepts;
  result = completeRequestedHashtags(result, request, policy);
  const clean = (text: string, seen?: Set<string>) => cleanFiller(text, request).replace(tagPattern, tag => {
    const key = compact(tag);
    if (!supported(tag) || seen?.has(key)) return "";
    seen?.add(key);
    return tag;
  }).replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trim();
  return {
    ...result,
    title: clean(result.title), summary: clean(result.summary),
    sections: result.sections.map(section => {
      // Separate sets inside a hashtag/repurposing pack can legitimately repeat a
      // brand tag. Deduplicate within each item instead of across platforms.
      const perItem = section.type === "platformHashtags" || section.type === "repurposePack";
      const seen = new Set<string>();
      const body = clean(section.body, seen);
      const items = section.items.map(item => {
        const cleaned = clean(item, perItem ? new Set() : seen);
        return tags(item).length && /^[\w /-]+:\s*$/.test(cleaned) ? "" : cleaned;
      }).filter(Boolean);
      const formatted = normalizePostSection({ ...section, title: clean(section.title), platform: clean(section.platform),
        body: !body && !items.length && section.type === "platformHashtags" ? "No relevant hashtags supported by this brief." : body,
        items, cta: clean(section.cta ?? "", perItem ? new Set() : seen) });
      if (socialPostTypes.has(section.type) || section.type in hashtagMaximums || perItem) {
        const instructions = [request.refinement?.instructions, request.source, request.writingStyle].filter((text): text is string => Boolean(text));
        const separateLines = /(?:one|each) hashtag (?:per|on (?:its|a) (?:separate|new)) line/i;
        const inline = /hashtags? (?:on|in) (?:one|a single) line/i;
        const layout = instructions.find(text => separateLines.test(text) || inline.test(text)) ?? "";
        formatted.hashtagLayout = separateLines.test(layout) ? "lines" : "inline";
        // Explicit tag requests can exceed editorial defaults; unsupported tags
        // were already refused above. Never manufacture replacements to fill a quota.
        const explicit = instructions.some(text => text.split(/[.!?\n]/).some(clause =>
          /\b(?:use|include|add|keep)\b/i.test(clause) &&
          (/\b(?:\d+\s+hashtags?|all\s+(?:the\s+)?hashtags?)\b/i.test(clause) || tags(clause).some(supported))));
        const countRequest = instructions.map(text => text.match(/\b(?:use|include|add|keep)\s+(?:up to\s+|only\s+|exactly\s+)?(\d{1,2})\s+hashtags?\b/i)).find(Boolean);
        if (!explicit || countRequest) {
          let maximum = countRequest ? Number(countRequest[1]) : hashtagMaximums[section.type];
          let count = 0;
          const cap = (text: string) => text.split("\n").map(line => {
            const labelled = perItem ? labelledHashtagMaximum(line) : undefined;
            if (labelled !== undefined) {
              maximum = countRequest ? Number(countRequest[1]) : labelled;
              count = 0;
            }
            return line.replace(tagPattern, tag => maximum === undefined || ++count <= maximum ? tag : "").trimEnd();
          }).join("\n").trim();
          formatted.body = cap(formatted.body);
          formatted.items = formatted.items.map(cap).filter(Boolean);
          formatted.cta = cap(formatted.cta ?? "");
        }
      }
      return formatted;
    })
  };
}
