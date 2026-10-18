export function hasNoCtaInstruction(request: { source: string; writingStyle?: string; contentGoal?: string; ctaMode?: string }) {
  if (request.ctaMode === "none") return true;
  // Do not reinterpret a quoted product name (for example a workshop called "No CTA") as a directive.
  const text = [request.source, request.writingStyle, request.contentGoal].join("\n")
    .replace(/"[^"\n]*"|\u201c[^\u201d\n]*\u201d/g, "");
  return /(?:^|[.!?;\n:]\s*|\bplease\s+)no\s+(?:ctas?|calls?[- ]to[- ]action)\b|\b(?:do not|don't|without|omit|avoid)\s+(?:include\s+|add\s+)?(?:any\s+)?(?:ctas?|calls?[- ]to[- ]action|engagement questions)\b/i.test(text);
}
