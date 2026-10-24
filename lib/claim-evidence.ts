import type { GenerateRequest } from "@/types/content";
import { brandContextScope } from "@/lib/brand-context";

export function factualText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\s*(?:[\u2013\u2014]|--+)\s*/g, ", ")
    .replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
}
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function subjectText(value: string, request: GenerateRequest) {
  let text = factualText(value);
  if (request.brandName?.trim()) text = text.replace(new RegExp(`\\b${escaped(factualText(request.brandName))}\\b`, "g"), "we");
  return text.replace(/^our (?:business|company|brand)\b/, "we").replace(/^we has\b/, "we have");
}
export const factualSentences = (value: string) => value.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
export function isConfirmedFact(text: string) {
  return !/\?|\b(?:maybe|might|could|would|possibly|potential|consider(?:ing)?|hope|wish|imagine|example|hypothetical|unconfirmed|tbc|tbd)\b|\b(?:planning to|plan to|not confirmed|to be confirmed|if we)\b/i.test(text);
}
export function sourceEvidence(request: GenerateRequest) {
  const scope = brandContextScope(request);
  return (["brief", "offer"] as const).flatMap(source => factualSentences(source === "brief" ? request.source : scope.savedFacts ? request.offer || "" : "")
    .map((text, index) => ({ text: factualText(text), subject: subjectText(text, request), source, index }))
    .filter(fact => isConfirmedFact(fact.text)));
}

