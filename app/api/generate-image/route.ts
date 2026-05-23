import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured, isSupabaseAdminConfigured } from "@/lib/env";
import {
  getStripeSubscriptionState,
  normalizePlanId,
  normalizeSubscriptionStatus,
  planHasActiveEntitlement,
  reconcileActiveSubscriptionPlan
} from "@/lib/stripe-rest";
import { getUserProfile, recordUsageEvent, syncUserSubscriptionState } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImageStyle = "minimal" | "premium" | "corporate" | "bold" | "dark" | "modern";
type ImageFormat = "square" | "landscape" | "vertical";

const styles: ImageStyle[] = ["minimal", "premium", "corporate", "bold", "dark", "modern"];
const formats: ImageFormat[] = ["square", "landscape", "vertical"];

const sizeByFormat: Record<ImageFormat, string> = {
  square: "1024x1024",
  landscape: "1536x1024",
  vertical: "1024x1536"
};

function cleanText(value: unknown, maxLength = 1800) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStyle(value: unknown): ImageStyle {
  return styles.includes(value as ImageStyle) ? (value as ImageStyle) : "premium";
}

function normalizeFormat(value: unknown): ImageFormat {
  return formats.includes(value as ImageFormat) ? (value as ImageFormat) : "square";
}

function buildImagePrompt(input: {
  outputText: string;
  platform: string;
  contentType: string;
  style: ImageStyle;
  format: ImageFormat;
  brandName: string;
  audience: string;
  offer: string;
  brandVoice: string;
  contentGoal: string;
}) {
  return [
    "Create a polished production-ready social media visual for ContentOS.",
    "The result should feel like a premium SaaS/content brand asset, not generic AI art.",
    `Platform: ${input.platform || "social media"}.`,
    `Content format: ${input.contentType || "social content"}.`,
    `Visual style: ${input.style}. Canvas: ${input.format}.`,
    input.brandName ? `Brand or business: ${input.brandName}.` : "",
    input.audience ? `Target audience: ${input.audience}.` : "",
    input.offer ? `Offer/product/service: ${input.offer}.` : "",
    input.brandVoice ? `Brand voice: ${input.brandVoice}.` : "",
    input.contentGoal ? `Content goal: ${input.contentGoal}.` : "",
    "Use clean composition, strong visual hierarchy, generous spacing, professional typography-inspired layout, and platform-aware framing.",
    "Avoid too much text inside the image. If text appears, keep it short, clear, and legible.",
    "Do not use copyrighted logos, celebrity likenesses, trademarked characters, or identifiable real people.",
    "Use generic, non-identifiable people only if people are needed.",
    "Base the image concept on this generated content:",
    input.outputText
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Log in to generate images." },
      { status: 401 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Image generation is not configured yet." },
      { status: 500 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Subscription checks are not configured yet." },
      { status: 503 }
    );
  }

  const profile = await getUserProfile(user.id);

  if (!profile) {
    return NextResponse.json(
      { error: "Create an account profile before generating images." },
      { status: 403 }
    );
  }

  let plan = normalizePlanId(profile.plan);
  let status = normalizeSubscriptionStatus(profile.subscription_status);

  if (isStripeConfigured()) {
    try {
      const subscriptionState = reconcileActiveSubscriptionPlan(await getStripeSubscriptionState({
        stripeCustomerId: profile.stripe_customer_id,
        stripeSubscriptionId: profile.stripe_subscription_id,
        email: user.email
      }), profile.plan);

      if (subscriptionState.stripeSubscriptionId || subscriptionState.stripeCustomerId) {
        await syncUserSubscriptionState({
          userId: user.id,
          email: user.email,
          ...subscriptionState
        });

        plan = normalizePlanId(subscriptionState.plan);
        status = normalizeSubscriptionStatus(subscriptionState.status);
      }
    } catch {
      // Fall back to stored Supabase state if Stripe is temporarily unavailable.
    }
  }

  if (plan !== "pro_studio" || !planHasActiveEntitlement(plan, status)) {
    return NextResponse.json(
      { error: "Image generation is available on Pro Studio." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const outputText = cleanText(body?.outputText, 2600);
  const platform = cleanText(body?.platform, 80);
  const contentType = cleanText(body?.contentType, 80);
  const style = normalizeStyle(body?.style);
  const format = normalizeFormat(body?.format);
  const brandContext = (body?.brandContext ?? {}) as Record<string, unknown>;

  if (!outputText) {
    return NextResponse.json(
      { error: "Choose an output with text before generating an image." },
      { status: 400 }
    );
  }

  const prompt = buildImagePrompt({
    outputText,
    platform,
    contentType,
    style,
    format,
    brandName: cleanText(brandContext.brandName, 140),
    audience: cleanText(brandContext.audience, 220),
    offer: cleanText(brandContext.offer, 220),
    brandVoice: cleanText(brandContext.brandVoice, 180),
    contentGoal: cleanText(brandContext.contentGoal, 180)
  });

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt,
        n: 1,
        size: sizeByFormat[format]
      }),
      cache: "no-store"
    });

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const message = data.error?.message ?? "OpenAI image generation failed.";
      return NextResponse.json(
        { error: `Image generation failed: ${message}` },
        { status: response.status }
      );
    }

    const image = data.data?.[0];
    const imageData = image?.b64_json
      ? `data:image/png;base64,${image.b64_json}`
      : image?.url;

    if (!imageData) {
      return NextResponse.json(
        { error: "OpenAI did not return an image. Try again." },
        { status: 502 }
      );
    }

    try {
      await recordUsageEvent({
        userId: user.id,
        email: user.email,
        eventType: "image_generation",
        metadata: {
          platform,
          contentType,
          style,
          format,
          size: sizeByFormat[format]
        }
      });
    } catch {
      console.warn("Image generation usage tracking failed", {
        route: "/api/generate-image",
        userId: user.id
      });
    }

    return NextResponse.json({
      image: imageData,
      mimeType: image?.b64_json ? "image/png" : undefined,
      size: sizeByFormat[format],
      style,
      format,
      createdAt: new Date().toISOString()
    });
  } catch {
    return NextResponse.json(
      { error: "Image generation is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
