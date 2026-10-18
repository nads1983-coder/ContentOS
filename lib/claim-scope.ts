/**
 * A bounded claim-slot guard, not a general entailment engine. No findings means
 * only that these explicit patterns did not establish a scope mismatch; semantic
 * review is still required. Sources are evidence, never instructions.
 */
export type ScopeReason = "relationship_scope" | "quantity_scope" | "location_scope" |
  "frequency_scope" | "guarantee_scope";

type Quantity = { min: number; max: number };
type Frequency = "unspecified" | "one" | "some" | "most" | "all" | "often" | "usually";
type Subject = { kind: string; owner: string; frequency: Frequency };
type Slot = {
  subject: Subject; relation: "contains" | "divided" | "outcome";
  object: string; attributes: string[]; quantity?: Quantity;
  distribution: "per_item" | "aggregate";
  certainty: "possible" | "asserted" | "guaranteed";
  negative: boolean; conditional: boolean; located: boolean;
};
type Aliases = Map<string, string>;

const numberWords: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20
};
const normalize = (text: string) => text.toLowerCase().replace(/[\u2018\u2019]/g, "'")
  .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g,
    word => String(numberWords[word])).replace(/[ \t]+/g, " ").trim();
const singular = (word: string) => word.endsWith("ies") ? word.slice(0, -3) + "y"
  : word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
const tokens = (text: string) => text.match(/[a-z][a-z0-9-]*/g) ?? [];
const knownTypes = "notebook|book|course|hotel|kit|plan|service|device|report|product|box|pack|account";
const concrete = new Set(("heading prompt page section chapter lesson activity seat chair room window door hook shelf " +
  "port screen sensor compartment pocket certificate recording refund support backup delivery report warranty").split(" "));

function clauses(text: string) {
  // Preserve decimals, but not sentence/line boundaries or semicolon scope.
  return normalize(text).split(/(?<=[.!?])\s+|[;\n]+|,\s+and\s+(?=(?:each|every|all|some|the)\b)/).map(clause => clause
    .replace(/^(?:(?:linkedin|instagram|tiktok|x\/twitter|email|video|support|beat(?: \d+)?|slide \d+):\s*)+/, "")
    .replace(/[.!?]+$/, "").trim()).filter(Boolean);
}

function aliasesFrom(sources: string[]): Aliases {
  const aliases: Aliases = new Map();
  for (const text of sources) {
    const normalized = normalize(text);
    // Only explicit type/name introductions; nearby nouns never establish identity.
    for (const match of normalized.matchAll(new RegExp(`\\b(${knownTypes}), ([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?),`, "g"))) {
      aliases.set(match[2], match[1]);
    }
    for (const match of normalized.matchAll(new RegExp(`(?:^|[.!?] )([a-z][a-z0-9-]*) is (?:a|an|the) (?:new )?(${knownTypes})\\b`, "g"))) {
      aliases.set(match[1], match[2]);
    }
    for (const match of normalized.matchAll(new RegExp(`(?:^|[.!?] )([a-z][a-z0-9-]*) (${knownTypes}) (?=has|contains|includes|provides|offers)`, "g"))) {
      if (!/^(?:the|a|an|this|every|each|our|your|new|old)$/.test(match[1])) aliases.set(match[1], match[2]);
    }
  }
  return aliases;
}

function frequency(text: string): Frequency {
  if (/\b(?:every|each|all|always|per)\b/.test(text)) return "all";
  if (/\bmost\b/.test(text)) return "most";
  if (/\busually\b/.test(text)) return "usually";
  if (/\boften\b/.test(text)) return "often";
  if (/\b(?:some|sometimes|occasionally)\b/.test(text)) return "some";
  if (/\b(?:a|an|single|1)\b/.test(text)) return "one";
  return "unspecified";
}

