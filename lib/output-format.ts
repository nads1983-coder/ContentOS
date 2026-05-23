import { normaliseCopyText } from "./copy";
import type { ContentTypeId, GeneratedSection } from "../types/content";

export type OutputBlockKind =
  | "body"
  | "hook"
  | "cta"
  | "hashtags"
  | "thread"
  | "subject"
  | "preview"
  | "title"
  | "tags"
  | "items";

export type OutputBlock = {
  id: string;
  label: string;
  kind: OutputBlockKind;
  lines: string[];
};

export type FormattedOutput = {
  blocks: OutputBlock[];
};

const hashtagPattern = /#[\p{L}\p{N}_]+/gu;

function cleanDisplayText(value: unknown) {
  try {
    return normaliseCopyText(value);
  } catch {
    return "";
  }
}

function splitParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function cleanLine(value: string) {
  return value.replace(/^[-*]\s+/, "").trim();
}

function splitLines(value: string) {
  return value
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isHashtagLine(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed.match(hashtagPattern)) && trimmed.replace(hashtagPattern, "").replace(/[,\s]/g, "") === "";
}

function extractHashtags(values: string[]) {
  return unique(values.flatMap((value) => value.match(hashtagPattern) ?? []));
}

function removeHashtagOnlyLines(value: string) {
  return value
    .split("\n")
    .filter((line) => !isHashtagLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeHashtagTokens(value: string) {
  return value
    .replace(hashtagPattern, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripLeadingLabel(value: string) {
  return value.replace(/^[A-Z][A-Za-z ]{1,24}\s*[:\-]\s*/, "").trim();
}

function splitTagItem(value: string) {
  const hashtags = value.match(hashtagPattern);

  if (hashtags?.length) {
    return hashtags;
  }

  return stripLeadingLabel(value)
    .split(/[,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function extractLabeledLine(lines: string[], labels: string[]) {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`^(${labelPattern})\\s*[:\\-]\\s*(.+)$`, "i");
  const foundIndex = lines.findIndex((line) => pattern.test(line));

  if (foundIndex < 0) {
    return { value: "", lines };
  }

  const match = lines[foundIndex].match(pattern);
  return {
    value: match?.[2]?.trim() ?? "",
    lines: lines.filter((_, index) => index !== foundIndex)
  };
}

function numberedLines(values: string[]) {
  return values
    .flatMap(splitLines)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function baseBody(section: GeneratedSection) {
  return cleanDisplayText((section as unknown as { body?: unknown }).body);
}

function baseItems(section: GeneratedSection) {
  const items = (section as unknown as { items?: unknown }).items;
  return Array.isArray(items)
    ? items.map(cleanDisplayText).filter(Boolean)
    : splitLines(cleanDisplayText(items));
}

function baseCta(section: GeneratedSection) {
  return cleanDisplayText((section as unknown as { cta?: unknown }).cta);
}

function makeBlock(kind: OutputBlockKind, label: string, lines: string[]): OutputBlock | null {
  const cleanedLines = lines.map((line) => line.trim()).filter(Boolean);

  if (!cleanedLines.length) {
    return null;
  }

  return {
    id: `${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind,
    label,
    lines: cleanedLines
  };
}

function compact(blocks: Array<OutputBlock | null>) {
  return blocks.filter((block): block is OutputBlock => Boolean(block));
}

function formatCaption(section: GeneratedSection, label: string) {
  const body = baseBody(section);
  const items = baseItems(section);
  const cta = baseCta(section);
  const hashtags = unique([
    ...extractHashtags([body]),
    ...items.filter((item) => isHashtagLine(item) || item.includes("#")).flatMap((item) => item.match(hashtagPattern) ?? [])
  ]);
  const captionItems = items.filter((item) => !isHashtagLine(item) && !item.includes("#"));
  const captionBody = removeHashtagTokens(removeHashtagOnlyLines(body));
  const paragraphs = splitParagraphs(captionBody);
  const hook = paragraphs[0] ?? "";
  const rest = paragraphs.slice(1);

  return {
    blocks: compact([
      makeBlock("hook", "Opening hook", hook ? [hook] : []),
      makeBlock("body", label, rest.length ? rest : captionBody && !hook ? [captionBody] : []),
      makeBlock("items", "Caption notes", captionItems),
      makeBlock("hashtags", "Hashtags", hashtags),
      makeBlock("cta", "CTA", cta ? [cta] : [])
    ])
  };
}

function formatThread(section: GeneratedSection) {
  const body = baseBody(section);
  const items = numberedLines(baseItems(section));
  const cta = baseCta(section);
  const tweets = items.length ? items : numberedLines(splitParagraphs(body));

  return {
    blocks: compact([
      makeBlock("hook", "Thread opener", body && items.length ? [splitParagraphs(body)[0] ?? body] : []),
      makeBlock("thread", "Thread", tweets),
      makeBlock("cta", "Final CTA", cta ? [cta] : [])
    ])
  };
}

function formatTwitterPost(section: GeneratedSection) {
  const body = removeHashtagOnlyLines(baseBody(section));
  const items = baseItems(section);
  const hashtags = extractHashtags([baseBody(section), ...items]);
  const cta = baseCta(section);

  return {
    blocks: compact([
      makeBlock("body", "X/Twitter post", splitParagraphs(body)),
      makeBlock("hashtags", "Hashtags", hashtags),
      makeBlock("cta", "CTA", cta ? [cta] : [])
    ])
  };
}

function formatFacebook(section: GeneratedSection) {
  const body = removeHashtagOnlyLines(baseBody(section));
  const items = baseItems(section);
  const hashtags = extractHashtags([baseBody(section), ...items]);
  const cta = baseCta(section);

  return {
    blocks: compact([
      makeBlock("body", "Facebook post", splitParagraphs(body)),
      makeBlock("items", "Post notes", items.filter((item) => !item.includes("#"))),
      makeBlock("cta", "CTA", cta ? [cta] : []),
      makeBlock("hashtags", "Hashtags", hashtags)
    ])
  };
}

function formatYouTube(section: GeneratedSection) {
  const bodyLines = splitLines(baseBody(section));
  const title = extractLabeledLine(bodyLines, ["Title", "Video title", "Shorts title", "Caption idea"]);
  const description = extractLabeledLine(title.lines, ["Description", "Short description"]);
  const items = baseItems(section);
  const tagItems = items.filter((item) => item.includes("#") || /tag|keyword/i.test(item));
  const tags = unique([
    ...extractHashtags([baseBody(section), ...items]),
    ...tagItems.flatMap(splitTagItem)
  ]);
  const supportItems = items.filter((item) => !tagItems.includes(item));
  const cta = baseCta(section);

  return {
    blocks: compact([
      makeBlock("title", "Title", title.value ? [title.value] : []),
      makeBlock("body", "Description", description.value ? [description.value] : splitParagraphs(description.lines.join("\n"))),
      makeBlock("items", "Shorts notes", supportItems),
      makeBlock("tags", "Tags and keywords", tags),
      makeBlock("cta", "CTA", cta ? [cta] : [])
    ])
  };
}

function formatEmail(section: GeneratedSection) {
  const bodyLines = splitLines(baseBody(section));
  const subject = extractLabeledLine(bodyLines, ["Subject", "Subject line", "Subject option"]);
  const preview = extractLabeledLine(subject.lines, ["Preview", "Preview text", "Opening line", "Preheader"]);
  const itemSubjects = baseItems(section)
    .filter((item) => /^subject/i.test(item))
    .map(stripLeadingLabel);
  const supportItems = baseItems(section).filter((item) => !/^subject/i.test(item));
  const cta = baseCta(section);

  return {
    blocks: compact([
      makeBlock("subject", "Subject line", subject.value ? [subject.value] : itemSubjects),
      makeBlock("preview", "Preview line", preview.value ? [preview.value] : []),
      makeBlock("body", "Email body", splitParagraphs(preview.lines.join("\n"))),
      makeBlock("items", "Email notes", supportItems),
      makeBlock("cta", "CTA / sign-off", cta ? [cta] : [])
    ])
  };
}

function formatLinkedIn(section: GeneratedSection) {
  const body = baseBody(section);
  const cta = baseCta(section);
  const items = baseItems(section);
  const paragraphs = splitParagraphs(body);

  return {
    blocks: compact([
      makeBlock("hook", "Opening line", paragraphs[0] ? [paragraphs[0]] : []),
      makeBlock("body", "Post body", paragraphs.slice(1)),
      makeBlock("items", "Structure notes", items),
      makeBlock("cta", "CTA", cta ? [cta] : [])
    ])
  };
}

function formatDefault(section: GeneratedSection) {
  const body = baseBody(section);
  const items = baseItems(section);
  const cta = baseCta(section);

  return {
    blocks: compact([
      makeBlock("body", "Content", splitParagraphs(body)),
      makeBlock("items", "Details", items),
      makeBlock("cta", "CTA", cta ? [cta] : [])
    ])
  };
}

export function formatOutputSection(section: GeneratedSection): FormattedOutput {
  const formatters: Partial<Record<ContentTypeId, () => FormattedOutput>> = {
    linkedin: () => formatLinkedIn(section),
    instagram: () => formatCaption(section, "Caption body"),
    tiktok: () => formatCaption(section, "Caption body"),
    twitter: () => formatTwitterPost(section),
    xThread: () => formatThread(section),
    facebook: () => formatFacebook(section),
    youtubeShorts: () => formatYouTube(section),
    emailNewsletter: () => formatEmail(section)
  };

  return formatters[section.type]?.() ?? formatDefault(section);
}
