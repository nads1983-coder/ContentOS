export type SocialImageStyle = "minimal" | "premium" | "corporate" | "bold" | "dark" | "modern";
export type SocialImageFormat = "square" | "landscape" | "portrait" | "vertical";
export type SocialImageTemplate =
  | "linkedin_graphic"
  | "instagram_square"
  | "instagram_portrait"
  | "blog_hero"
  | "short_cover"
  | "carousel_cover"
  | "authority_quote"
  | "dark_editorial"
  | "clean_creator";

export type SocialPosterContent = {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  footer: string;
  template: SocialImageTemplate;
  warning?: string;
};

type BrandContext = {
  brandName?: string;
  audience?: string;
  offer?: string;
  writingStyle?: string;
  contentGoal?: string;
  brandColors?: string;
  visualStyle?: string;
  contentTopic?: string;
};

type BuildPosterInput = {
  outputText: string;
  platform: string;
  contentType: string;
  style: SocialImageStyle;
  format: SocialImageFormat;
  brandContext: BrandContext;
};

type RenderPosterInput = {
  content: SocialPosterContent;
  style: SocialImageStyle;
  format: SocialImageFormat;
  backgroundDataUrl?: string;
};

const templateByStyle: Record<SocialImageStyle, SocialImageTemplate> = {
  minimal: "clean_creator",
  premium: "authority_quote",
  corporate: "clean_creator",
  bold: "dark_editorial",
  dark: "dark_editorial",
  modern: "clean_creator"
};

const dimensionsByFormat: Record<SocialImageFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "1080x1080" },
  landscape: { width: 1536, height: 864, label: "1536x864" },
  portrait: { width: 1080, height: 1350, label: "1080x1350" },
  vertical: { width: 1080, height: 1920, label: "1080x1920" }
};

const modelSizeByFormat: Record<SocialImageFormat, string> = {
  square: "1024x1024",
  landscape: "1536x1024",
  portrait: "1024x1536",
  vertical: "1024x1536"
};

export function socialImageCanvasSize(format: SocialImageFormat) {
  return dimensionsByFormat[format] ?? dimensionsByFormat.square;
}

