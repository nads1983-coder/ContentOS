import { imageCopy } from "@/lib/image-design";

// Local, deliberately conservative concepts; the full post remains separate context.
export function suggestImageDescription(post: string): string {
  const clean = imageCopy(post, post.length).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const has = (pattern: RegExp) => pattern.test(clean);
  if (has(/\b(?:career|profession|job)\b/i) && has(/\b(?:chang(?:e|ing)|transition|next chapter|leav(?:e|ing)|moving|shift)\b/i)) {
    const skills = has(/\b(?:skills?|experience|listening|calm)\b/i) ? ", carrying existing skills into the next chapter" : "";
    return `A conceptual visual of a career transition${skills}, reflecting the feelings in the post.`;
  }
  if (has(/\b(?:leadership|leader|leading)\b/i)) {
    const listening = has(/\b(?:listen|listening)\b/i) ? " through listening" : has(/\b(?:ideas|voices)\b/i) ? " and sharing ideas" : "";
    return `A conceptual visual expressing leadership${listening}, grounded in the post's message.`;
  }
  if (has(/\b(?:seed|seeds|planting|garden|roots)\b/i) && has(/\b(?:growth|grow|growing)\b/i)) {
    const relationships = has(/\brelationships?\b/i) ? " and relationships" : "";
    return `A visual metaphor of seeds and growth, expressing the post's ideas${relationships}.`;
  }
  if (has(/\b(?:personal development|self-development|confidence|self-growth)\b/i)) {
    return "A conceptual visual of personal growth, reflecting the challenges and progress described in the post.";
  }
  return "A conceptual visual expressing the central message and emotional context of the source post, using details grounded in it.";
}
