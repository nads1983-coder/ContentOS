// Editorial discovery themes, not evidence of business achievements or offers.
// Only source context may activate these bounded synonyms; generated prose and
// saved style/identity fields must never bootstrap their own relevance.
export function conceptualHashtags(source: string): string[] {
  const text = source.normalize("NFKC").toLowerCase();
  const result = new Set<string>();
  const add = (...tags: string[]) => tags.forEach(tag => result.add(tag));
  const consistent = /\b(?:consisten(?:t|cy|tly)|regular(?:ly)?|showing up|daily practice|steady effort)\b/.test(text);
  const activity = /\b(?:post(?:s|ing)?|activ(?:e|ity)|creat(?:e|ing)|sharing|showing up|writing|presence|practice)\b/.test(text);
  const professional = /\b(?:linkedin|career|professional|workplace)\b/.test(text);
  if (consistent && activity) add("consistency", "showingup");
  if (/\blinkedin\b/.test(text) && activity) {
    add("linkedinpresence");
    if (consistent || /\b(?:growth|grow(?:ing)?|learn(?:ing)?|develop(?:ment|ing)?)\b/.test(text)) add("linkedingrowth");
  }
  if (/\bpersonal (?:brand(?:ing)?|reputation|visibility)\b/.test(text) || (professional && activity && consistent)) add("personalbranding");
  if (/\b(?:professional|career) (?:growth|development|learning)\b/.test(text) || (professional && activity && consistent)) add("professionalgrowth", "professionaldevelopment");
  if (/\b(?:learn(?:ing)?|develop(?:ing)?|improv(?:e|ing)) (?:a |new |my |our )?skills?\b/.test(text)) add("skilldevelopment", "learning");
  if (/\b(?:coding|programming|software development)\b/.test(text)) add("coding", "programming", "softwaredevelopment");
  if (/\b(?:time management|productive workflows?|productivity)\b/.test(text)) add("productivity", "timemanagement");
  if (/\b(?:creative process|creative ideas|creativity)\b/.test(text)) add("creativity", "creativeprocess");
  return [...result];
}

export const hashtagMaximums: Readonly<Record<string, number>> = {
  linkedin: 5, instagram: 5, tiktok: 5, facebook: 3, youtubeShorts: 3, twitter: 2, xThread: 2
};

export function labelledHashtagMaximum(line: string): number | undefined {
  const label = line.match(/^\s*(LinkedIn|Instagram|TikTok|Facebook|YouTube Shorts|X(?:\/Twitter)?|Twitter)\s*:/i)?.[1].toLowerCase();
  return label ? ({ linkedin: 5, instagram: 5, tiktok: 5, facebook: 3, "youtube shorts": 3, x: 2, "x/twitter": 2, twitter: 2 } as Record<string, number>)[label] : undefined;
}
