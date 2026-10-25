type Relation = "alternatives" | "comparison" | "transformation" | "tradeoffs";
type Composition = { relation: Relation; evidence: string; layout: "customer" | "paired" };

// Detect explicit relationships, not general prose semantics. Preserve the whole
// clause: splitting proper names would assign a shared subject to the wrong side.
const preference = /\b(?:colou?rs?|palette|style|font|format|size|background|resolution|export|portrait|landscape|square|vertical|photograph|photo|illustration|graphic|logo|icon|instagram|linkedin|tiktok|facebook|youtube|png|jpeg|jpg|svg|print|web)\b/i;
const aesthetic = /^(?:(?:a|an|the)\s+)?(?:red|blue|green|purple|white|black|gold|cream|pink|yellow|minimal|playful|bold|luxury)$/i;
const incidental = /\b(?:whether or not|or else|one or more|more or less|sooner or later|rain or shine)\b/i;
const negative = /\b(?:do not|don't|never|avoid|without|no|omit|exclude)\b/i;
const explicitLayout = /\b(?:layout|split[- ]screen|side[- ]by[- ]side|top[- ]and[- ]bottom|stacked|diagonal|diptych|triptych|single (?:scene|frame|composition)|one (?:scene|frame|composition)|no (?:split|panels)|without (?:a split|panels)|around (?:a|the) (?:circle|central))\b/i;

function relationship(text: string): Omit<Composition, "layout"> | undefined {
  for (const clause of text.split(/(?<!\bvs)\.|[!?;,\n]/i).map(s => s.trim()).filter(Boolean)) {
    const meaning = clause.replace(/\b(?:no|without)\s+(?:text|letters|captions|watermarks|logos|labels|split[- ]screen|panels)\b/gi, "");
    if (clause.length > 360 || negative.test(meaning) || incidental.test(clause)) continue;
    if (/\bbefore(?:\s*[-/]\s*|[-\s]+and[-\s]+)after\b/i.test(clause)) return { relation: "transformation", evidence: clause };
    if (/\bpros(?:\s*\/\s*|[-\s]+and[-\s]+)cons\b/i.test(clause)) return { relation: "tradeoffs", evidence: clause };
    if (/\S\s+(?:versus|vs\.?)\s+\S/i.test(clause)) return { relation: "comparison", evidence: clause };
    if (/\b(?:stay or leave|this or that)\b/i.test(clause)) return { relation: "alternatives", evidence: clause };
    if ((clause.match(/\bor\b/gi) ?? []).length !== 1) continue;
    // A bounded nominal choice, optionally wrapped in an image instruction.
    // Verb alternatives ("read or work"), output formats and palette choices
    // must not turn an ordinary scene into a comparison.
    const core = meaning.trim().replace(/^(?:(?:please\s+)?(?:create|make|draw|design|show|depict|illustrate)\s+)?(?:an?\s+)?(?:(?:graphic|image|illustration|photo|photograph|poster|comparison|choice)\s+(?:of|about|between)\s+)?/i, "")
      .replace(/\s+(?:graphic|image|illustration|photo|photograph|poster)\b.*$/i, "");
    const sides = core.split(/\s+or\s+/i);
    if (sides.length !== 2 || sides.some(s => !s.trim() || s.split(/\s+/).length > 8)) continue;
    if (sides.some(s => preference.test(s) || aesthetic.test(s))) continue;
    if (/\b(?:can|could|may|might|should|would|use|choose|prefer|like|need|want|read|work|write|include|add|either|if|when)\b/i.test(core)) continue;
    const nominal = sides.every(s => /^(?:(?:a|an|the)\s+|[\p{Lu}]|[\p{L}]+(?:\s+[\p{L}]+){0,3}$)/u.test(s));
    // Unwrapped lower-case prose is ambiguous; accept a compact visual request
    // or capitalised named alternatives, not arbitrary sentences containing or.
    const visual = /\b(?:create|make|draw|design|show|depict|illustrate|graphic|image|illustration|photo|photograph|poster|comparison|choice)\b/i.test(clause);
    if (nominal && (visual || sides.every(s => /^[\p{Lu}]/u.test(s)))) return { relation: "alternatives", evidence: clause };
  }
}

export function planImageComposition(source: string, instructions = ""): Composition | undefined {
  const current = instructions || source;
  if (/\b(?:do not compare|don't compare|no comparison|only (?:show|depict)|show only|instead (?:show|depict)|(?:do not|don't|never) (?:show|depict|include)|omit|exclude)\b/i.test(current)) return;
  const match = relationship(instructions) ?? relationship(source);
  if (!match) return;
  return { ...match, layout: explicitLayout.test(`${instructions}\n${source}`) ? "customer" : "paired" };
}

export function imageCompositionPrompt(source: string, instructions = "", mixed = false): string {
  const plan = planImageComposition(source, instructions);
  if (!plan) return "";
  return [
    `Composition relationship: ${plan.relation}. Exact customer context: ${plan.evidence}`,
    "Identify the two sides from that relationship. Preserve every named option and the main/shared subject from the original brief; a trailing subject belongs to the whole comparison, not just the second option. Do not invent another person, destination or product.",
    plan.layout === "customer"
      ? "Use the customer's explicit layout, ordering and emphasis instead of an inferred split. Keep both alternatives recognisable within that layout."
      : "Default to a balanced two-panel or side-by-side composition with comparable visual area and detail for BOTH sides. Neither option may be reduced to a tiny background detail. A shared subject may bridge the two sides; do not invent a duplicate person.",
    "Use recognisable visual cues for each supplied option while respecting the selected type, style and palette. Do not replace either option with a generic scene. Keep both focal areas inside the central crop-safe region, away from edges.",
    mixed ? "Both alternatives must remain visible together in the upper image area above the application's lower text panel." : "Keep both alternatives visible together in the full-frame image.",
    plan.relation === "transformation"
      ? "Respect before/after order. Depict only the supplied transformation as a conceptual illustration, not evidence of an actual result. Do not invent measured improvements, guarantees or personal history."
      : plan.relation === "tradeoffs"
        ? "Present the two viewpoints as a neutral conceptual contrast. Do not invent product capabilities, factual benefits, drawbacks or a verdict."
        : "The choice remains open: do not depict a confirmed move, purchase, winner or outcome. Do not turn the comparison into an endorsement or personal experience.",
    "This is a composition instruction, not permission to draw labels, captions or extra text. Existing text restrictions still apply."
  ].join("\n");
}