function subject(text: string, aliases: Aliases): Subject {
  const freq = frequency(text);
  let value = text.replace(/\([^)]*\)/g, " ")
    .replace(new RegExp(`\\b(${knownTypes}), ([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)?),`, "g"), "$2 $1");
  value = value.replace(/\b(?:may|might|could|can|will|always|sometimes|often|usually)\s*$/, "");
  // Unresolved pronouns neither establish an entity mismatch nor certify a
  // named entity's facts. Their referents remain semantic-review work.
  if (/^(?:it|they|he|she|we|you|i|this|that|these|those)\s*$/.test(value.trim())) {
    return { kind: "", owner: "", frequency: freq };
  }
  const named = [...aliases.keys()].filter(name => new RegExp(`\\b${name}\\b`).test(value));
  const owner = named.length === 1 ? named[0] : "";
  // An explicit creator suffix does not turn the named product into its creator.
  if (owner && new RegExp(`^${owner} by [a-z][a-z -]*$`).test(value.trim())) value = owner;
  // "Fieldline by Studio is an A5 notebook with ..." still describes a notebook.
  value = value.split(/\bis (?:an?|the)\b/).at(-1) ?? value;
  const words = tokens(value).filter(word => !/^(?:a|an|the|this|these|that|those|its|their|our|your|new|every|each|all|some|most|single|a\d+)$/.test(word));
  const last = words.at(-1) ?? "";
  const kind = owner && words.join(" ") === owner ? aliases.get(owner)! : singular(last);
  const prefix = words.slice(0, -1).join(" ").replace(/'s\b/g, "");
  const possibleOwners = [...aliases].filter(([, type]) => type === kind).map(([name]) => name);
  // "The notebook" can name one explicitly identified notebook, never one of two.
  return { kind, owner: owner || prefix || (possibleOwners.length === 1 ? possibleOwners[0] : ""), frequency: freq };
}

function quantity(text: string): Quantity | undefined {
  // Only a noun phrase's leading count: "25-minute assessment" and quantities
  // embedded in a relative clause are not counts of that phrase's object.
  const match = /^\s*(?:(up to|at most|at least|exactly) )?(\d+(?:\.\d+)?)(?:(?:\s*[-\u2013]\s*|\s+to\s+)(\d+(?:\.\d+)?))?(?=\s+(?!(?:of|to)\b)[a-z])/.exec(text);
  if (!match) return undefined;
  const n = Number(match[2]);
  if (match[3] && (match[1] || Number(match[3]) < n)) return undefined;
  if (match[1] === "up to" || match[1] === "at most") return { min: 0, max: n };
  if (match[1] === "at least") return { min: n, max: Infinity };
  return { min: n, max: match[3] ? Number(match[3]) : n };
}

function object(text: string) {
  const phrase = text.split(/[:,]|\b(?:that|which|for|so)\b/)[0];
  const words = tokens(phrase).filter(word => !/^(?:a|an|the|these|those|its|their|our|your|up|to|at|most|least|exactly)$/.test(word));
  return { name: singular(words.at(-1) ?? ""), attributes: words.slice(0, -1), quantity: quantity(phrase) };
}

