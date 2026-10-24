// Saved identity describes the author, not necessarily the subject. Only current
// source instructions can opt identity or saved business facts into a request.
type ContextRequest = { source: string; brandName?: string; refinement?: { instructions?: string } };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalize = (value: string) => value.normalize("NFKC").replace(/[\u2018\u2019]/g, "'");
const clauses = (value: string) => normalize(value).split(/(?<=[.!?;])\s+|\n+/).filter(Boolean);

export function mentionsBrand(value: string, brand: string) {
  const name = normalize(brand).trim();
  if (!name) return false;
  const words = name.split(/\s+/).map(escape).join("[\\s_-]*");
  return new RegExp(`(?<![\\p{L}\\p{N}])#?${words}(?![\\p{L}\\p{N}])`, "iu").test(normalize(value));
}

function identityChoice(text: string, brand: string): boolean | undefined {
  let choice: boolean | undefined;
  for (const clause of clauses(text)) {
    const name = brand.trim() ? brand.trim().split(/\s+/).map(escape).join("[\\s_-]*") : "(?!)";
    const target = `(?:#?${name}|(?:(?:my|our|the saved|any)\\s+)?(?:brand(?:ing| name| identity| logo| hashtags?)?|business name))`;
    const omitted = new RegExp(`\\b(?:no|without|omit|exclude|remove|avoid|not about|(?:do not|don't)\\s+(?:include|add|use|mention|show|promote))\\s+${target}(?![\\p{L}\\p{N}])`, "iu");
    // Merely identifying the author is not an instruction to promote it.
    const subject = clause.replace(new RegExp(`\\b(?:(?:my|our)\\s+(?:brand|business|company)(?: name)?\\s*(?:is|:)\\s*|I\\s+(?:own|run)\\s+)${name}(?![\\p{L}\\p{N}])`, "giu"), "");
    if (omitted.test(clause)) choice = false;
    else if (mentionsBrand(subject, brand) || /\b(?:include|add|use|mention|show|promote|introduce|about)\s+(?:my|our|the saved)\s+(?:brand(?: name| identity| logo)?|business name)\b/i.test(subject)) choice = true;
  }
  return choice;
}

export function brandContextScope(request: ContextRequest) {
  const brand = request.brandName?.trim() ?? "";
  const current = request.refinement?.instructions ?? "";
  const identity = Boolean(brand) && (identityChoice(current, brand) ?? identityChoice(request.source, brand) ?? false);
  // Referencing the brand, a Product CTA or a saved goal does not confirm an offer.
  const savedFactsChoice = (text: string) => {
    let choice: boolean | undefined;
    for (const clause of clauses(text)) {
      if (!/\b(?:saved|confirmed)\s+(?:offer|business facts|business details|product details)\b/i.test(clause)) continue;
      if (/\b(?:no|without|omit|exclude|remove|ignore|(?:do not|don't)\s+(?:use|include|promote|announce))\s+(?:the |my |our )?(?:saved|confirmed)\s+/i.test(clause)) choice = false;
      else if (/\b(?:use|include|promote|announce)\b/i.test(clause)) choice = true;
    }
    return choice;
  };
  const savedFacts = savedFactsChoice(current) ?? savedFactsChoice(request.source) ?? false;
  return { identity, savedFacts };
}

// Remove saved instructions about subject matter, not ordinary stylistic choices.
// This is deliberately bounded; the prompt still labels these as style-only data.
export function styleContext(value: string, brand: string, identity: boolean) {
  return clauses(value).filter(clause =>
    !/\b(?:giveaway|competition|contest|discount|promotion|offer|prize|deadline|partner(?:ship)?|endorsement)\b/i.test(clause) &&
    (identity || !mentionsBrand(clause, brand))
  ).map(clause => clause.replace(/#[\p{L}\p{N}_]+/gu, "").trim()).filter(Boolean).join(" ");
}
