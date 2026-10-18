import { rejectUnsafeWrite } from "@/lib/request-security";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/backend";
import { analyticsEvent, captureServerError } from "@/lib/monitoring";
import { readGenerationRequest, remainingGenerationTime } from "@/lib/generation-contract";
import type { GenerationInput } from "@/lib/generation-contract";
import { GenerationReservationError } from "@/lib/generation-reservation";
import { beginTextGenerationStage, checkpointTextGenerationStage } from "@/lib/repository";
import { PIPELINE_LIMITS } from "@/lib/generation-pipeline";
import type { ProviderReceipt } from "@/lib/generation-pipeline";
import type { StageAdmission } from "@/lib/generation-stages";
import { isTextGenerationEnabled, TEXT_GENERATION_PAUSED_MESSAGE } from "@/lib/text-generation-availability";

export const runtime = "nodejs";
export const maxDuration = 120;

function logFailure(event: string) {
  try { captureServerError(new Error("Generation stage failed."), { route: "/api/generate", event }); } catch { /* Best effort. */ }
}

export async function POST(nextRequest: NextRequest) {
  const startedAt = performance.now();
  const rejected = rejectUnsafeWrite(nextRequest);
  if (rejected) return rejected;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (nextRequest.headers.get("X-ContentOS-Account") !== user.id) {
    return NextResponse.json({ error: "Your account session changed. Reload the page or sign in again before continuing.", code: "account_changed" }, { status: 409 });
  }
  let request: GenerationInput;
  if (!isTextGenerationEnabled()) {
    return NextResponse.json({ error: TEXT_GENERATION_PAUSED_MESSAGE, code: "text_generation_paused" }, {
      status: 503, headers: { "Cache-Control": "no-store" }
    });
  }
  const expected = nextRequest.headers.get("X-ContentOS-Stage");
  if (expected !== null && !/^1:(?:draft|review|correction|revalidation|save):[01]:\d{1,2}$/.test(expected)) {
    return NextResponse.json({ error: "Invalid generation stage." }, { status: 400 });
  }
  try { request = await readGenerationRequest(nextRequest); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 });
  }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Generation storage is unavailable. No generation was started." }, { status: 503 });
  if (!process.env.OPENAI_API_KEY || (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL !== PIPELINE_LIMITS.model)) {
    return NextResponse.json({ error: "AI generation is not configured with the bounded pipeline model." }, { status: 503 });
  }
  const requestId = request.requestId ?? crypto.randomUUID();
  const headers = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
  if (nextRequest.signal.aborted || remainingGenerationTime(performance.now() - startedAt) < 1000) {
    return NextResponse.json({ error: "Request ended before a generation stage started.", requestId }, { status: 408, headers });
  }
  let admission: StageAdmission;
  try { admission = await beginTextGenerationStage(user.id, requestId, request, expected); } catch (error) {
    if (error instanceof GenerationReservationError) return NextResponse.json({ error: error.message, code: error.code, requestId }, {
      status: error.status, headers: { ...headers, ...(error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}) }
    });
    logFailure("stage_admission");
    return NextResponse.json({ error: "Could not confirm saved progress. Resume with the same request ID; no provider call was started by this request.", code: "generation_save_uncertain", requestId }, { status: 503, headers });
  }
  if (admission.status === "replay") return NextResponse.json(admission.result, { headers });
  if (admission.status === "progress") return NextResponse.json(admission.progress, {
    status: admission.progress.status === "failed" ? 409 : 202, headers: { ...headers, "Retry-After": "2" }
  });

  // One committed stage reservation, one bounded provider call. Disconnecting the
  // browser does not cancel accepted work; the bounded call can still checkpoint.
  const stage = admission.stage;
  const callStarted = performance.now();
  let receipt: ProviderReceipt | null = null;
  try {
    const remaining = Math.floor(remainingGenerationTime(performance.now() - startedAt));
    if (remaining < 1000) throw new Error("stage_deadline");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY,
      timeout: PIPELINE_LIMITS.stageMs, maxRetries: 0, logLevel: "off" });
    const response = await client.responses.create(stage.payload, { signal: AbortSignal.timeout(remaining) });
    receipt = { status: response.status, output_text: response.output_text, usage: response.usage };
  } catch { logFailure("provider_stage_uncertain"); }
  const durationMs = performance.now() - callStarted;
  const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  try {
    const progress = await checkpointTextGenerationStage(user.id, requestId, admission.fingerprint, stage, request, receipt, durationMs);
    try { analyticsEvent("text_generation_stage", { stage: stage.kind, duration_ms: Math.round(durationMs),
      outcome: progress.status === "failed" ? "failure" : "checkpoint", input_bytes: stage.inputBytes,
      input_tokens: count(receipt?.usage?.input_tokens), output_tokens: count(receipt?.usage?.output_tokens),
      usage_known: [receipt?.usage?.input_tokens, receipt?.usage?.output_tokens].every(v => typeof v === "number" && Number.isSafeInteger(v) && v >= 0) }); } catch { /* Telemetry cannot affect delivery. */ }
    return NextResponse.json(progress, { status: progress.status === "failed" ? 502 : 202, headers });
  } catch {
    logFailure("stage_checkpoint_uncertain");
    return NextResponse.json({ error: "This stage finished but its checkpoint could not be confirmed. Resume the same attempt to check saved progress. Paid work will not be repeated automatically.", code: "generation_save_uncertain", requestId }, { status: 503, headers });
  }
}
