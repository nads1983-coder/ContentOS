import type { BuildPosterInput } from "@/lib/social-image";
import { brandContextScope, styleContext } from "@/lib/brand-context";
import { imageCompositionPrompt } from "@/lib/image-composition";

export const IMAGE_MODES = ["auto", "image", "text", "mixed"] as const;
export type ImageMode = typeof IMAGE_MODES[number];
export type ImageDesign = {
  mode: Exclude<ImageMode, "auto">;
  headline: string; body: string; brand: string;
  background: string; accent: string;
  align: "left" | "center"; font: "sans" | "editorial";
};

// Image-only projection. The source caption is never rewritten.
export function imageCopy(value: string, max = 1200): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Plain text need not be URI encoded. */ }
  return decoded.replace(/&amp;/g, "&").replace(/&#(?:0*35|x0*23);/gi, "#")
    .replace(/<[^>]*>/g, "").replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[#＃][\p{L}\p{M}\p{N}_]+/gu, "")
    .replace(/[#＃]/g, "")
    .replace(/^\s*(?:hashtags?|keywords?|tags)\s*:.*$/gim, "")
    .replace(/[ \t]+/g, " ").trim().slice(0, max);
}
const colours: Record<string, string> = {
  black: "#111116", white: "#ffffff", cream: "#fff7e8", gold: "#b58a30",
  purple: "#7450c8", violet: "#7450c8", blue: "#2356bc", navy: "#172438",
  green: "#176d51", teal: "#087e83", red: "#b42a42", pink: "#e9a9c0",
  orange: "#de6927", yellow: "#f1d34f", grey: "#737780", gray: "#737780"
};
function palette(value: string): string[] {
  return [...value.toLowerCase().matchAll(/#(?:[a-f0-9]{6}|[a-f0-9]{3})\b|\b(?:black|white|cream|gold|purple|violet|blue|navy|green|teal|red|pink|orange|yellow|grey|gray)\b/g)]
    .map(([c]) => colours[c] ?? (c.length === 4 ? `#${[...c.slice(1)].map(x => x + x).join("")}` : c));
}
function shorten(value: string, max: number): string {
  const clean = imageCopy(value).replace(/^(?:hook|headline|caption|body|post|title)\s*:\s*/i, "").replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 3);
  return `${clipped.slice(0, Math.max(clipped.lastIndexOf(" "), Math.floor(max / 2)))}...`;
}
function directive(value: string, label: string): string | undefined {
  const nextLabel = "headline|quote|support(?:ing text)?|brand(?: name)?";
  return value.match(new RegExp(`(?:^|\\n|[.!?;]\\s+)\\s*(?:${label})\\s*:\\s*([^\\n]+?)(?=\\n|[.!?;]\\s+(?:${nextLabel})\\s*:|$)`, "i"))?.[1]?.replace(/^["“]|["”]$/g, "");
}

export function buildCreativeBrief(input: BuildPosterInput) {
  const instructions = imageCopy(input.creativeInstructions ?? "", 600);
  const source = imageCopy(input.outputText, 1200), brand = input.brandContext;
  const scope = brandContextScope({ source: input.outputText, brandName: brand.brandName, refinement: { instructions: input.creativeInstructions } });
  const appearance = input.appearance;
  const visualType = appearance?.type !== "auto" && appearance?.type ? appearance.type :
    /\b(?:graphic|poster|announcement card)\b/i.test(instructions) ? "graphic" :
    /\b(?:illustration|illustrated|hand-drawn)\b/i.test(instructions) ? "illustration" :
    /\b(?:photograph|photography|photo)\b/i.test(instructions) ? "photograph" : "auto";
  const selectedStyle = appearance?.style && appearance.style !== "auto" ? appearance.style : "";
  const savedVisual = styleContext(brand.visualStyle ?? input.style, brand.brandName ?? "", scope.identity);
  const direction = [instructions, selectedStyle ? `Selected style: ${selectedStyle}` : ""].filter(Boolean).join(". ") || imageCopy(savedVisual, 180);
  const instructionOnly = Boolean(input.creativeInstructions?.trim()) && input.outputText.trim() === input.creativeInstructions?.trim();
  const modeHint = instructions || `${savedVisual} ${source}`;
  const noText = /\b(?:no text|without text|textless|image only)\b/i.test(instructions);
  const textRequested = /\b(?:headline|quote|typography|text only|text-only)\b/i.test(instructions);
  const requested = input.mode ?? "auto";
  let mode: ImageDesign["mode"] = requested === "auto"
    ? noText ? "image" : /\b(?:quote|typography|text only|text-only)\b/i.test(modeHint) ? "text"
      : (/\b(?:photograph|photography|illustration|landscape|portrait of|cinematic scene)\b/i.test(modeHint) || instructionOnly) && !textRequested ? "image" : "mixed"
    : requested;
  if (noText && requested !== "text") mode = "image";
  else if (mode === "image" && textRequested) mode = "mixed";
  const explicitPalette = palette(input.creativeInstructions ?? "");
  const selected = appearance?.colours.length ? appearance.colours : explicitPalette.length ? explicitPalette : palette(brand.brandColors ?? "");
  const paragraphs = source.split(/\n+/).map(s => s.trim()).filter(s => s && !/^(?:cta|call to action)\s*:/i.test(s));
  const headline = shorten(directive(instructions, "headline|quote") ?? (instructionOnly ? "" : paragraphs[0]?.split(/(?<=[.!?])\s+/)[0]) ?? "", 68);
  const supporting = directive(instructions, "support(?:ing text)?") ?? (instructionOnly ? "" : paragraphs.slice(1).find(s => !s.includes(headline))) ?? "";
  const defaults = { minimal: ["#ffffff", "#111116"], premium: ["#ffffff", "#245c4a"], corporate: ["#ffffff", "#2356bc"],
    bold: ["#f1d34f", "#111116"], dark: ["#111116", "#a88ee5"], modern: ["#ffffff", "#087e83"] }[input.style];
  const design: ImageDesign = {
    mode, headline, body: shorten(supporting, 120), brand: shorten(directive(instructions, "brand(?: name)?") ?? (scope.identity ? brand.brandName ?? "" : ""), 36),
    background: selected[0] ?? defaults[0], accent: selected[1] ?? defaults[1],
    align: /\bcent(?:er|re)(?:d)?\b/i.test(instructions) ? "center" : "left",
    font: /\b(?:luxury|elegant|serif|editorial)\b/i.test(selectedStyle || direction) ? "editorial" : "sans"
  };
  if (design.body === design.headline) design.body = "";
  const composition = imageCompositionPrompt(source, instructions, mode === "mixed");
  return { design, source, direction, prompt: [
    "Create one original, conceptually relevant social visual. Do not reproduce a caption or a generic SaaS background.",
    `Content meaning (context, not text to draw): ${source}`,
    `Creative direction (takes precedence over saved preferences): ${direction}`,
    `Image type: ${visualType === "auto" ? "Infer from the description and source." : visualType}. ${visualType === "graphic" ? "Use graphic design, not photography or unrelated people." : visualType === "illustration" ? "Use an illustrated composition, not photography." : visualType === "photograph" ? "Use natural photography, not vector graphics." : ""}`,
    "Selected type, style and palette override inferred or saved defaults. Other explicit description instructions must be respected. Do not add unrelated people or objects.",
    `Saved visual preference (only when not overridden): ${imageCopy(savedVisual, 180)}`,
    `Subject context: ${scope.identity ? `Industry: ${imageCopy(brand.industry ?? "", 180)}. Audience: ${imageCopy(brand.audience ?? "", 220)}.` : "Use the current description, not the saved brand industry or audience."}`,
    `Style only: ${imageCopy(styleContext(brand.writingStyle ?? "", brand.brandName ?? "", scope.identity), 180)}.`,
    "Saved colours and style are aesthetic preferences, not permission to add a brand, product, competition, offer or promotional subject.",
    `Palette: ${design.background.replace("#", "hex ")}, ${design.accent.replace("#", "hex ")}.`,
    `Platform: ${imageCopy(input.platform, 80)}. Orientation: ${input.format}.`,
    composition || (mode === "mixed" ? "Keep the subject in the upper half; the app adds a solid text panel in the lower half. Keep the focal point clear of that panel." : "Use a clear focal point and full-frame composition. Natural, well-lit subjects with meaningful context."),
    "Mandatory: no visible text, letters, captions, hashtag symbols, typography, watermarks, logos, signage or UI. All requested words are rendered separately by the app.",
    "Do not invent products, packaging, logos, business facts, offers or brand assets. Depict concepts rather than fabricate a branded product. No decorative orbs."
  ].join("\n") };
}

export function normaliseDesign(value: unknown): ImageDesign {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid design");
  const v = value as Record<string, unknown>;
  if (!["image", "text", "mixed"].includes(String(v.mode)) || !["left", "center"].includes(String(v.align)) ||
      !["sans", "editorial"].includes(String(v.font)) || ![v.background, v.accent].every(c => typeof c === "string" && /^#[a-f0-9]{6}$/i.test(c)) ||
      ![v.headline, v.body, v.brand].every(c => typeof c === "string" && c.length <= 200)) throw new Error("Invalid design");
  return { mode: v.mode as ImageDesign["mode"], align: v.align as ImageDesign["align"], font: v.font as ImageDesign["font"],
    background: v.background as string, accent: v.accent as string,
    headline: shorten(v.headline as string, 68), body: shorten(v.body as string, 120), brand: shorten(v.brand as string, 36) };
}
export function foreground(background: string): string {
  const rgb = background.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? "#000000" : "#ffffff";
}
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Conservative glyph advance bound, with font reduction for long unbroken words.
function fittedLines(text: string, width: number, size: number, maxLines: number) {
  let lines: string[] = [];
  const advance = (value: string) => [...value].reduce((total, char) => total + (char === " " ? .35 : /[ilI.,:;!'|]/.test(char) ? .4 : /[MW@%&]/.test(char) ? 1.15 : /[a-z0-9]/i.test(char) ? .8 : 1.25), 0);
  for (; size >= 6; size -= 1) {
    lines = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (advance(next) * size > width && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every(l => advance(l) * size <= width)) break;
  }
  return { lines, size };
}

export function renderDesignSvg(design: ImageDesign, width: number, height: number, backgroundDataUrl?: string) {
  const d = normaliseDesign(design);
  const photo = backgroundDataUrl && /^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(backgroundDataUrl) ? backgroundDataUrl : undefined;
  const margin = Math.ceil(width * .08), textWidth = width - margin * 2;
  const panelY = d.mode === "mixed" && photo ? Math.round(height * .52) : 0, panelHeight = height - panelY;
  const x = d.align === "center" ? width / 2 : margin, color = foreground(d.background);
  const headline = fittedLines(d.headline, textWidth, Math.min(width * (d.mode === "text" ? .09 : .071), panelHeight * .115), 3);
  const body = fittedLines(d.body, textWidth, Math.min(width * .032, panelHeight * .064), 3);
  const brand = fittedLines(d.brand, textWidth, Math.min(26, width * .022), 1);
  const blockHeight = headline.lines.length * headline.size * 1.2 + body.lines.length * body.size * 1.2 + panelHeight * .05;
  const headY = panelY + Math.max(panelHeight * .16, (panelHeight - blockHeight) * .43);
  const bodyY = headY + headline.lines.length * headline.size * 1.2 + panelHeight * .05;
  const text = (lines: string[], y: number, size: number, font: string, weight: number) => `<text fill="${color}" font-family="${font}" font-size="${size}" font-weight="${weight}" text-anchor="${d.align === "center" ? "middle" : "start"}">${lines.map((l, i) => `<tspan x="${x}" y="${y + i * size * 1.2}">${escapeXml(l)}</tspan>`).join("")}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(d.mode === "image" ? "Original social visual" : d.headline)}">
    <rect width="${width}" height="${height}" fill="${d.background}"/>
    ${photo && d.mode !== "text" ? `<image href="${photo}" width="${width}" height="${d.mode === "mixed" ? panelY : height}" preserveAspectRatio="xMidYMid slice"/>` : ""}
    ${d.mode !== "image" ? `<rect y="${panelY}" width="${width}" height="${panelHeight}" fill="${d.background}"/>
    <rect x="${margin}" y="${panelY + panelHeight * .08}" width="${width * .08}" height="6" fill="${d.accent}"/>
    ${text(headline.lines, headY, headline.size, d.font === "editorial" ? "Georgia, serif" : "Arial, sans-serif", 700)}
    ${text(body.lines, bodyY, body.size, "Arial, sans-serif", 400)}
    <text x="${x}" y="${height - panelHeight * .09}" fill="${color}" font-family="Arial, sans-serif" font-size="${brand.size}" text-anchor="${d.align === "center" ? "middle" : "start"}">${escapeXml(d.brand)}</text>` : ""}
  </svg>`;
}

export function backgroundFromDesignImage(image: string): string | undefined {
  if (!image.startsWith("data:image/svg+xml;charset=utf-8,")) return;
  try { return decodeURIComponent(image.split(",").slice(1).join(",")).match(/<image href="(data:image\/png;base64,[a-z0-9+/]+=*)"/i)?.[1]; } catch { return; }
}
