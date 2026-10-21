import type { SocialImageFormat, SocialImageStyle, SocialImageTemplate } from "@/lib/social-image";

export const IMAGE_STYLES = ["minimal", "premium", "corporate", "bold", "dark", "modern"] as const;
export const IMAGE_FORMATS = ["square", "landscape", "portrait", "vertical"] as const;

export function isImageContentType(contentType: string): boolean {
  return contentType.replace(/[\s_-]/g, "").toLowerCase() !== "platformhashtags";
}
export const IMAGE_LIMITS = {
  monthlyCredits: 100,
  requestBytes: 64_000,
  requestReadMs: 10_000,
  providerMs: 90_000,
  providerBytes: 5_000_000,
  backgroundBase64Characters: 3_500_000,
  resultBytes: 4_000_000
} as const;

export class ImageGenerationError extends Error {
  constructor(message: string, public status = 400, public code = "invalid_image_request", public retryAfterSeconds?: number) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export type ImageGenerationInput = {
  requestId: string;
  outputText: string;
  platform: string;
  contentType: string;
  style: SocialImageStyle;
  format: SocialImageFormat;
  brandContext: {
    brandName: string; audience: string; offer: string; writingStyle: string;
    contentGoal: string; brandColors: string; visualStyle: string; contentTopic: string;
  };
};

export type ImageGenerationResult = {
  image: string;
  mimeType: "image/svg+xml";
  size: string;
  style: SocialImageStyle;
  format: SocialImageFormat;
  template: SocialImageTemplate;
  imageCreditsLimit: number;
  creditCharged: boolean;
  warning?: string;
  createdAt: string;
};

export function isImageRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new ImageGenerationError("Image input is missing, invalid, or too large.");
  }
  return value.trim();
}
function option<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (!choices.includes(value as T)) throw new ImageGenerationError("Invalid image style or format.");
  return value as T;
}
export function validateImageRequestId(value: unknown): string {
  const id = text(value, 36, true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ImageGenerationError("A UUID requestId is required.", 400, "invalid_request_id");
  }
  return id.toLowerCase();
}
export function normalizeImageRequest(value: unknown): ImageGenerationInput {
  if (!isImageRecord(value)) throw new ImageGenerationError("Invalid image request.");
  const brand = value.brandContext ?? {};
  if (!isImageRecord(brand)) throw new ImageGenerationError("Invalid brand context.");
  const contentType = text(value.contentType, 80);
  if (!isImageContentType(contentType)) {
    throw new ImageGenerationError("Hashtag and keyword sets are caption text. Choose a post or caption to create an image.", 400, "non_visual_content");
  }
  return {
    requestId: validateImageRequestId(value.requestId),
    outputText: text(value.outputText, 2600, true),
    platform: text(value.platform, 80), contentType,
    style: option(value.style, IMAGE_STYLES, "premium"),
    format: option(value.format, IMAGE_FORMATS, "square"),
    brandContext: {
      brandName: text(brand.brandName, 140), audience: text(brand.audience, 220),
      offer: text(brand.offer, 220), writingStyle: text(brand.writingStyle, 180),
      contentGoal: text(brand.contentGoal, 180), brandColors: text(brand.brandColors, 180),
      visualStyle: text(brand.visualStyle, 180), contentTopic: text(brand.contentTopic, 180)
    }
  };
}

// Both incoming requests and provider JSON are streamed under byte/deadline bounds.
export async function readImageJson(input: Request | Response, maxBytes: number, timeoutMs: number = IMAGE_LIMITS.requestReadMs): Promise<unknown> {
  const declared = input.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new ImageGenerationError("Image payload is too large.", 413);
  const reader = input.body?.getReader();
  if (!reader) throw new ImageGenerationError("Missing image payload.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ImageGenerationError("Image payload timed out.", 408));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new ImageGenerationError("Image payload is too large.", 413);
      chunks.push(chunk.value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof ImageGenerationError) throw error;
    throw new ImageGenerationError("Invalid image JSON.");
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export function imageBackgroundFromResponse(value: unknown): string | undefined {
  if (!isImageRecord(value) || !Array.isArray(value.data) || value.data.length !== 1) return;
  const item = value.data[0];
  if (!isImageRecord(item) || typeof item.b64_json !== "string") return;
  const base64 = item.b64_json;
  if (!base64.length || base64.length > IMAGE_LIMITS.backgroundBase64Characters || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return;
  if (Buffer.from(base64.slice(0, 12), "base64").subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return;
  // Never follow provider-supplied URLs or persist expiring external URLs.
  return `data:image/png;base64,${base64}`;
}

export function validateImageResult(value: unknown): ImageGenerationResult {
  if (!isImageRecord(value)) throw new ImageGenerationError("Invalid image result.", 502, "invalid_image_result");
  const templates = ["linkedin_graphic", "instagram_square", "instagram_portrait", "blog_hero", "short_cover", "carousel_cover", "authority_quote", "dark_editorial", "clean_creator"];
  const sizes: Record<SocialImageFormat, string> = { square: "1080x1080", landscape: "1536x864", portrait: "1080x1350", vertical: "1080x1920" };
  if (typeof value.image !== "string" || !value.image.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg") ||
      value.mimeType !== "image/svg+xml" || !IMAGE_STYLES.includes(value.style as SocialImageStyle) ||
      !IMAGE_FORMATS.includes(value.format as SocialImageFormat) || value.size !== sizes[value.format as SocialImageFormat] ||
      !templates.includes(value.template as string) || value.imageCreditsLimit !== IMAGE_LIMITS.monthlyCredits ||
      typeof value.creditCharged !== "boolean" || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
      (value.warning !== undefined && (typeof value.warning !== "string" || value.warning.length > 1000))) {
    throw new ImageGenerationError("Invalid image result.", 502, "invalid_image_result");
  }
  const result: ImageGenerationResult = {
    image: value.image, mimeType: "image/svg+xml", size: value.size as string,
    style: value.style as SocialImageStyle, format: value.format as SocialImageFormat,
    template: value.template as SocialImageTemplate, imageCreditsLimit: IMAGE_LIMITS.monthlyCredits,
    creditCharged: value.creditCharged, createdAt: value.createdAt,
    ...(value.warning ? { warning: value.warning as string } : {})
  };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > IMAGE_LIMITS.resultBytes) {
    throw new ImageGenerationError("Image is too large to retain safely.", 502, "image_result_too_large");
  }
  return result;
}
