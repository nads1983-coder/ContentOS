import { imageCopy } from "@/lib/image-design";

// Extract a small amount of the post itself rather than guessing facts or
// making a second model request. The full (bounded) source travels separately.
export function suggestImageDescription(post: string): string {
  const clean = imageCopy(post, post.length).replace(/\r/g, "").trim();
  if (!clean) return "";
  const sentences = clean.split(/(?<=[.!?])\s+|\n+/u)
    .map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(s => s.length >= 12 && !/^(?:cta|call to action|hashtags?|keywords?)\s*:/i.test(s));
  if (!sentences.length) return `Communicate visually: ${clean.slice(0, 400)}`;
  const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}']{4,}/gu) ?? []);
  const stop = new Set(["that", "this", "with", "from", "your", "have", "will", "what", "when", "about", "into", "they", "their", "there", "more", "than", "just", "been", "were", "some", "would", "could", "should", "because", "through"]);
  const frequencies = new Map<string, number>();
  for (const s of sentences) for (const word of new Set(words(s))) if (!stop.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  const ranked = sentences.map((text, index) => ({ text, index, score:
    words(text).reduce((sum, word) => sum + Math.min((frequencies.get(word) ?? 0) - 1, 3), 0) / Math.sqrt(Math.max(words(text).length, 1)) +
    (/\b(?:but|instead|rather|means|matter|because|learn|change|transition|leadership|growth|team|career|skills|journey|future|next chapter)\b/i.test(text) ? 2 : 0) -
    (/\b(?:follow|comment|share|subscribe|click|let me know)\b/i.test(text) ? 4 : 0)
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: typeof ranked = [];
  let length = 0;
  for (const item of ranked) {
    if (chosen.length === 3) break;
    if (length + item.text.length > 430 && chosen.length) continue;
    chosen.push(item); length += item.text.length;
  }
  const message = chosen.sort((a, b) => a.index - b.index).map(item => item.text).join(" ");
  const bounded = message.length > 430 ? `${message.slice(0, 427).replace(/\s+\S*$/, "")}...` : message;
  return `Create a visual that communicates this idea: ${bounded}`;
}