export function promotionEvidence(value: string, request: GenerateRequest) {
  const text = subjectText(value, request);
  const existence = text.match(/^(?:to celebrate this milestone, )?we(?:'re| are) (?:running|hosting|holding|launching) a (giveaway|competition|contest)$/);
  // Describing the requested draft announcement adds no prize, deadline or entry
  // commitment. Additional promotional terms must still match source evidence.
  const announcementDraft = text.match(/^our (giveaway|competition|contest) announcement is taking shape$/);
  const kind = (existence ?? announcementDraft)?.[1];
  if (!kind) return undefined;
  const facts = sourceEvidence(request);
  const negative = new RegExp(`\\b(?:no|not|never|cancelled|canceled|don't)\\b[^.!?]{0,80}\\b${kind}\\b|\\b${kind}\\b[^.!?]{0,80}\\b(?:cancelled|canceled|not running)\\b`);
  if (facts.some(f => f.source === "brief" && negative.test(f.text))) return undefined;
  if (text.startsWith("to celebrate") && !facts.some(f => /\b(?:reached|hit) \d[\d,]* (?:subscribers|followers|members)\b/.test(f.subject))) return undefined;
  // An explicit announcement instruction confirms existence, never terms.
  const instruction = new RegExp(`(?:^|;\\s*)(?:announce|promote) (?:our|the|a|(?:the )?we(?:'s)?) ${kind}(?: on (?:instagram|linkedin))?$`);
  return facts.find(f => f.source === "brief" && instruction.test(f.subject));
}

type Milestone = { amount: number; unit: string };
const count = "(\\d[\\d,]*(?:\\.\\d+)?\\s*[km]?)\\s+(subscribers?|followers?|customers?|members?|sales|orders?)";
function quantity(match: RegExpMatchArray): Milestone {
  const n = match[1].replace(/[\s,]/g, "");
  return { amount: parseFloat(n) * (n.endsWith("k") ? 1000 : n.endsWith("m") ? 1000000 : 1), unit: match[2].replace(/s$/, "") };
}

// Match complete relationships, not bags of allowed words. Extra scope, dates,
// changed subjects, negation and channel qualifiers cannot be discarded.
export function milestoneEvidence(text: string, field: string, request: GenerateRequest) {
  let claim = subjectText(text, request);
  const source = sourceEvidence(request);
  const giveaway = source.some(s => s.source === "brief" && /\bannounce (?:our |the |a )?giveaway\b/.test(s.text));
  if (field === "summary") {
    claim = claim.replace(/^(?:instagram|linkedin) caption (?:announcing|for) /, "");
    const audience = factualText(request.audience || "");
    if (audience) {
      const address = `(?:${escaped(audience)}|the ${escaped(audience.replace(/s$/, ""))} community)`;
      claim = claim.replace(new RegExp(`, speaking to ${address}$`), "");
      if (giveaway) claim = claim.replace(new RegExp(` and announce our giveaway to ${address} on (?:instagram|linkedin)$`), " and a giveaway");
      // In an internal synopsis this is audience framing. It is never a rule
      // establishing who can enter in a caption, CTA or giveaway terms.
      const framing = ` and a giveaway for ${audience}`;
      if (giveaway && claim.endsWith(framing)) claim = claim.slice(0, -framing.length) + " and a giveaway";
    }
  }
  if (/\bgiveaway\b/.test(claim) && !giveaway) return undefined;
  const patterns = [
    `^(?:we(?:'ve)? (?:(?:has|have) )?)?(?:reached|reaching|hit|hitting|crossed|achieved) ${count}(?: and (?:a giveaway|launching a giveaway))?$`,
    `^${count}(?: and giveaway announcement)?$`,
    `^hit a big milestone: ${count} on we$`
  ];
  if (field === "title" || field === "summary" || /\.title$/.test(field)) patterns.push(
    `^(?:we )?${count} giveaway (?:(?:instagram|linkedin) )?announcement$`,
    `^celebrate reaching ${count} at we and a giveaway$`
  );
  const matched = patterns.map(p => claim.match(new RegExp(p))).find(Boolean);
  if (!matched) return undefined;
  const expected = quantity(matched);
  return source.find(s => {
    if (s.source !== "brief") return false;
    const parts = s.subject.split(";");
    if (parts.length > 2 || (parts[1] && !/^\s*announce (?:our |the |a )?giveaway(?: on (?:instagram|linkedin))?$/.test(parts[1]))) return false;
    const fact = parts[0].match(new RegExp(`^we(?:'ve)? (?:(?:has|have) )?(?:reached|hit|crossed|achieved) ${count}$`));
    if (!fact) return false;
    const actual = quantity(fact);
    return actual.amount === expected.amount && actual.unit === expected.unit;
  });
}

const channels = "newsletter|email list|podcast|youtube channel|blog";
type ChannelClaim = { channel: string; relation: "existence" | "history" };
export function channelClaims(value: string, request: GenerateRequest): ChannelClaim[] {
  const text = subjectText(value, request);
  const claims: ChannelClaim[] = [];
  for (const channel of channels.split("|")) {
    const c = escaped(channel);
    // Ownership, publication and presupposed history assert a relationship.
    // Merely mentioning a channel as advice or an example does not.
    const history = new RegExp(`\\b(?:since (?:our |the )?(?:first |earliest )?|(?:our |the )(?:first|earliest) )${c}\\b`).test(text);
    const ownership = new RegExp(`\\b(?:our|my|we's) (?:(?:weekly|monthly|daily|regular|first|new) )?${c}\\b|\\bwe (?:have|publish(?:es)?|send(?:s)?|run(?:s)?|host(?:s)?|started|launched)(?: a| an| our| the)? (?:weekly |monthly |first )?${c}\\b|\\b${c} subscribers\\b`).test(text);
    if (history || ownership) claims.push({ channel, relation: history ? "history" : "existence" });
  }
  return claims;
}

export function channelEvidence(text: string, request: GenerateRequest) {
  const claims = channelClaims(text, request), evidence = sourceEvidence(request);
  return claims.length > 0 && claims.every(claim => evidence.some(s => {
    if (/\b(?:not|never|no longer|do not|don't|if|imagine|hope|want|might|could|will)\b/.test(s.subject)) return false;
    if (s.source === "offer" && evidence.some(b => b.source === "brief" && b.subject.includes(claim.channel) && /\b(?:not|never|no longer|don't)\b/.test(b.subject))) return false;
    // A supplied channel establishes existence only. Its first issue, launch,
    // frequency, audience and dates still require the complete supplied fact.
    const exact = s.subject === subjectText(text, request);
    return exact || claim.relation === "existence" &&
      new RegExp(`^we (?:have|publish(?:es)?|send(?:s)?|run(?:s)?|host(?:s)?) (?:a |an |our |the )?${escaped(claim.channel)}$`).test(s.subject) &&
      new RegExp(`^(?:thank you for (?:reading|listening to) |welcome to )our ${escaped(claim.channel)}$`).test(subjectText(text, request));
  }));
}
