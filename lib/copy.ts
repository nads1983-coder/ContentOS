import { formatSectionPlainText } from "./output-format";
import { cleanPlainText } from "./text-normalize";
import type { GeneratedSection } from "../types/content";

type CopyOptions = {
  allowImagePrompt?: boolean;
  sourceText?: string;
};

type RecordValue = Record<string, unknown>;

const textKeys = [
  "text",
  "content",
  "body",
  "caption",
  "post",
  "thread",
  "prompt",
  "value",
  "copy",
  "script",
  "outline",
  "description",
  "cta"
];

const collectionKeys = [
  "items",
  "sections",
  "slides",
  "tweets",
  "posts",
  "captions",
  "bullets",
  "lines",
  "steps"
];

const textishKeyPattern =
  /(text|content|body|caption|post|thread|prompt|copy|script|outline|description|cta|carousel|slide|tweet|facebook|linkedin|instagram|tiktok|youtube|twitter|^x(?:post|thread|tweet)?$)/i;

const blockedKeyPattern =
  /(url|uri|href|src|image|media|asset|blob|file|download|thumbnail|id|created|updated|platform|type|tone|style|format|size|metadata|meta|title|summary|source)/i;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGeneratedSection(value: RecordValue) {
  return typeof value.type === "string" && (
    typeof value.body === "string" ||
    Array.isArray(value.items) ||
    typeof value.cta === "string"
  );
}

function canUseKey(key: string, options: CopyOptions) {
  if (options.allowImagePrompt && /^(imagePrompt|prompt)$/i.test(key)) {
    return true;
  }

  return !blockedKeyPattern.test(key);
}

function isLikelyTextKey(key: string, options: CopyOptions) {
  if (!canUseKey(key, options)) {
    return false;
  }

  return textKeys.includes(key) || textishKeyPattern.test(key);
}

function cleanTextSegment(value: string) {
  const cleaned = cleanPlainText(
    value
    .replace(/\[object Object\]/g, "")
    .replace(/\bblob:[^\s]+/gi, "")
    .replace(/\bdata:image\/[^\s]+/gi, "")
    .replace(/\b\/_next\/[^\s]+/g, "")
    .replace(/\b\/api\/[^\s]+/g, "")
  );

  if (/^(blob:|data:image\/|https?:\/\/[^/\s]*(?:\/_next\/|\/api\/)|\/_next\/|\/api\/)/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function collectTextSegments(
  value: unknown,
  options: CopyOptions,
  seen: WeakSet<object>
): string[] {
  if (typeof value === "string") {
    const cleaned = cleanTextSegment(value);
    return cleaned ? [cleaned] : [];
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextSegments(item, options, seen));
  }

  if (!isRecord(value)) {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  const entries = Object.entries(value);
  const normalizedEntries = entries.map(([key, entryValue]) => [
    key,
    key.replace(/[_-]/g, "").toLowerCase(),
    entryValue
  ] as const);

  const directText = textKeys.flatMap((textKey) =>
    normalizedEntries
      .filter(([, normalizedKey]) => normalizedKey === textKey.toLowerCase())
      .flatMap(([key, , entryValue]) =>
        canUseKey(key, options)
          ? collectTextSegments(entryValue, options, seen)
          : []
      )
  );

  const collections = collectionKeys.flatMap((collectionKey) =>
    normalizedEntries
      .filter(([, normalizedKey]) => normalizedKey === collectionKey.toLowerCase())
      .flatMap(([key, , entryValue]) =>
        canUseKey(key, options)
          ? collectTextSegments(entryValue, options, seen)
          : []
      )
  );

  if (directText.length || collections.length) {
    return [...directText, ...collections];
  }

  return entries.flatMap(([key, entryValue]) =>
    isLikelyTextKey(key, options)
      ? collectTextSegments(entryValue, options, seen)
      : []
  );
}

export function normaliseCopyText(value: unknown, options: CopyOptions = {}) {
  const text = collectTextSegments(value, options, new WeakSet())
    .map(cleanTextSegment)
    .filter(Boolean)
    .join("\n\n");
  const cleaned = cleanTextSegment(text);

  if (!cleaned) {
    throw new Error("No clean text is available to copy.");
  }

  return cleaned;
}

function tryNormaliseCopyText(value: unknown, options: CopyOptions) {
  try {
    return normaliseCopyText(value, options);
  } catch {
    return "";
  }
}

export function buildSectionCopyText(section: unknown, options: CopyOptions = {}) {
  if (!isRecord(section)) {
    return normaliseCopyText(section, options);
  }

  if (isGeneratedSection(section)) {
    const formattedText = formatSectionPlainText(section as unknown as GeneratedSection, options.sourceText);

    if (formattedText) {
      return formattedText;
    }
  }

  const itemsText = Array.isArray(section.items)
    ? section.items.map((item) => typeof item === "string" ? cleanTextSegment(item) : "").filter(Boolean).join("\n")
    : tryNormaliseCopyText(section.items, options);

  const parts = [
    tryNormaliseCopyText(
      {
        text: section.text,
        content: section.content,
        body: section.body,
        caption: section.caption,
        post: section.post,
        thread: section.thread,
        prompt: section.prompt,
        script: section.script,
        outline: section.outline
      },
      options
    ),
    tryNormaliseCopyText(section.cta, options),
    itemsText
  ].filter(Boolean);

  if (!parts.length) {
    return normaliseCopyText(section, options);
  }

  return cleanTextSegment(parts.join("\n\n"));
}

export function buildGenerationCopyText(value: unknown, options: CopyOptions = {}) {
  if (isRecord(value) && Array.isArray(value.sections)) {
    const sourceText = typeof value.source === "string" ? value.source : options.sourceText;

    return normaliseCopyText(
      value.sections.map((section) => buildSectionCopyText(section, { ...options, sourceText })),
      options
    );
  }

  return normaliseCopyText(value, options);
}

export async function copyPlainText(value: unknown, options: CopyOptions = {}) {
  const text = normaliseCopyText(value, options);
  await navigator.clipboard.writeText(text);
  return text;
}
