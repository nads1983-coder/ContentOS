// Lexical topic grounding, not a semantic fact checker. Caption wording may
// propose phrases, but every substantive word must be anchored in the brief.
const stop = new Set(("a an the i me my mine we us our you your they their it its this that these those " +
  "why how what when where who do does did is are am was were be been being have has had " +
  "can could would should will may might not no so much very different really just " +
  "and or but as of to for from with without in on at by about into through " +
  "write writing create generate make share discuss explain post posts caption captions " +
  "content format formats hashtag hashtags platform platforms please include add use only " +
  "up exactly love like enjoy want need something useful more less working work " +
  "promote introduce announce tell say suggest recommend give reflect reflection update alternatives alternative reached hit celebrate celebrating " +
  "shorter longer warmer tone style friendly professional conversational relevant appropriate " +
  "com co www http https").split(/\s+/));
const editorial = new Set(["ideas", "tips", "inspiration", "discussion"]);
const words = (text: string) => text.normalize("NFKC")
  .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
  .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1 $2")
  .match(/[\p{L}\p{N}]+/gu) ?? [];
const key = (text: string) => text.toLowerCase().replace(/[^\p{L}]/gu, "");
function root(word: string) {
  const lower = word.toLowerCase().replace(/colour/g, "color");
  // Inflection/spelling variants, never an unrelated topic expansion.
  if (/^color(?:s|ed|ful)?$/.test(lower)) return "color";
  return lower.replace(/ies$/, "y").replace(/(?<!s)s$/, "")
    .replace(/(.{4})ing$/, "$1").replace(/(.{4})ed$/, "$1");
}
const tag = (parts: string[]) => "#" + parts.map(p => p[0].toUpperCase() + p.slice(1)).join("");

export function groundedTopicHashtags(source: string, captions: string[] = []) {
  const vocabulary = new Map<string, string>();
  const subject = source
    .replace(/\b(?:on|for|to)\s+(?:Instagram|LinkedIn|TikTok|Facebook|YouTube Shorts|Twitter|X)\b/gi, "")
    .replace(/\b(?:https?:\/\/)?(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?:\/[^\s]*)?/gu, "")
    // Keep a named phrase atomic: "Northbank Paper" cannot supply a paper
    // industry. Full literal names remain supported by the existing policy.
    .replace(/\b(?:[A-Z][a-z]+\s+){1,3}[A-Z][a-z]+\b/g, "");
  for (const word of words(subject)) if (!/\d/.test(word) && !stop.has(word.toLowerCase()) && !editorial.has(word.toLowerCase()) && word.length > 2) vocabulary.set(key(word), root(word));
  const roots = new Set(vocabulary.values());
  const accepts = (candidate: string) => {
    const parts = words(candidate);
    if (!parts.length || parts.length > 5 || /\d/.test(candidate)) return false;
    // Never infer an industry from an opaque single token or a saved identity.
    if (parts.some(part => roots.has(root(part))) && parts.every((part, i) =>
      roots.has(root(part)) || (i === parts.length - 1 && parts.length > 1 && editorial.has(part.toLowerCase())))) return true;
    // Lowercase compounds have no CamelCase boundaries. Segment only against
    // the same source vocabulary, not a free-form word or topic dictionary.
    const compact = key(candidate);
    if (compact.length > 80) return false;
    const reachable = new Map<number, number>([[0, 0]]);
    for (let start = 0; start < compact.length; start++) {
      const count = reachable.get(start);
      if (count === undefined || count >= 5) continue;
      for (let end = start + 3; end <= compact.length; end++) {
        const part = compact.slice(start, end);
        if (roots.has(root(part)) || (start > 0 && end === compact.length && editorial.has(part))) {
          reachable.set(end, Math.min(reachable.get(end) ?? 6, count + 1));
        }
      }
    }
    return reachable.has(compact.length);
  };
  const phrases: string[][] = [];
  for (const text of [subject, ...captions]) {
    // Keep sentence/negation boundaries; do not assemble relationships across them.
    for (const sentence of text.split(/[.!?;:\n]/)) {
      if (/\b(?:not|no|never|without|avoid|exclude|omit|don't)\b/i.test(sentence)) continue;
      let run: string[] = [];
      const flush = () => {
        for (let size = Math.min(3, run.length); size >= 1; size--) {
          // Keep the phrase's head rather than incomplete prefixes such as
          // "Restoring Vintage" from "restoring vintage radios".
          phrases.push(run.slice(-size));
        }
        run = [];
      };
      for (const word of words(sentence)) {
        if (stop.has(word.toLowerCase()) || (!roots.has(root(word)) && !editorial.has(word.toLowerCase()))) flush();
        else run.push(word);
      }
      flush();
    }
  }
  const seen = new Set<string>();
  const suggestions = phrases.sort((a,b) => b.length - a.length).map(tag).filter(candidate => {
    const k = key(candidate);
    if (!accepts(candidate) || seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, 40);
  return { accepts, suggestions };
}