const negative = /\b(?:no|not|never|without|cannot|can't|doesn't|don't|isn't|aren't|unknown|unconfirmed|unannounced|unavailable)\b/;
const conditional = /\b(?:if|unless|when|except|provided|subject to|only for|only on|depending)\b/;

function slots(clause: string, aliases: Aliases, evidence: boolean): Slot[] {
  const results: Slot[] = [];
  const isNegative = negative.test(evidence ? clause : clause.split(/,\s*(?:no|not|without)\b/)[0]);
  const isConditional = conditional.test(clause);
  const possible = /\b(?:may|might|could|can|possibly|perhaps|approximately|around)\b/.test(clause);
  const certainty = possible ? "possible" : /\b(?:guarantees?|guaranteed|always|will)\b/.test(clause) ? "guaranteed" : "asserted";
  // A local, explicitly hypothetical generic object is not a product assertion.
  // Naming a source entity prevents this escape; "optional" elsewhere has no effect.
  if (!evidence && /^(?:imagine (?:a|an)|optional (?:imaginary|hypothetical) example: (?:a|an))\b/.test(clause) &&
    ![...aliases.keys()].some(name => new RegExp(`\\b${name}\\b`).test(clause))) return [];
  const add = (sub: Subject, relation: Slot["relation"], obj: ReturnType<typeof object>, located = false,
    distribution: Slot["distribution"] = "per_item") => {
    if (!sub.kind || !obj.name) return;
    results.push({ subject: sub, relation, object: obj.name, attributes: obj.attributes,
      quantity: obj.quantity, distribution, certainty, negative: isNegative, conditional: isConditional, located });
  };

  const division = /^(.*?)\b(?:is|are) divided (?:by|into) (.+)$/.exec(clause);
  if (division) add(subject(division[1], aliases), "divided", object(division[2]));

  const containment = /^(.*?)\b(has|have|contains?|includes?|prints?|provides?|offers?|gives?(?: you)?|with) (.+)$/.exec(clause);
  const nominalWith = containment?.[2] !== "with" || /^(?:a|an|the|this|that|a\d+)\b/.test(containment[1]) ||
    [...aliases.keys()].some(name => containment[1].startsWith(name));
  if (containment && nominalWith) {
    const outer = subject(containment[1], aliases);
    // Counts bind to their own noun phrase, never to another coordinated object.
    for (const part of containment[3].split(/\band\b/)) {
      const location = /\b(on|in|inside|within|per|across|at) ((?:(?:each|every|all|some|a|an|the) )?[a-z][a-z0-9 -]*)$/.exec(part.split(/[:,]/)[0]);
      // Placement requires a preceding object; "at most/least" starts a bound.
      const placement = location && part.slice(0, location.index).trim() ? location : null;
      const obj = object(placement ? part.slice(0, placement.index) : part);
      if (/^prints?$/.test(containment[2]) && !obj.attributes.includes("printed")) obj.attributes.push("printed");
      if (placement) {
        const inner = subject(`${placement[1] === "per" ? "every " : ""}${placement[2]}`, aliases);
        inner.owner = outer.owner || (!new RegExp(`^(?:${knownTypes})$`).test(outer.kind) && !concrete.has(outer.kind) ? outer.kind : inner.owner);
        add(inner, "contains", obj, true, placement[1] === "across" ? "aggregate" : "per_item");
      } else add(outer, "contains", obj);
    }
  }

  // Inverse/fragment form: "3 headings per page", including spoken overlays.
  const inverse = /(?:^|,\s+and\s+)(\d+(?:\.\d+)? [a-z][a-z -]*?) (?:are printed |are located |are placed )?(on|in|inside|within|per|across|at) ((?:(?:each|every|all|some|a|an|the) )?[a-z][a-z0-9 -]*)(?=[:,.]|$)/.exec(clause);
  if (!containment && inverse) {
    const sub = subject(`${inverse[2] === "per" ? "every " : ""}${inverse[3]}`, aliases);
    const obj = object(inverse[1]);
    if (/are printed/.test(inverse[0])) obj.attributes.push("printed");
    // Inverse fragments have no explicit containment verb. Require a recognized
    // property noun, not an action such as "9 repaired" or "8 hooks grounded".
    if (concrete.has(obj.name)) add(sub, "contains", obj, true, inverse[2] === "across" ? "aggregate" : "per_item");
  }

  // Deliberately finite outcome verbs: aesthetic "always feels inviting" and
  // hypothetical preferences are not upgraded to measurable product promises.
  const outcome = /^(.*?)\b(?:(may|might|could|can|will|always|sometimes|often|usually|guarantees? to|is guaranteed to) )?(reduces?|improves?|prevents?|delivers?|saves?|eliminates?|ensures?|protects?|increases?|completes?|restores?) (.+)$/.exec(clause);
  if (outcome && /\b(?:errors?|costs?|latency|revenue|sales|failures?|downtime|reports?|orders?|deliveries|minutes?|seconds?|hours?)\b|\d/.test(outcome[4])) {
    const sub = subject(outcome[1], aliases);
    if (/always|sometimes|often|usually/.test(outcome[2] ?? "")) {
      sub.frequency = outcome[2] === "always" ? "all" : outcome[2] === "sometimes" ? "some" : outcome[2] as Frequency;
    }
    const predicate = `${singular(outcome[3])} ${outcome[4]}`;
    add(sub, "outcome", { name: predicate, attributes: [], quantity: undefined });
  }
  const guarantee = /^(.*?)\bguarantees? (.+)$/.exec(clause);
  if (guarantee && !outcome) {
    add(subject(guarantee[1], aliases), "outcome", { name: `guarantee ${guarantee[2]}`, attributes: [], quantity: undefined });
  }
  return results;
}

function sameSubject(a: Subject, b: Subject) {
  // Anonymous claims cannot borrow a different named product's relationship.
  return a.kind === b.kind && a.owner === b.owner;
}

function supportsFrequency(source: Frequency, claim: Frequency) {
  if (source === claim || source === "all") return true;
  if (source === "unspecified" && claim === "one") return true;
  return source === "most" && claim === "some";
}

function supportsQuantity(source: Quantity | undefined, claim: Quantity | undefined) {
  return !claim || !!source && source.min >= claim.min && source.max <= claim.max;
}

type ExplicitFact = {
  relation: "coverage" | "receipt" | "collection" | "recurrence" | "reviewed" | "capability" | "license" | "schedule";
  owner: string; object: string; value: string; negative: boolean; tentative: boolean; exclusive: boolean; coordinated: boolean;
  cardinality?: number;
};
const nounKey = (text: string) => text.trim().replace(/^(?:the|a|an) /, "").split(" ").map(singular).join(" ");
const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function daySet(text: string): string | undefined {
  const value = text.replace(/^(?:only )?(?:on )?/, "");
  if (/^(?:every weekday|weekdays)$/.test(value)) return weekdays.slice(0, 5).join(",");
  if (weekdays.includes(value)) return value;
  const range = /^(\w+) (?:through|to) (\w+)$/.exec(value);
  if (range) {
    const start = weekdays.indexOf(range[1]), end = weekdays.indexOf(range[2]);
    if (start >= 0 && end >= start) return weekdays.slice(start, end + 1).join(",");
  }
  return undefined;
}

// Finite assertion grammars, not inferred links between arbitrary mentions.
// Each fact retains the actor, operation/object and its explicit scope value.
function explicitFacts(text: string): ExplicitFact[] {
  const facts: ExplicitFact[] = [];
  for (const clause of clauses(text)) {
    const add = (relation: ExplicitFact["relation"], owner: string, object: string, value: string, exclusive = false, coordinated = false,
      cardinality?: number) => {
      const identity = owner.trim().replace(/^the /, "");
      if (!identity || /^(?:it|they|we|you|this|that)$/.test(identity)) return;
      facts.push({ relation, owner: identity, object, value, exclusive, coordinated, cardinality,
        negative: negative.test(clause), tentative: conditional.test(relation === "schedule" ? clause.replace(/\bonly on\b/, "on") : clause) ||
          /\b(?:may|might|could|possibly|perhaps)\b/.test(clause) });
    };

    const quantified = /^(.+?) (?:now )?(has|have|includes?|received|receives?) (.+)$/.exec(clause);
    if (quantified) {
      const parts = quantified[1].split(" and ");
      for (const part of parts) {
        const counted = /^(all|each|every|some|\d+)(?: (\d+))? ([a-z][a-z -]*)$/.exec(part);
        const name = counted?.[3] ?? part;
        // Partitives and embedded predicates need semantic review, not a count guess.
        if (!name || /\b(?:of|is|are|was|were)\b/.test(name) || !/^[a-z][a-z -]*$/.test(quantified[3])) continue;
        add(/^receiv/.test(quantified[2]) ? "receipt" : "coverage", nounKey(name), nounKey(quantified[3]),
          counted ? (/^(?:all|each|every)$/.test(counted[1]) ? "all" : counted[1]) : "one",
          false, parts.length > 1 && /^(?:all|each|every) /.test(parts[0]),
          counted?.[2] !== undefined ? Number(counted[2]) : counted && /^\d+$/.test(counted[1]) ? Number(counted[1]) : undefined);
      }
    }

    const service = /^(.+?) (?:offers|provides) (parcel|package) collection at (?:its|the) (.+?)( only)?$/.exec(clause);
    if (service) for (const location of service[3].split(" and ")) add("collection", service[1], service[2], location, !!service[4]);
    const invitation = /^(?:collect|pick up) (parcels|packages) at (.+?)'s (.+)$/.exec(clause);
    if (invitation) add("collection", invitation[2], singular(invitation[1]), invitation[3]);
    const available = /^(parcel|package) collection is available (?:only )?at (.+?)'s (.+?)( only)?$/.exec(clause);
    if (available) for (const location of available[3].split(" and ")) {
      add("collection", available[2], available[1], location, /available only/.test(clause) || !!available[4]);
    }
    const locations = /^both (.+?)'s (.+?) and (.+?) provide (parcel|package) collection$/.exec(clause);
    if (locations) for (const location of [locations[2], locations[3]]) add("collection", locations[1], locations[4], location);

    const recurrence = /^(.+?) (?:runs|holds|hosts|offers) ([a-z -]+?) (?:every (day|week|month|year)|(daily|weekly|monthly|yearly))$/.exec(clause);
    if (recurrence) add("recurrence", recurrence[1], nounKey(recurrence[2]),
      recurrence[3] ?? ({ daily: "day", weekly: "week", monthly: "month", yearly: "year" } as Record<string, string>)[recurrence[4]]);
    const recurring = /^(.+?)'s ([a-z -]+?) recur(?:s)? every (day|week|month|year)$/.exec(clause);
    if (recurring) add("recurrence", recurring[1], nounKey(recurring[2]), recurring[3]);
    const announced = /^(.+?) has announced ([a-z -]+?) on \d/.exec(clause);
    if (announced) add("recurrence", announced[1], nounKey(announced[2]), "announced_dates");

    const reviewed = /^(\d+) ([a-z -]+?) (?:was|were) reviewed during (.+)$/.exec(clause);
    if (reviewed && !clause.includes(",")) add("reviewed", reviewed[3], nounKey(reviewed[2]), reviewed[1]);
    // Do not discard material/object modifiers or trailing qualifications. A
    // qualified clause outside this grammar remains a whole semantic claim.
    const activeReview = /^(.+?) reviewed (?:the full allowance of )?(\d+) ([a-z -]+?)$/.exec(clause);
    if (activeReview) add("reviewed", activeReview[1], nounKey(activeReview[3]), activeReview[2]);

    const edit = /^(.+?) can edit (notes|documents|photos|files) (offline|online)$/.exec(clause);
    if (edit) add("capability", edit[1], `edit ${singular(edit[2])}`, edit[3]);
    const editing = /^(.+?)( both)? supports? (offline|online) (note|document|photo|file) editing$/.exec(clause);
    if (editing) for (const owner of editing[2] ? editing[1].split(" and ") : [editing[1]]) {
      add("capability", owner, `edit ${editing[4]}`, editing[3]);
    }

    const license = /^(.+?) licenses its ([a-z -]+?) to (.+?)(?: under (?:this|the) agreement)?$/.exec(clause);
    if (license) add("license", license[1], nounKey(license[2]), license[3]);
    const recipient = /^(.+?) receives its ([a-z -]+?) licen[cs]e from (.+?)(?: under (?:this|the) agreement)?$/.exec(clause);
    if (recipient) add("license", recipient[3], nounKey(recipient[2]), recipient[1]);

    const schedule = /^(.+?) (?:(?:now|still) )?accepts (?:parcel )?returns (.+)$/.exec(clause);
    if (schedule) {
      const days = daySet(schedule[2]);
      if (days) add("schedule", schedule[1], "returns", days, /^only\b/.test(schedule[2]));
    }
  }
  return facts;
}

function explicitFindings(text: string, sources: string[], currentSources: string[]): ScopeReason[] {
  const evidence = sources.flatMap(explicitFacts);
  const current = currentSources.flatMap(explicitFacts);
  const findings = new Set<ScopeReason>();
  for (const claim of explicitFacts(text)) {
    if (claim.negative || claim.tentative) continue;
    const sameRelation = (source: ExplicitFact) => source.relation === claim.relation && source.owner === claim.owner &&
      (source.object === claim.object || claim.relation === "reviewed" && !claim.object.includes(" ") && source.object.endsWith(` ${claim.object}`));
    const candidates = evidence.filter(source => !source.negative && !source.tentative && sameRelation(source));
    // Universal scope does not erase an explicitly stated population size.
    // Only the same subject/property's known universal total establishes this
    // contradiction; unrelated numbers and unspecified totals remain unproven.
    if (claim.value === "all" && claim.cardinality !== undefined && candidates.some(source =>
      source.value === "all" && source.cardinality !== undefined && source.cardinality !== claim.cardinality)) {
      findings.add("quantity_scope");
      continue;
    }
    // Universal possession/receipt alone is not necessarily a concrete business
    // claim ("Every idea has value"). Require a source-bound subject/relation;
    // unparsed paraphrases and abstract assertions remain semantic-review work.
    if ((claim.relation === "coverage" || claim.relation === "receipt") &&
      !evidence.some(source => source.relation === claim.relation && source.owner === claim.owner)) continue;
    // Only authoritative caller-provided current sources can override saved facts.
    if (claim.relation === "schedule" && current.some(source => sameRelation(source) && source.exclusive &&
      !source.negative && !source.tentative && claim.value.split(",").some(day => !source.value.split(",").includes(day)))) {
      findings.add("frequency_scope");
      continue;
    }
    if (candidates.some(source => {
      if (claim.exclusive && !source.exclusive) return false;
      if (claim.relation === "schedule" && !claim.exclusive) {
        return claim.value.split(",").every(day => source.value.split(",").includes(day));
      }
      return source.value === claim.value;
    })) continue;
    if (claim.relation === "reviewed") {
      const head = claim.object.split(" ").at(-1);
      const generic = evidence.filter(source => source.relation === "reviewed" && source.owner === claim.owner &&
        source.object === head && !source.negative && !source.tentative);
      // A generic total cannot establish a sample's material. Leave that
      // modifier to semantic review, but reject a count exceeding that total.
      const conflictingModifier = evidence.some(source => source.relation === "reviewed" && source.owner === claim.owner &&
        source.object !== claim.object && source.object.endsWith(` ${head}`) && !source.negative && !source.tentative);
      if (!candidates.length && !conflictingModifier && claim.object !== head && generic.length &&
        generic.every(source => Number(claim.value) <= Number(source.value))) continue;
    }
    // Non-universal quantified paraphrases/partitives still need semantic review.
    if ((claim.relation === "coverage" || claim.relation === "receipt") && claim.value !== "all" && !claim.coordinated) continue;
    if (claim.relation === "coverage" || claim.relation === "receipt" || claim.relation === "recurrence" || claim.relation === "schedule") findings.add("frequency_scope");
    else if (claim.relation === "collection") findings.add("location_scope");
    else if (claim.relation === "reviewed") findings.add("quantity_scope");
    else findings.add("relationship_scope");
  }
  return [...findings];
}

/**
 * Compare complete explicit slots, including identity, relation, object, bounds,
 * frequency and modality. Never combine fragments from different source claims.
 * No cross-sentence pronoun resolution or arbitrary paraphrase is attempted.
 */
export function scopeFindings(text: string, sources: string[], currentSources: string[] = []): ScopeReason[] {
  const aliases = aliasesFrom(sources);
  const evidence = sources.flatMap(source => clauses(source).flatMap(clause => slots(clause, aliases, true)));
  const findings = new Set<ScopeReason>(explicitFindings(text, sources, currentSources));
  for (const claim of clauses(text).flatMap(clause => slots(clause, aliases, false))) {
    // Negative/conditional claims and unknown vocabulary remain semantic work.
    if (claim.negative || claim.conditional) continue;
    const scoped = claim.relation === "divided" || claim.relation === "outcome" || !!claim.quantity ||
      concrete.has(claim.object) && (claim.located || claim.subject.frequency === "all");
    if (!scoped) continue;
    const candidates = evidence.filter(source => !source.negative && !source.conditional &&
      sameSubject(source.subject, claim.subject) && source.relation === claim.relation && source.object === claim.object &&
      source.distribution === claim.distribution &&
      claim.attributes.every(attribute => source.attributes.includes(attribute)));
    const certaintyRank = { possible: 0, asserted: 1, guaranteed: 2 };
    if (candidates.some(source => supportsQuantity(source.quantity, claim.quantity) &&
      supportsFrequency(source.subject.frequency, claim.subject.frequency) &&
      certaintyRank[source.certainty] >= certaintyRank[claim.certainty])) continue;
    if (!candidates.length) {
      findings.add(claim.located ? "location_scope" : "relationship_scope");
      if (claim.certainty === "guaranteed") findings.add("guarantee_scope");
      continue;
    }
    if (!candidates.some(source => supportsQuantity(source.quantity, claim.quantity))) findings.add("quantity_scope");
    if (!candidates.some(source => supportsFrequency(source.subject.frequency, claim.subject.frequency))) findings.add("frequency_scope");
    if (!candidates.some(source => certaintyRank[source.certainty] >= certaintyRank[claim.certainty])) findings.add("guarantee_scope");
    // Individually matching facts are not a certificate for their conjunction.
    if (!findings.size) findings.add("relationship_scope");
  }
  return [...findings];
}
