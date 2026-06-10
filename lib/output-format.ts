import { normaliseCopyText } from "./copy";
import { cleanPlainText, normalizePlainTextLines } from "./text-normalize";
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
  | "items"
  | "platform";

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
  return cleanPlainText(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function cleanLine(value: string) {
  return value.replace(/^[-*]\s+/, "").trim();
}

function splitLines(value: string) {
  return cleanPlainText(value)
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
  return cleanPlainText(value)
    .split("\n")
    .filter((line) => !isHashtagLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function removeHashtagTokens(value: string) {
  return cleanPlainText(value)
    .replace(hashtagPattern, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

function stripLeadingLabel(value: string) {
  return value.replace(/^[A-Z][A-Za-z ]{1,24}\s*[:-]\s*/, "").trim();
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

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function fallbackFromSource(source: string | undefined, type: ContentTypeId) {
  const cleaned = cleanDisplayText(source)
    .replace(hashtagPattern, "")
    .split(/\n{2,}|\.\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, type === "tiktok" ? 1 : 2)
    .join(". ");

  if (!cleaned) {
    return type === "tiktok"
      ? "A quick caption based on the source idea."
      : "A practical caption based on the source idea.\n\nUse this as a cleaner starting point.";
  }

  const ending = /[.!?]$/.test(cleaned) ? "" : ".";
  return type === "tiktok" ? `${cleaned}${ending}`.slice(0, 180) : `${cleaned}${ending}`;
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
  const cleanedLines = normalizePlainTextLines(lines);

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

function formatCaption(section: GeneratedSection, label: string, source?: string) {
  const body = baseBody(section);
  const items = baseItems(section);
  const cta = baseCta(section);
  const hashtags = unique([
    ...extractHashtags([body]),
    ...items.filter((item) => isHashtagLine(item) || item.includes("#")).flatMap((item) => item.match(hashtagPattern) ?? [])
  ]);
  const captionItems = items.filter((item) => !isHashtagLine(item) && !item.includes("#"));
  const cleanedCaptionBody = removeHashtagTokens(removeHashtagOnlyLines(body));
  const captionBody = countWords(cleanedCaptionBody) >= 7
    ? cleanedCaptionBody
    : fallbackFromSource(source, section.type);
  const paragraphs = splitParagraphs(captionBody);
  const hook = paragraphs.length > 1 ? paragraphs[0] : "";
  const bodyLines = paragraphs.length > 1 ? paragraphs.slice(1) : paragraphs;

  return {
    blocks: compact([
      makeBlock("hook", "Opening hook", hook ? [hook] : []),
      makeBlock("body", label, bodyLines),
      makeBlock("items", "Caption notes", captionItems),
      makeBlock("hashtags", "Hashtags", hashtags),
      makeBlock("cta", "CTA", cta ? [cta] : [])
    ])
  };
}

const platformLabels = [
  "LinkedIn",
  "Instagram",
  "TikTok",
  "X/Twitter",
  "Twitter",
  "X",
  "Facebook",
  "YouTube Shorts",
  "YouTube",
  "Email",
  "Newsletter",
  "Carousel",
  "Thread",
  "Short Video Script",
  "Video Script"
];

function normalizePlatformLabel(value: string) {
  if (/^x$/i.test(value) || /^twitter$/i.test(value)) {
    return "X/Twitter";
  }

  if (/^youtube$/i.test(value)) {
    return "YouTube Shorts";
  }

  if (/^newsletter$/i.test(value)) {
    return "Email";
  }

  return value;
}

function splitPlatformSections(values: string[]) {
  const labelAlternates = platformLabels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(
    `^(?:#{1,3}\\s*)?(?:\\*\\*)?(${labelAlternates})(?:\\*\\*)?\\s*[:\\-]?\\s*(.*)$`,
    "i"
  );
  const inlinePattern = new RegExp(`\\s+(?=(${labelAlternates})\\s*[:\\-])`, "gi");
  const sections: Array<{ label: string; lines: string[] }> = [];

  values
    .flatMap((value) => splitLines(value.replace(inlinePattern, "\n")))
    .forEach((line) => {
      const match = line.match(pattern);

      if (match) {
        sections.push({
          label: normalizePlatformLabel(match[1]),
          lines: match[2]?.trim() ? [stripLeadingLabel(match[2])] : []
        });
        return;
      }

      if (sections.length) {
        sections[sections.length - 1].lines.push(line);
      }
    });

  return sections
    .map((section) => ({
      ...section,
      lines: section.lines.map((line) => line.trim()).filter(Boolean)
    }))
    .filter((section) => section.lines.length);
}

function formatRepurposePack(section: GeneratedSection) {
  const platformSections = splitPlatformSections([
    baseBody(section),
    ...baseItems(section)
  ]);
  const cta = baseCta(section);

  if (!platformSections.length) {
    return formatDefault(section);
  }

  return {
    blocks: compact([
      ...platformSections.map((item) => makeBlock("platform", item.label, item.lines)),
      makeBlock("cta", "Pack CTA", cta ? [cta] : [])
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
      makeBlock("title", "YouTube Shorts title", title.value ? [title.value] : []),
      makeBlock("body", "Shorts description", description.value ? [description.value] : splitParagraphs(description.lines.join("\n"))),
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
      makeBlock("subject", itemSubjects.length > 1 ? "Subject options" : "Subject line", subject.value ? [subject.value] : itemSubjects),
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

function formatPlatformHashtags(section: GeneratedSection) {
  const platformSets = splitPlatformSections([
    baseBody(section),
    ...baseItems(section)
  ]);

  if (!platformSets.length) {
    return formatDefault(section);
  }

  return {
    blocks: platformSets.map((set) => ({
      id: `tags-${set.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind: "tags" as const,
      label: set.label,
      lines: unique(set.lines.flatMap(splitTagItem))
    }))
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

export function formatOutputSection(section: GeneratedSection, source?: string): FormattedOutput {
  const formatters: Partial<Record<ContentTypeId, () => FormattedOutput>> = {
    linkedin: () => formatLinkedIn(section),
    instagram: () => formatCaption(section, "Caption body", source),
    tiktok: () => formatCaption(section, "Caption body", source),
    twitter: () => formatTwitterPost(section),
    xThread: () => formatThread(section),
    facebook: () => formatFacebook(section),
    youtubeShorts: () => formatYouTube(section),
    emailNewsletter: () => formatEmail(section),
    repurposePack: () => formatRepurposePack(section),
    platformHashtags: () => formatPlatformHashtags(section)
  };

  return formatters[section.type]?.() ?? formatDefault(section);
}
