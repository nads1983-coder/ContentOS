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
import {
  buildSocialPosterContent,
  buildTextlessBackgroundPrompt,
  renderSocialPosterSvg,
  socialImageModelSize,
  svgToDataUrl
} from "@/lib/social-image";
import { getUserProfileForUser, recordUsageEvent, syncUserSubscriptionState } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImageStyle = "minimal" | "premium" | "corporate" | "bold" | "dark" | "modern";
type ImageFormat = "square" | "landscape" | "vertical";

const styles: ImageStyle[] = ["minimal", "premium", "corporate", "bold", "dark", "modern"];
const formats: ImageFormat[] = ["square", "landscape", "vertical"];

function cleanText(value: unknown, maxLength = 1800) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStyle(value: unknown): ImageStyle {
  return styles.includes(value as ImageStyle) ? (value as ImageStyle) : "premium";
}

function normalizeFormat(value: unknown): ImageFormat {
  return formats.includes(value as ImageFormat) ? (value as ImageFormat) : "square";
}

function looksLikeImageTextFailure(message: string) {
  return /text|typography|letter|word|logo|symbol/i.test(message);
}

async function imageUrlToDataUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Log in to generate images." },
      { status: 401 }
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Subscription checks are not configured yet." },
      { status: 503 }
    );
  }

  const profile = await getUserProfileForUser(user.id, user.email);

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
          userId: profile.id,
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
  const brandContextInput = (body?.brandContext ?? {}) as Record<string, unknown>;

  if (!outputText) {
    return NextResponse.json(
      { error: "Choose an output with text before generating an image." },
      { status: 400 }
    );
  }

  const brandContext = {
    brandName: cleanText(brandContextInput.brandName, 140),
    audience: cleanText(brandContextInput.audience, 220),
    offer: cleanText(brandContextInput.offer, 220),
    brandVoice: cleanText(brandContextInput.brandVoice, 180),
    contentGoal: cleanText(brandContextInput.contentGoal, 180)
  };

  const posterContent = buildSocialPosterContent({
    outputText,
    platform,
    contentType,
    style,
    format,
    brandContext
  });

  let backgroundDataUrl: string | undefined;
  let backgroundWarning: string | undefined;

  try {
    if (process.env.OPENAI_API_KEY) {
      const backgroundPrompt = buildTextlessBackgroundPrompt({
        outputText,
        platform,
        contentType,
        style,
        format,
        brandContext
      });

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
          prompt: backgroundPrompt,
          n: 1,
          size: socialImageModelSize(format)
        }),
        cache: "no-store"
      });

      const data = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        const message = data.error?.message ?? "OpenAI background generation failed.";
        backgroundWarning = looksLikeImageTextFailure(message)
          ? "Background generation was rejected because it may have included text. A clean template background was used."
          : "AI background generation failed, so a clean template background was used.";
      } else {
        const image = data.data?.[0];
        backgroundDataUrl = image?.b64_json
          ? `data:image/png;base64,${image.b64_json}`
          : image?.url
            ? await imageUrlToDataUrl(image.url)
            : undefined;

        if (!backgroundDataUrl) {
          backgroundWarning = "OpenAI did not return a usable background, so a clean template background was used.";
        }
      }
    } else {
      backgroundWarning = "OpenAI image backgrounds are not configured, so a clean template background was used.";
    }
  } catch {
    backgroundWarning = "AI background generation was unavailable, so a clean template background was used.";
  }

  const rendered = renderSocialPosterSvg({
    content: posterContent,
    style,
    format,
    backgroundDataUrl
  });

  try {
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
          size: rendered.size,
          renderer: "svg_text_overlay",
          background: backgroundDataUrl ? "openai_textless" : "template_fallback"
        }
      });
    } catch {
      console.warn("Image generation usage tracking failed", {
        route: "/api/generate-image",
        userId: user.id
      });
    }

    return NextResponse.json({
      image: svgToDataUrl(rendered.svg),
      mimeType: rendered.mimeType,
      size: rendered.size,
      style,
      format,
      template: posterContent.template,
      warning: [posterContent.warning, backgroundWarning].filter(Boolean).join(" ") || undefined,
      createdAt: new Date().toISOString()
    });
  } catch {
    return NextResponse.json(
      { error: "Image generation is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
