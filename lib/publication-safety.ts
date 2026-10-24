import type { GenerateRequest, GenerationResult, PublicationReview } from "@/types/content";
import { reviewBusinessFacts } from "@/lib/business-facts";
import { factualSentences } from "@/lib/claim-evidence";
import { contentTypes } from "@/lib/content-config";

const removedNote = "Unconfirmed channel or publication history was omitted. Confirm those details before adding them.";
const missingNote = "Complete the labelled confirmation details before publication.";
export function preparePublication(value: unknown, request: GenerateRequest) {
  const copy = structuredClone(value);
  const omitted = new Map<string, string[]>();
  const counts = new Map<number, number>();
  for (const decision of reviewBusinessFacts(copy, request)) {
    if (decision.classification !== "unsupported") continue;
    // Only a complete, separable sentence may be removed. Other material claims
    // still fail closed; never repair a price, guarantee or qualifier by guessing.
    if (decision.category !== "channel") throw new Error("Unresolved factual claim");
    const parts = decision.field.split(".");
    if (!["title", "summary", "sections"].includes(parts[0]) || parts.includes("platform")) throw new Error("Invalid claim location");
    const section = parts[0] === "sections" ? Number(parts[1]) : -1;
    const count = (counts.get(section) || 0) + 1;
    if (count > 8) throw new Error("Too many unresolved claims in one asset");
    counts.set(section, count);
    let parent = copy as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) parent = parent[part] as Record<string, unknown>;
    const key = parts.at(-1)!;
    if (typeof parent[key] !== "string") throw new Error("Invalid claim field");
    parent[key] = factualSentences(parent[key]).filter(sentence => sentence !== decision.text).join("\n\n");
    const rawSection = section < 0 ? undefined : (copy as { sections: Array<{ type?: string }> }).sections[section];
    const type = contentTypes.find(t => t.id === rawSection?.type)?.id ?? request.selectedTypes[section];
    omitted.set(section < 0 ? "global" : type, [removedNote]);
  }
  if (reviewBusinessFacts(copy, request).some(d => d.classification === "unsupported")) throw new Error("Unresolved factual claim");
  return { value: copy, omitted };
}

export function attachPublicationReview(result: GenerationResult, omitted: Map<string, string[]>) {
  result.sections = result.sections.map(section => {
    const notes = [...new Set([...(omitted.get("global") || []), ...(omitted.get(section.type) || []),
      ...([result.title, result.summary, section.title, section.body, ...section.items, section.cta || ""].some(s => /\[CONFIRM:/i.test(s)) ? [missingNote] : [])])];
    const review: PublicationReview = { status: notes.length ? "needs_confirmation" : "ready_to_review", notes };
    return { ...section, review };
  });
  return result;
}