export function socialImageModelSize(format: SocialImageFormat) {
  return modelSizeByFormat[format] ?? modelSizeByFormat.square;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function safeDecode(value: string) {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanText(value: string, maxLength = 2200) {
  return decodeEntities(safeDecode(value))
    .replace(/<[^>]*>/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripLabels(value: string) {
  return value.replace(/^(hook|headline|caption|body|post|cta|hashtags?)\s*:\s*/i, "").trim();
}

function sentenceCase(value: string) {
  const cleaned = stripLabels(value).replace(/^["'“”]+|["'“”]+$/g, "").trim();
  return cleaned ? `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}` : "";
}

function extractHashtags(text: string) {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(matches)).slice(0, 5);
}

function removeHashtagLines(text: string) {
  return text
    .split("\n")
    .filter((line) => !/^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(line.trim()))
    .join("\n")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function firstUsefulLine(lines: string[]) {
  return lines.find((line) => {
    const cleaned = stripLabels(line);
    return cleaned.length >= 12 && !/^[-•\d.)\s]+$/.test(cleaned) && !/^hashtags?/i.test(line);
  });
}

function truncateAtWord(value: string, maxLength: number) {
  const cleaned = value.trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const clipped = cleaned.slice(0, maxLength - 1);
  const boundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, boundary > 40 ? boundary : clipped.length).trim()}...`;
}

function platformTemplate(input: BuildPosterInput): SocialImageTemplate {
  const platform = `${input.platform} ${input.contentType}`.toLowerCase();

  if (/blog|article|hero/.test(platform)) {
    return "blog_hero";
  }

  if (/carousel/.test(platform)) {
    return "carousel_cover";
  }

  if (/tiktok|short|youtube/.test(platform) || input.format === "vertical") {
    return "short_cover";
  }

  if (/instagram/.test(platform)) {
    return input.format === "portrait" ? "instagram_portrait" : "instagram_square";
  }

  if (/linkedin/.test(platform)) {
    return "linkedin_graphic";
  }

  return templateByStyle[input.style] ?? "authority_quote";
}

export function buildSocialPosterContent(input: BuildPosterInput): SocialPosterContent {
  const cleaned = cleanText(input.outputText);
  const withoutHashtags = removeHashtagLines(cleaned);
  const paragraphs = withoutHashtags
    .split(/\n{2,}/)
    .map((item) => item.replace(/\n/g, " ").trim())
    .filter(Boolean);
  const lines = withoutHashtags
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const hookLine = firstUsefulLine(lines) ?? paragraphs[0] ?? input.contentType ?? "Create clearer content";
  const ctaLine = lines.find((line) => /^(cta|call to action)\s*:/i.test(line)) ?? "";
  const brandName = cleanText(input.brandContext.brandName ?? "", 64);
  const footer = brandName || "ContentOS";
  const template = platformTemplate(input);
  const topic = cleanText(input.brandContext.contentTopic ?? "", 120);
  const headline = truncateAtWord(sentenceCase(topic || hookLine), input.format === "vertical" ? 96 : 82);
  const bodySource = paragraphs.find((item) => !item.includes(hookLine) && item.length > 24) ?? paragraphs[1] ?? paragraphs[0] ?? "";
  const body = truncateAtWord(stripLabels(bodySource), input.format === "vertical" ? 190 : input.format === "portrait" ? 205 : 170);
  const cta = truncateAtWord(stripLabels(ctaLine || input.brandContext.contentGoal || ""), 90);
  const hashtags = extractHashtags(cleaned);
  const warning = cleaned.length > 900 ? "Long source content was condensed for image readability." : undefined;

  return {
    headline: headline || "Create clearer content from one idea",
    body: body && body !== headline ? body : "Turn one clear idea into structured, platform-ready content without losing your point of view.",
    cta,
    hashtags,
    footer,
    template,
    warning
  };
}

export function buildTextlessBackgroundPrompt(input: BuildPosterInput) {
  const audience = cleanText(input.brandContext.audience ?? "", 180);
  const offer = cleanText(input.brandContext.offer ?? "", 180);
  const styleNotes = cleanText(input.brandContext.writingStyle ?? "", 160);
  const colors = cleanText(input.brandContext.brandColors ?? "deep black, royal purple, refined gold, warm off-white", 180);
  const visualStyle = cleanText(input.brandContext.visualStyle ?? input.style, 180);
  const topic = cleanText(input.brandContext.contentTopic ?? input.contentType ?? input.outputText, 180);
  const template = platformTemplate(input).replace(/_/g, " ");

  return [
    `Create a premium textless background for a ${template} social media visual.`,
    "CRITICAL: no text, no letters, no typography, no words, no captions, no hashtags, no logos, no symbols, no signage, no UI screenshots.",
    "The image must be a professional background only; all visible text will be rendered later by the app.",
    "Use clean negative space in the central text-safe area, subtle depth, crisp lighting, editorial composition, and modern SaaS polish.",
    "No stock-photo clichés, no low-detail gradients, no cheap clipart, no fake product screenshots, no distorted interface elements.",
    `Visual style: ${visualStyle}.`,
    `Brand palette direction: ${colors}.`,
    `Canvas orientation: ${input.format}.`,
    `Platform context: ${cleanText(input.platform || "social media", 80)}.`,
    `Content topic mood: ${topic}.`,
    audience ? `Audience mood: ${audience}.` : "",
    offer ? `Commercial context: ${offer}.` : "",
    styleNotes ? `Writing style mood: ${styleNotes}.` : "",
    "Avoid people unless they are abstract silhouettes with no identifiable faces.",
    "Avoid busy patterns and high contrast details in the central text-safe area."
  ]
    .filter(Boolean)
    .join("\n");
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = cleanText(value, 1000).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = truncateAtWord(lines[maxLines - 1], Math.max(16, maxChars - 1));
  }

  return lines;
}

function tspans(lines: string[], x: number, y: number, lineHeight: number) {
  return lines
    .map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${xmlEscape(line)}</tspan>`)
    .join("");
}

function fallbackBackground(id: string, template: SocialImageTemplate) {
  const accent = template === "clean_creator" ? "#6d42ff" : "#d9b95f";
  return `
    <defs>
      <radialGradient id="${id}" cx="70%" cy="18%" r="75%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/>
        <stop offset="48%" stop-color="#21103a" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#050409" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
  `;
}

export function renderSocialPosterSvg(input: RenderPosterInput) {
  const { width, height, label } = socialImageCanvasSize(input.format);
  const margin = Math.round(width * 0.08);
  const contentWidth = width - margin * 2;
  const isLandscape = input.format === "landscape";
  const isVertical = input.format === "vertical";
  const isPortrait = input.format === "portrait";
  const headlineSize = input.content.template === "clean_creator"
    ? Math.round(width * (isLandscape ? 0.055 : 0.073))
    : Math.round(width * (isLandscape ? 0.056 : isVertical ? 0.078 : 0.086));
  const bodySize = Math.round(width * (isLandscape ? 0.026 : 0.033));
  const smallSize = Math.round(width * (isLandscape ? 0.019 : 0.024));
  const headlineLines = wrapText(input.content.headline, isLandscape ? 30 : 18, isVertical ? 5 : 4);
  const bodyLines = wrapText(input.content.body, isLandscape ? 64 : 38, isVertical ? 4 : isPortrait ? 5 : 4);
  const ctaLines = input.content.cta ? wrapText(input.content.cta, isLandscape ? 62 : 42, 2) : [];
  const hashtagLine = input.content.hashtags.join(" ");
  const hashtagLines = hashtagLine ? wrapText(hashtagLine, isLandscape ? 70 : 42, 2) : [];
  const headlineY = isLandscape ? Math.round(height * 0.24) : isVertical ? Math.round(height * 0.24) : Math.round(height * 0.26);
  const headlineLineHeight = Math.round(headlineSize * 1.04);
  const bodyY = headlineY + headlineLines.length * headlineLineHeight + Math.round(height * 0.075);
  const bodyLineHeight = Math.round(bodySize * 1.42);
  const ctaY = bodyY + bodyLines.length * bodyLineHeight + Math.round(height * 0.06);
  const footerY = height - Math.round(height * 0.09);
  const bgId = `bg-${input.content.template}`;
  const background = input.backgroundDataUrl
    ? `<image href="${xmlEscape(input.backgroundDataUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
    : fallbackBackground(bgId, input.content.template);
  const overlayOpacity = input.content.template === "clean_creator" ? "0.70" : "0.76";
  const headlineColor = input.content.template === "dark_editorial" ? "#f2df9f" : "#f7f1df";
  const bodyColor = "#f6f0e3";
  const mutedColor = "#c8bed3";

  return {
    size: label,
    mimeType: "image/svg+xml",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xmlEscape(input.content.headline)}">
      ${background}
      <rect width="${width}" height="${height}" fill="#050409" opacity="${overlayOpacity}"/>
      <rect x="${margin * 0.55}" y="${margin * 0.55}" width="${width - margin * 1.1}" height="${height - margin * 1.1}" rx="${Math.round(width * 0.035)}" fill="none" stroke="#ffffff" stroke-opacity="0.11" stroke-width="2"/>
      <circle cx="${width - margin}" cy="${margin}" r="${Math.round(width * 0.16)}" fill="#7c3aed" opacity="0.13"/>
      <text x="${margin}" y="${Math.round(margin * 0.95)}" fill="#d9b95f" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${smallSize}" font-weight="800" letter-spacing="${Math.max(2, Math.round(width * 0.006))}">
        ${xmlEscape(input.content.template.replace(/_/g, " ").toUpperCase())}
      </text>
      <text fill="${headlineColor}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="0">
        ${tspans(headlineLines, margin, headlineY, headlineLineHeight)}
      </text>
      <text fill="${bodyColor}" opacity="0.92" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${bodySize}" font-weight="560">
        ${tspans(bodyLines, margin, bodyY, bodyLineHeight)}
      </text>
      ${ctaLines.length ? `<text fill="#d9b95f" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${Math.round(bodySize * 0.86)}" font-weight="800">${tspans(ctaLines, margin, ctaY, Math.round(bodySize * 1.3))}</text>` : ""}
      ${hashtagLines.length ? `<text fill="${mutedColor}" opacity="0.9" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${smallSize}" font-weight="650">${tspans(hashtagLines, margin, footerY - Math.round(smallSize * 2.2), Math.round(smallSize * 1.35))}</text>` : ""}
      <line x1="${margin}" y1="${footerY - Math.round(smallSize * 1.45)}" x2="${margin + contentWidth}" y2="${footerY - Math.round(smallSize * 1.45)}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>
      <text x="${margin}" y="${footerY}" fill="#f7f1df" opacity="0.92" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${smallSize}" font-weight="800">${xmlEscape(input.content.footer)}</text>
      <text x="${width - margin}" y="${footerY}" text-anchor="end" fill="#d9b95f" opacity="0.9" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${smallSize}" font-weight="800">ContentOS</text>
    </svg>`
  };
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
