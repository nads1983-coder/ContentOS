import { rejectUnsafeWrite } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/backend";
import { isStripeConfigured } from "@/lib/env";
import { getStripeSubscriptionState, reconcileActiveSubscriptionPlan } from "@/lib/stripe-rest";
import {
  buildSocialPosterContent, buildTextlessBackgroundPrompt, renderSocialPosterSvg,
  socialImageModelSize, svgToDataUrl
} from "@/lib/social-image";
import {
  completeImageGeneration, failImageGeneration, getUserProfileForUser,
  reserveImageGeneration, syncUserSubscriptionState
} from "@/lib/repository";
import { hasLifetimeEntitlement } from "@/lib/entitlements";
import {
  IMAGE_LIMITS, ImageGenerationError, imageBackgroundFromResponse,
  normalizeImageRequest, readImageJson, validateImageResult
} from "@/lib/image-generation-contract";
import type { ImageGenerationInput, ImageGenerationResult } from "@/lib/image-generation-contract";
import type { ImageAdmission } from "@/lib/image-generation-reservation";
import { AICapacityError, DEFAULT_IMAGE_MODEL, quoteAI } from "@/lib/ai-cost";
import type { CostQuote } from "@/lib/ai-cost";
import { dispatchCommercial, settleCommercialUsage } from "@/lib/commercial-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const rejected = rejectUnsafeWrite(request);
  if (rejected) return rejected;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to generate images." }, { status: 401 });
  if (request.headers.get("X-ContentOS-Account") !== user.id) {
    return NextResponse.json({
      error: "Your account session changed. Reload the page or sign in again before continuing.",
      code: "account_changed"
    }, { status: 409 });
  }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });

  let input: ImageGenerationInput;
  try {
    input = normalizeImageRequest(await readImageJson(request, IMAGE_LIMITS.requestBytes));
  } catch (error) {
    return NextResponse.json({ error: error instanceof ImageGenerationError ? error.message : "Invalid image request.", code: "invalid_image_request" }, {
      status: error instanceof ImageGenerationError ? error.status : 400
    });
  }
  const headers = { "Cache-Control": "private, no-store", "X-Request-Id": input.requestId };

  let admission: ImageAdmission;
  let quote: CostQuote | undefined;
  const payload = {
    model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL, prompt: buildTextlessBackgroundPrompt(input),
    n: 1, size: socialImageModelSize(input.format), quality: "high",
    output_format: "png", background: "opaque", moderation: "auto"
  };
  try {
    const profile = await getUserProfileForUser(user.id, user.email);
    if (!profile) return NextResponse.json({ error: "Create an account profile before generating images." }, { status: 403, headers });
    // Preserve the existing billing reconciliation. Admission independently checks
    // the current entitlement again under the same row lock as quota and dedupe.
    if (isStripeConfigured() && !hasLifetimeEntitlement(profile)) {
      try {
        const subscriptionState = reconcileActiveSubscriptionPlan(await getStripeSubscriptionState({
          stripeCustomerId: profile.stripe_customer_id, stripeSubscriptionId: profile.stripe_subscription_id, email: user.email
        }), profile.plan);
        if (subscriptionState.stripeSubscriptionId || subscriptionState.stripeCustomerId) {
          await syncUserSubscriptionState({ userId: profile.id, email: user.email, ...subscriptionState });
        }
      } catch {
        // Stored entitlement is checked fail-closed by the reservation transaction.
      }
    }
    quote = process.env.OPENAI_API_KEY ? quoteAI("image", payload) : undefined;
    admission = await reserveImageGeneration(user.id, input, quote);
  } catch (error) {
    if (error instanceof AICapacityError) return NextResponse.json({ error: error.message, code: error.code, requestId: input.requestId }, { status: error.status, headers });
    if (error instanceof ImageGenerationError) return NextResponse.json({ error: error.message, code: error.code, requestId: input.requestId }, {
      status: error.status,
      headers: { ...headers, ...(error.retryAfterSeconds !== undefined ? { "Retry-After": String(error.retryAfterSeconds) } : {}) }
    });
    console.warn("[image] admission unavailable");
    return NextResponse.json({ error: "Image usage could not be verified. No image was started.", code: "image_storage_unavailable", requestId: input.requestId }, { status: 503, headers });
  }
  if (admission.status === "replay") return NextResponse.json(admission.result, { headers });

  let result: ImageGenerationResult;
  try {
    if (request.signal.aborted) throw new Error("Image request cancelled.");
    const content = buildSocialPosterContent(input);
    let backgroundDataUrl: string | undefined;
    let warning: string | undefined;
    if (process.env.OPENAI_API_KEY) {
      try {
        if (!quote) throw new AICapacityError("missing_cost_reservation");
        await dispatchCommercial(user.id, input.requestId, quote);
        const started = Date.now();
        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST", cache: "no-store", redirect: "error",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(IMAGE_LIMITS.providerMs)]),
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        // No automatic model/network retries: the provider may already have spent resources.
        if (response.ok) {
          const body = await readImageJson(response, IMAGE_LIMITS.providerBytes, Math.max(1, IMAGE_LIMITS.providerMs - (Date.now() - started)));
          await settleCommercialUsage(user.id, input.requestId, quote, (body as { usage?: unknown })?.usage);
          backgroundDataUrl = imageBackgroundFromResponse(body);
        } else {
          void response.body?.cancel().catch(() => {});
        }
        if (!backgroundDataUrl) warning = "An AI background was not available. A template background was used. No successful image credit was recorded. An uncertain request may remain reserved until reviewed.";
      } catch {
        warning = "The AI background request did not complete. A template background was used. No successful image credit was recorded. An uncertain request may remain reserved until reviewed.";
      }
    } else {
      warning = "AI backgrounds are not configured. A template background was used. No image credit was used.";
    }
    if (request.signal.aborted) throw new Error("Image request cancelled.");
    const render = (): ImageGenerationResult => {
      const rendered = renderSocialPosterSvg({ content, style: input.style, format: input.format, backgroundDataUrl });
      return validateImageResult({
        image: svgToDataUrl(rendered.svg), mimeType: rendered.mimeType, size: rendered.size,
        style: input.style, format: input.format, template: content.template,
        imageCreditsLimit: IMAGE_LIMITS.monthlyCredits, creditCharged: Boolean(backgroundDataUrl),
        warning: [content.warning, warning].filter(Boolean).join(" ") || undefined,
        createdAt: new Date().toISOString()
      });
    };
    try { result = render(); }
    catch (error) {
      if (!backgroundDataUrl || !(error instanceof ImageGenerationError) || error.code !== "image_result_too_large") throw error;
      backgroundDataUrl = undefined;
      warning = "The AI background was too large to save safely. A template background was used. No image credit was used.";
      result = render();
    }
  } catch {
    try { await failImageGeneration(user.id, input.requestId, admission.fingerprint, quote); }
    catch { console.warn("[image] reservation release unavailable"); }
    return NextResponse.json({
      error: "Image generation failed. No successful image credit was recorded.", code: "image_generation_failed", requestId: input.requestId
    }, { status: 502, headers });
  }

  try {
    const completed = await completeImageGeneration(user.id, input.requestId, admission.fingerprint, result, quote);
    return NextResponse.json(completed, { headers });
  } catch {
    // A commit may have succeeded despite a lost acknowledgement. Never release
    // or retry the provider here: replay this exact request ID to recover/check.
    console.warn("[image] completion uncertain");
    return NextResponse.json({
      error: "The image finished but its save could not be confirmed. Retry the same request ID to check its status.",
      code: "image_save_uncertain", requestId: input.requestId
    }, { status: 503, headers });
  }
}
