import type { GenerateRequest } from "@/types/content";
import { channelClaims, channelEvidence, milestoneEvidence, promotionEvidence, subjectText, sourceEvidence } from "@/lib/claim-evidence";
import { plainPostText } from "@/lib/post-format";

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
  /\b(?:enter|join|hosting|running|holding|launching)\s+(?:our |the |a |this )?(?:giveaway|competition|contest)\b/i,
  /\b(?:our|the|this)\s+(?:giveaway|competition|contest|sale|offer)\s+(?:is|starts?|ends?|runs?|closes?|opens?)\b/i,
  /(?:^|[.!?:]\s*)(?:win|enter to win)\s+(?:a\b|an\b|\d|[$£€])|\b(?:chance to win|entry deadline|entries (?:are|open|close)|free shipping|\d+\s*%\s*off)\b|\b(?:comment|follow|tag|like|share|subscribe|sign up)\b[^.!?\n]{0,80}\b(?:to enter|for entry)\b/i,
  /\bonly\s+[^.!?\n]{1,80}\b(?:eligible|can enter|may enter)\b/i,
  /\b(?:partnered with|in partnership with|endorsed by|trusted by)\b/i
];

const purposeClaim = /\b(?:our|my|the)\s+(?:mission|purpose|vision)\s*(?::|(?:is|was|remains|has always been|to)\b)|\b(?:our business|we|our brand|our company)\s+(?:exists? to|was created to|is dedicated to|is committed to|aims? to|stands? for|is here to|supports? your)\b/i;
const commitmentClaim = /\b(?:details?|information|announcement|updates?|entry rules|prizes?)\s+(?:(?:are|is|will be)\s+)?(?:coming|to come|follow|will follow|available soon|announced soon)\b|\b(?:we(?:'ll| will| promise to)|our business will)\b|\b(?:stay tuned|watch this space|keep an eye out)\b/i;
const datedEvent = /\b(?:today|yesterday|tonight|this (?:morning|week|month|year)|last (?:week|month|year)|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in 20\d{2})\b/i;
const eventClaim = /\b(?:hit|reached|crossed|achieved|celebrating|launched|opened|started|founded|closed|sold|won|turns?|anniversary)\b/i;
const milestone = /\b(\d[\d,]*(?:\.\d+)?\s*[km]?)\s+(?:(?:newsletter|email list|podcast|youtube channel|blog)\s+)?(subscribers?|followers?|customers?|members?|sales|orders?)\b/gi;

type ClaimCategory = "high_risk" | "purpose" | "commitment" | "timing" | "milestone" | "channel";
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

function normalize(value: string) {
  return plainPostText(value).normalize("NFKC").toLowerCase().replace(/[\u2018\u2019]/g, "'")
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
  const evidence = sourceEvidence(request).map(fact => ({ ...fact, text: normalize(fact.text).replace(/[.!?]+$/, "") }));
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
    const claimCategory = classify(sentence) ?? (channelClaims(sentence, request).length ? "channel" : undefined);
    const claim = normalize(sentence).replace(/[.!?]+$/, "");
    // Whole source sentences, not substring matches: "Do not say X" and "not X"
    // must not authorize X. No partial matching that loses qualifiers or quantities.
    const supported = evidence.find(source => subjectText(source.text, request) === subjectText(claim, request) && !(source.source === "offer" && evidence.some(current =>
      current.source === "brief" && classify(current.text) === claimCategory && /\b(?:not|never|no longer|do not|don't)\b/.test(current.text))));
    if (supported) return { ...base, category: claimCategory, classification: "source_supported", evidence: { source: supported.source, index: supported.index } };
    if (claimCategory) {
      const fact = milestoneEvidence(sentence, String(path), request);
      if (fact) return { ...base, category: claimCategory, classification: "source_supported", evidence: { source: fact.source, index: fact.index } };
    }
    const promotion = promotionEvidence(sentence, request);
    if (promotion) return { ...base, category: claimCategory, classification: "source_supported", evidence: { source: promotion.source, index: promotion.index } };
    if (claimCategory === "channel" && channelEvidence(sentence, request)) return { ...base, category: claimCategory, classification: "source_supported" };
    // No recognized claim is NOT a verification certificate. The UI continues to
    // require editorial fact review; this bounded guard does not prove semantics.
    return { ...base, category: claimCategory, classification: claimCategory ? "unsupported" : "unverified_expression" };
  }));
}

export function hasUnsupportedBusinessFacts(value: unknown, request: GenerateRequest): boolean {
  return reviewBusinessFacts(value, request).some(decision => decision.classification === "unsupported");
}
