import type { GenerateRequest } from "@/types/content";

// A bounded backstop for recognizable high-risk claims, not a semantic fact checker.
// Requiring source wording here deliberately favours refusal over guessed entailment.
const highRiskClaims = [
  /\b(?:we|I|our business|our company|our brand|the business|the company|the brand)\s+(?:was |were )?(?:started|began|founded|launched|built)\s+(?:(?:this|our|the)\s+(?:business|company|brand)\s+)?(?:as|in|from|with|by|back in)\b/i,
  /\b(?:our|my|the)\s+(?:founder|founding|origin)\s+(?:story|journey|team)\b/i,
  /\b(?:I|we)\s+(?:worked as|lived in|grew up|quit my|quit our|spent \d+ years|remember when)\b/i,
  /\b(?:customers?|clients?|reviewers?)\s+(?:say|said|told us|rated|love|report|reported)\b/i,
  /\b(?:testimonial|five.star rated|5.star rated|award.winning|certified|accredited)\b/i,
  /\b(?:won|received|earned)\b[^.!?\n]{0,60}\b(?:award|qualification|certification)\b/i,
  /\b(?:revenue|sales|conversion|performance)\b[^.!?\n]{0,50}(?:\d|[$£€%])/i,
  /(?:[$£€]\s*\d|\b\d+(?:\.\d+)?\s*(?:GBP|USD|EUR)\b)/i,
  /\b(?:guaranteed|money.back|lifetime warranty|risk.free|guarantee(?:s|d)? (?:you|results|success))\b/i,
  /\b(?:includes?|features?|comes with)\s+(?:\d|a |an |built.in|unlimited)/i,
  /\b(?:giveaway|prize|winner|entries|eligibility)\b[^.!?\n]{0,80}\b(?:closes?|ends?|receives?|wins?|eligible|only|worth|deadline)\b/i,
  /\b(?:partnered with|in partnership with|endorsed by|trusted by)\b/i
];

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();
}

function sentences(value: string) {
  // Keep decimals and thousands separators intact. Split only sentence boundaries.
  return value.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function hasUnsupportedBusinessFacts(value: unknown, request: GenerateRequest): boolean {
  // Voice, audience, goals and the previous AI asset are not evidence. Saved offer
  // text is user-supplied context, not independently verified business information.
  const evidence = sentences(request.source).concat(sentences(request.offer || "")).map(normalize);
  const result = record(value);
  const sections = Array.isArray(result.sections) ? result.sections : [];
  const fields = [result.title, result.summary, ...sections.flatMap(value => {
    const s = record(value);
    return [s.title, s.platform, s.body, ...(Array.isArray(s.items) ? s.items : []), s.cta];
  })].filter((field): field is string => typeof field === "string");
  const brand = request.brandName?.trim();
  const brandPattern = brand ? new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : null;
  return fields.some(field => sentences(field).some(sentence => {
    // Only an entire labelled placeholder is exempt, never adjacent assertions.
    if (/^\[CONFIRM:\s*[^\]\n[]+\][.!?]?$/.test(sentence)) return false;
    const classified = brandPattern ? sentence.replace(brandPattern, "our business") : sentence;
    if (!highRiskClaims.some(pattern => pattern.test(classified))) return false;
    const claim = normalize(sentence).replace(/[.!?]+$/, "");
    // Whole source sentences, not substring matches: "Do not say X" and "not X"
    // must not authorize X. No partial matching that loses qualifiers or quantities.
    return !evidence.some(source => source.replace(/[.!?]+$/, "") === claim);
  }));
}
