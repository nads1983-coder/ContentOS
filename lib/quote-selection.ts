const STOP = new Set("a an and are as at be by for from has have how i in is it its of on or our that the their this to was we what when with you your".split(" "));
function words(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(w => w.length > 2 && !STOP.has(w));
}
export function selectSourceQuote(source: string): string {
  const candidates = source.split(/\n+|(?<=[.!?])\s+/u).map(s => s.trim().replace(/^(?:caption|post|hook|headline|quote|body)\s*:\s*/i, ""))
    .filter(s => s && !/^(?:hashtags?|keywords?|tags|cta|call to action)\s*:/i.test(s) && !/[#＃][\p{L}\p{M}\p{N}_]+/u.test(s));
  const frequency = new Map<string, number>();
  for (const sentence of candidates) for (const word of new Set(words(sentence))) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  const scored = candidates.map((text, index) => {
    const terms = words(text);
    const relevance = terms.reduce((sum, word) => sum + Math.min((frequency.get(word) ?? 1) - 1, 2), 0);
    const dependent = /^(?:and|but|so|because|also|yet|this|that|these|those|it|they|he|she)\b/i.test(text)
      || /\b(?:me|him|her|them|their|his|hers|it|its|this|that|these|those)\b/i.test(text);
    const fragment = /^(?:(?:sometimes|however|instead|eventually),?\s+)?(?:they|it|he|she|this|that|these|those)\b/i.test(text)
      || /^(?:yes|no|i\s+(?:didn['’]t|did|don['’]t|do|can['’]t|can|won['’]t|will)|we\s+(?:didn['’]t|did|do|can['’]t|can))[.!?]*$/i.test(text)
      || /^(?:keep|just|remember|try|start|stop|follow|click|subscribe)\b/i.test(text) || terms.length < 2;
    const promotional = /(?:\b(?:click|subscribe|sign up|follow us|link in bio)\b|\?)$/i.test(text);
    return { text, index, eligible: !fragment && text.length <= 120,
      score: relevance + Math.min(terms.length, 8) + (text.length >= 25 ? 3 : 0) - (dependent ? 9 : 0) - (promotional ? 8 : 0) };
  }).filter(candidate => candidate.eligible);
  return scored.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.text ?? "";
}
