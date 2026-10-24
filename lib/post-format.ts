import { cleanPlainText } from "@/lib/text-normalize";
import type { GeneratedSection } from "@/types/content";

export const socialPostTypes = new Set(["instagram", "linkedin", "facebook", "tiktok", "twitter"]);
export const socialHashtag = /(?<![\p{L}\p{N}_/=?&.%:-])#[\p{L}\p{N}_]+/gu;

// Remove paired presentation markers, not literal punctuation, URLs or hashtags.
export function plainPostText(value: string) {
  return cleanPlainText(value)
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, bold, underline) => bold ?? underline)
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?])/g, "$1$2")
    .replace(/^#{1,6}[ \t]+/gm, "");
}

const key = (text: string) => text.normalize("NFC").toLowerCase().replace(/[ \t]+/g, " ").trim();
const sentences = (text: string) => [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)].map(s => s.segment.trim()).filter(Boolean);

export function normalizePostSection(section: GeneratedSection): GeneratedSection {
  if (!socialPostTypes.has(section.type)) return section;
  const seen = new Set<string>();
  const uniqueText = (value: string, paragraphs = false) => {
    const text = plainPostText(value);
    const lines = text.split("\n").map(line => {
      // Keep lists, hashtags and confirmation placeholders structurally intact.
      const parts = /^(?:[-*\u2022]|\d+[.)])\s|\[CONFIRM:|#/.test(line) ? [line.trim()] : sentences(line);
      return parts.filter(part => {
        const id = key(part);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).join(" ");
    });
    let result = cleanPlainText(lines.join("\n"));
    // Supply paragraph boundaries only for an unformatted wall of prose. Keep
    // deliberate single-line rhythm, lists and existing paragraph breaks intact.
    if (paragraphs && !text.includes("\n") && result.length > 240 && !/\[CONFIRM:/.test(result)) {
      const parts = sentences(result);
      if (parts.length >= 3) result = [parts[0], ...Array.from({ length: Math.ceil((parts.length - 1) / 2) }, (_, i) => parts.slice(1 + i * 2, 3 + i * 2).join(" "))].join("\n\n");
    }
    return result;
  };
  // The explicit CTA owns its sentence; an exact duplicate in the body/items is
  // removed without guessing whether differently worded actions mean the same.
  const cta = uniqueText(typeof section.cta === "string" ? section.cta : "");
  const body = uniqueText(typeof section.body === "string" ? section.body : "", section.type !== "twitter" && section.type !== "tiktok");
  const items = (Array.isArray(section.items) ? section.items : []).filter((item): item is string => typeof item === "string").map(item => uniqueText(item)).filter(Boolean);
  return { ...section, body, items, cta };
}
