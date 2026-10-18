import { rejectUnsafeWrite } from "@/lib/request-security";
import OpenAI from "openai";
import { APIConnectionTimeoutError, APIUserAbortError } from "openai/error";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/backend";
import { analyticsEvent, captureServerError } from "@/lib/monitoring";
import { buildInput, buildInstructions } from "@/lib/prompts";
import {
  GENERATION_LIMITS,
  GenerationOutputError,
  generationOutputSchema,
  parseGenerationOutput,
  remainingGenerationTime,
  readGenerationRequest
} from "@/lib/generation-contract";
import type { GenerationInput } from "@/lib/generation-contract";
import { GenerationReservationError } from "@/lib/generation-reservation";
import type { GenerationAdmission } from "@/lib/generation-reservation";
import { completeTextGeneration, failTextGeneration, reserveTextGeneration } from "@/lib/repository";
import { GROUNDING_LIMITS, GroundingError, groundGeneration, groundingReviewInstructions, groundingReviewSchema } from "@/lib/factual-grounding";

export const runtime = "nodejs";
export const maxDuration = 120;

function logGenerationFailure(error: unknown, event: "reservation" | "reservation_failure" | "provider" | "completion") {
  const errorClass = error instanceof GenerationOutputError ? "invalid_output"
    : error instanceof APIConnectionTimeoutError ? "provider_timeout"
      : error instanceof APIUserAbortError ? "provider_abort" : "operation_failure";
  captureServerError(new Error("Generation operation failed."), {
    route: "/api/generate", event, error_class: errorClass
  });
}

export async function POST(nextRequest: NextRequest) {
  const startedAt = performance.now();
  const providerTokens: Record<string, number> = {};
  const report = (outcome: "success" | "failure" | "replay", outputCount = 0) => {
    // Telemetry must never change a generation's outcome or include user input.
    try {
      analyticsEvent(`text_generation_${outcome}`, {
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        output_count: outputCount,
        ...providerTokens
      });
    } catch {
      // Observability is best-effort; generation state is authoritative.
    }
  };
  const rejected = rejectUnsafeWrite(nextRequest);
  if (rejected) return rejected;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (nextRequest.headers.get("X-ContentOS-Account") !== user.id) {
    return NextResponse.json({
      error: "Your account session changed. Reload the page or sign in again before continuing.",
      code: "account_changed"
    }, { status: 409 });
  }
  let request: GenerationInput;
  try {
    request = await readGenerationRequest(nextRequest);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Generation storage is unavailable. No generation was started." }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured." }, { status: 503 });
  }

  // Older clients can omit requestId; new clients retain it across a logical retry.
  const requestId = request.requestId ?? crypto.randomUUID();
  const headers = { "X-Request-Id": requestId };
  let admission: GenerationAdmission;
  try {
    admission = await reserveTextGeneration(user.id, requestId, request);
  } catch (error) {
    report("failure");
    if (error instanceof GenerationReservationError) {
      return NextResponse.json({ error: error.message, code: error.code, requestId }, {
        status: error.status,
        headers: { ...headers, ...(error.retryAfterSeconds !== undefined ? { "Retry-After": String(error.retryAfterSeconds) } : {}) }
      });
    }
    logGenerationFailure(error, "reservation");
    return NextResponse.json({ error: "Could not reserve this generation. No generation was started.", requestId }, { status: 503, headers });
  }
  if (admission.status === "replay") {
    report("replay", admission.result.sections.length);
    return NextResponse.json(admission.result, { headers });
  }

  let result;
  try {
    // All provider stages share one deadline and the original durable admission.
    const remaining = Math.floor(remainingGenerationTime(performance.now() - startedAt));
    if (!remaining) throw new DOMException("Generation deadline exceeded.", "TimeoutError");
    const signal = AbortSignal.any([nextRequest.signal, AbortSignal.timeout(remaining)]);
    signal.throwIfAborted();
    const addUsage = (usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined) => {
      for (const key of ["input_tokens", "output_tokens", "total_tokens"] as const) {
        const count = usage?.[key];
        if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) providerTokens[key] = (providerTokens[key] ?? 0) + count;
      }
    };
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: GENERATION_LIMITS.timeoutMs,
      maxRetries: GENERATION_LIMITS.maxRetries,
      logLevel: "off"
    });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.2",
      store: false,
      service_tier: "default",
      instructions: buildInstructions(),
      input: buildInput(request),
      max_output_tokens: GENERATION_LIMITS.maxOutputTokens,
      text: {
        format: {
          type: "json_schema",
          name: "social_content_generation",
          strict: true,
          schema: generationOutputSchema(request.selectedTypes)
        }
      }
    }, {
      signal
    });
    addUsage(response.usage);
    if (response.status !== "completed") throw new GenerationOutputError("The provider did not complete the generation.");
    result = parseGenerationOutput(response.output_text, request);
    result = await groundGeneration(result, request, async input => {
      signal.throwIfAborted();
      const review = await client.responses.create({
        model: process.env.OPENAI_MODEL ?? "gpt-5.2", store: false, service_tier: "default",
        instructions: groundingReviewInstructions, input,
        max_output_tokens: GROUNDING_LIMITS.reviewOutputTokens,
        text: { format: { type: "json_schema", name: "content_grounding_review", strict: true, schema: groundingReviewSchema() } }
      }, { signal });
      addUsage(review.usage);
      if (review.status !== "completed") throw new GroundingError();
      return review.output_text;
    });
  } catch (error) {
    // Only complete, validated packs may enter history or successful usage accounting.
    try {
      await failTextGeneration(user.id, requestId, admission.fingerprint);
    } catch (reservationError) {
      logGenerationFailure(reservationError, "reservation_failure");
    }
    logGenerationFailure(error, "provider");
    report("failure");
    const invalidOutput = error instanceof GenerationOutputError;
    const ungrounded = error instanceof GroundingError;
    const timedOut = error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError ||
      (error instanceof Error && ["AbortError", "TimeoutError", "APIConnectionTimeoutError", "APIUserAbortError"].includes(error.name));
    return NextResponse.json({
      error: ungrounded
        ? error.reason === "unresolved_claims"
          ? "The pack still contains claims that could not be supported. Clarify the facts in your brief before trying again. No successful generation was recorded."
          : "The factual check could not be completed. The unchecked pack was not saved or delivered. No successful generation was recorded."
        : invalidOutput
        ? "The AI returned an incomplete or invalid pack. No successful generation was recorded."
        : timedOut
          ? "Generation timed out or was cancelled. No successful generation was recorded."
          : "Generation failed. No successful generation was recorded.",
      code: ungrounded ? "grounding_failed" : invalidOutput ? "invalid_generation" : timedOut ? "generation_timeout" : "generation_failed",
      requestId
    }, { status: invalidOutput ? 502 : timedOut ? 504 : 500, headers });
  }

  try {
    const completed = await completeTextGeneration(user.id, requestId, admission.fingerprint, result);
    report("success", completed.sections.length);
    return NextResponse.json(completed, { headers });
  } catch (error) {
    // A commit may have succeeded despite an uncertain acknowledgement. Keep the
    // reservation intact so retrying this ID can replay, never start another call.
    logGenerationFailure(error, "completion");
    report("failure");
    return NextResponse.json({
      error: "The generation finished but its save could not be confirmed. Retry with the same request ID to check its status.",
      code: "generation_save_uncertain",
      requestId
    }, { status: 503, headers });
  }
}
