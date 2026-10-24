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

const purposeClaim = /\b(?:our|my|the)\s+(?:mission|purpose|vision)\s*(?::|(?:is|was|remains|has always been|to)\b)|\b(?:our business|we|our brand|our company)\s+(?:exists? to|was created to|is dedicated to|is committed to|aims? to|stands? for|is here to|supports? your)\b/i;
const commitmentClaim = /\b(?:details?|information|announcement|updates?|entry rules|prizes?)\s+(?:(?:are|is|will be)\s+)?(?:coming|to come|follow|will follow|available soon|announced soon)\b|\b(?:we(?:'ll| will| promise to)|our business will)\b|\b(?:stay tuned|watch this space|keep an eye out)\b/i;
const datedEvent = /\b(?:today|yesterday|tonight|this (?:morning|week|month|year)|last (?:week|month|year)|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in 20\d{2})\b/i;
const eventClaim = /\b(?:hit|reached|crossed|achieved|celebrating|launched|opened|started|founded|closed|sold|won|turns?|anniversary)\b/i;
const milestone = /\b(\d[\d,]*(?:\.\d+)?\s*[km]?)\s+(subscribers?|followers?|customers?|members?|sales|orders?)\b/gi;

type ClaimCategory = "high_risk" | "purpose" | "commitment" | "timing" | "milestone";
export type GroundingDecision = {
  field: string;
  text: string;
  classification: "source_supported" | "confirmation_required" | "unsupported" | "unverified_expression";
  category?: ClaimCategory;
  evidence?: { source: "brief" | "offer"; index: number };
};

function category(text: string): ClaimCategory | undefined {
  if (purposeClaim.test(text)) return "purpose";
  if (commitmentClaim.test(text)) return "commitment";
  if (eventClaim.test(text) && (datedEvent.test(text) || /\bjust\s+(?:hit|reached|crossed)\b/i.test(text))) return "timing";
  if (highRiskClaims.some(pattern => pattern.test(text))) return "high_risk";
  if ([...text.matchAll(milestone)].length) return "milestone";
}

function quantities(text: string) {
  return [...text.matchAll(milestone)].map(match => {
    const number = match[1].replace(/[\s,]/g, "").toLowerCase();
    const amount = parseFloat(number) * (number.endsWith("k") ? 1000 : number.endsWith("m") ? 1000000 : 1);
    return `${amount}:${match[2].toLowerCase().replace(/s$/, "")}`;
  });
}

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\s*(?:[\u2013\u2014]|--+)\s*/g, ", ").replace(/\s+/g, " ").trim();
}

function sentences(value: string) {
  // Keep decimals and thousands separators intact. Split only sentence boundaries.
  return value.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function reviewBusinessFacts(value: unknown, request: GenerateRequest): GroundingDecision[] {
  // Voice, audience, goals and the previous AI asset are not evidence. Saved offer
  // text is user-supplied context, not independently verified business information.
  const evidence = (["brief", "offer"] as const).flatMap(source =>
    sentences(source === "brief" ? request.source : request.offer || "").map((text, index) => ({ text: normalize(text).replace(/[.!?]+$/, ""), source, index })));
  const result = record(value);
  const sections = Array.isArray(result.sections) ? result.sections : [];
  const fields = [["title", result.title], ["summary", result.summary], ...sections.flatMap((value, index) => {
    const s = record(value);
    return [ ...["title", "platform", "body", "cta"].map(key => [`sections.${index}.${key}`, s[key]]),
      ...(Array.isArray(s.items) ? s.items.map((item, i) => [`sections.${index}.items.${i}`, item]) : []) ];
  })];
  const brand = request.brandName?.trim();
  const brandPattern = brand ? new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : null;
  const classify = (text: string) => category(normalize(brandPattern ? text.replace(brandPattern, "our business") : text));
  return fields.flatMap(([path, field]) => typeof field !== "string" ? [] : sentences(field).map((sentence): GroundingDecision => {
    const base = { field: String(path), text: sentence };
    // Only an entire labelled placeholder is exempt, never adjacent assertions.
    if (/^\[CONFIRM:\s*[^\]\n[]+\][.!?]?$/.test(sentence)) return { ...base, classification: "confirmation_required" };
    const claimCategory = classify(sentence);
    const claim = normalize(sentence).replace(/[.!?]+$/, "");
    // Whole source sentences, not substring matches: "Do not say X" and "not X"
    // must not authorize X. No partial matching that loses qualifiers or quantities.
    const supported = evidence.find(source => source.text === claim && !(source.source === "offer" && evidence.some(current =>
      current.source === "brief" && classify(current.text) === claimCategory && /\b(?:not|never|no longer|do not|don't)\b/.test(current.text))));
    if (supported) return { ...base, category: claimCategory, classification: "source_supported", evidence: { source: supported.source, index: supported.index } };
    // A small typed relationship permits milestone phrasing, not arbitrary numeric
    // entailment. Dates, goals, comparisons, scope changes and promises need exact evidence.
    if (claimCategory === "milestone") {
      const simple = (text: string) => !/\b(?:not|never|hope|aim|goal|target|want|will|could|would|if|each|every|per|only|over|under|at least|more than|less than|competitor|client)\b|[%£$€]/i.test(text);
      const milestoneWording = (brandPattern ? claim.replace(brandPattern, "") : claim).replace(milestone, " ")
        .replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
      const allowed = new Set("we our has have reached reaching reach hit hitting crossed crossing achieved celebrate celebrating celebration big milestone on at for and a the this is with giveaway announcement announce launching instagram linkedin caption post subscribers subscriber community thank you to speaking".split(" "));
      // Audience words describe the addressee, never evidence for the achievement.
      if (/\b(?:speaking to|to the)\b/.test(claim)) {
        for (const word of normalize(request.audience || "").split(/\W+/)) { allowed.add(word); allowed.add(word.replace(/s$/, "")); }
      }
      const values = quantities(sentence);
      const subject = brand ? brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "we(?:'ve)?|our business";
      const relationship = new RegExp(`^(?:announce (?:that )?)?(?:${subject})\\s+(?:(?:has|have)\\s+)?(?:reached|hit|crossed|achieved)\\s+\\d[\\d,]*(?:\\.\\d+)?\\s*[km]?\\s+(?:subscribers?|followers?|customers?|members?|sales|orders?)\\s*$`, "i");
      const same = evidence.find(source => source.source === "brief" && simple(source.text) && simple(claim)
        && milestoneWording.every(word => allowed.has(word))
        && relationship.test(source.text.split(";")[0])
        && values.length === 1 && quantities(source.text).length === 1 && quantities(source.text)[0] === values[0]
        && (!brand || source.text.includes(normalize(brand))));
      if (same) return { ...base, category: claimCategory, classification: "source_supported", evidence: { source: same.source, index: same.index } };
    }
    // No recognized claim is NOT a verification certificate. The UI continues to
    // require editorial fact review; this bounded guard does not prove semantics.
    return { ...base, category: claimCategory, classification: claimCategory ? "unsupported" : "unverified_expression" };
  }));
}

export function hasUnsupportedBusinessFacts(value: unknown, request: GenerateRequest): boolean {
  return reviewBusinessFacts(value, request).some(decision => decision.classification === "unsupported");
}
