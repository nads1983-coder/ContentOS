import { createHash, verify } from "node:crypto";
import { runInNewContext } from "node:vm";

export const PROJECT = "prj_aO6mDTNkCKe5jzepGPCvzOWy1eBS";
export const SCHEMA = "contentos_grounding_benchmark_20261018";
export const ROLE = "contentos_grounding_runner_20261018";
export const BASELINE = "6c75fab8e995e94c53bec400aed01991e1ee0642";
export const CANDIDATE = "6daddcc4149932e0d1bc59e331ecba7ce99f78ad";
export const SEALED_HASH = "882551de16ba114b2d748bbcf11acf6de8e31d72a5974f64cf5a4c65b53fc8b2";
export const DRAFT_RESERVE = 568960, REVIEW_RESERVE = 848960;
export const sha = value => createHash("sha256").update(value).digest("hex");
export function demand(value, code) { if (!value) throw new Error(code); }
export const modulesAllowed = ["lib/prompts.ts", "lib/content-config.ts", "lib/text-normalize.ts", "lib/generation-contract.ts", "lib/cta-policy.ts", "lib/factual-grounding.ts", "baseline-parser.ts"];

// Only frozen pure modules: no process, network, database, filesystem or application imports.
export function loadModules(modules) {
  const cache = new Map();
  const load = path => {
    demand(modulesAllowed.includes(path) && typeof modules[path] === "string", "unexpected_module");
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    runInNewContext(modules[path], { module, exports: module.exports, TextEncoder,
      crypto: { randomUUID: () => "synthetic-benchmark-output" },
      require: id => { demand(id.startsWith("@/"), "unexpected_import"); return load(`${id.slice(2)}.ts`); }
    }, { timeout: 2000 });
    return module.exports;
  };
  return load;
}

export function validatePayload(body, stage) {
  demand(typeof body === "string" && ["draft", "review1", "review2"].includes(stage), "invalid_stage");
  const draft = stage === "draft", bytes = Buffer.byteLength(body), p = JSON.parse(body);
  demand(bytes <= (draft ? 64000 : 256000), "payload_too_large");
  demand(p.model === "gpt-5.2" && p.store === false && p.service_tier === "default" && p.max_output_tokens === (draft ? 24000 : 16000), "unpriced_payload");
  demand(Object.keys(p).every(k => ["model", "store", "service_tier", "instructions", "input", "max_output_tokens", "text"].includes(k)), "unexpected_payload_field");
  demand(typeof p.input === "string" && typeof p.instructions === "string" && p.text?.format?.strict === true && p.text.format.type === "json_schema", "invalid_payload");
  return { payloadHash: sha(body), maxInputTokens: bytes + 4096, reserve: draft ? DRAFT_RESERVE : REVIEW_RESERVE };
}

export function validateManifest(signed, publicKey, now = Date.now()) {
  demand(typeof signed?.manifest === "string" && Buffer.byteLength(signed.manifest) < 2000000, "invalid_manifest");
  demand(verify(null, Buffer.from(signed.manifest), publicKey, Buffer.from(signed.signature, "base64")), "unauthorized_manifest");
  const plan = JSON.parse(signed.manifest), { planHash, ...material } = plan;
  demand(planHash === sha(JSON.stringify(material)), "plan_hash_mismatch");
  demand(plan.project === PROJECT && plan.environment === "preview" && plan.role === ROLE && plan.baseline === BASELINE && plan.candidate === CANDIDATE && plan.sealedHash === SEALED_HASH, "wrong_target");
  demand(Number.isSafeInteger(plan.expires) && plan.expires > now && plan.expires <= now + 4 * 3600000, "expired_authorization");
  demand(plan.capGbpMicros === 9000000 && plan.maxRequests === 12 && plan.maxReservedGbpMicros === 8507520, "wrong_budget");
  const ids = ["H1", "H2", "H3"].flatMap(id => [`${id}:baseline`, `${id}:candidate`]);
  demand(JSON.stringify(plan.packs.map(p => p.id)) === JSON.stringify(ids), "unexpected_packs");
  for (const pack of plan.packs) {
    const v = validatePayload(pack.body, "draft");
    demand(v.payloadHash === pack.payloadHash && pack.request.selectedTypes.length === 14 && new Set(pack.request.selectedTypes).size === 14, "changed_draft");
  }
  for (const variant of ["baseline", "candidate"]) {
    for (const [path, source] of Object.entries(plan.modules[variant])) {
      demand(modulesAllowed.includes(path) && sha(source) === plan.moduleHashes[variant][path], "module_changed");
    }
  }
  return plan;
}

export function validateRuntime(env) {
  demand(env.VERCEL_ENV === "preview" && env.VERCEL_PROJECT_ID === PROJECT, "not_preview");
  demand(/^sk-[A-Za-z0-9_-]{20,}$/.test(env.OPENAI_API_KEY ?? ""), "missing_existing_credential");
  const url = new URL(env.BENCHMARK_DATABASE_URL);
  demand(["postgres:", "postgresql:"].includes(url.protocol) && ["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech", "ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(url.hostname) && url.pathname === "/contentos" && decodeURIComponent(url.username) === ROLE, "not_isolated_role");
  demand(url.searchParams.getAll("sslmode").length === 1 && url.searchParams.get("sslmode") === "verify-full" && [...url.searchParams.keys()].every(k => k === "sslmode"), "unsafe_connection");
  return url.href;
}

export async function providerCall(body, key, timeoutMs, fetcher = fetch) {
  demand(timeoutMs > 0 && timeoutMs <= 90000, "invalid_deadline");
  const response = await fetcher("https://api.openai.com/v1/responses", { method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body });
  if (!response.ok) { await response.body?.cancel(); throw new Error("provider_rejected"); }
  const reader = response.body?.getReader(); demand(reader, "missing_response");
  const chunks = []; let bytes = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; demand(bytes <= 2000000, "response_too_large"); chunks.push(Buffer.from(part.value)); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function responseEvidence(response, body, stage, key, latencyMs) {
  const limits = validatePayload(body, stage), usage = response.usage;
  demand(response.service_tier === "default" && /^gpt-5\.2(?:-|$)/.test(response.model ?? ""), "unpriced_response");
  demand(usage && ["input_tokens", "output_tokens", "total_tokens"].every(k => Number.isSafeInteger(usage[k]) && usage[k] >= 0), "missing_usage");
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  demand(Number.isSafeInteger(cached) && cached >= 0 && cached <= usage.input_tokens && usage.input_tokens <= limits.maxInputTokens && usage.output_tokens <= (stage === "draft" ? 24000 : 16000) && usage.total_tokens === usage.input_tokens + usage.output_tokens, "usage_out_of_bounds");
  const outputText = (response.output_text ?? (response.output ?? []).flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text).join("")).replaceAll(key, "[REDACTED]");
  const costUsd = ((usage.input_tokens - cached) * 1.75 + cached * .175 + usage.output_tokens * 14) / 1000000;
  demand(Math.ceil(costUsd * 1.25 * 1000000) <= limits.reserve, "reservation_exceeded");
  return { responseHash: sha(outputText), outputText, status: response.status, model: response.model, serviceTier: response.service_tier,
    usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, total_tokens: usage.total_tokens, cached_tokens: cached },
    costUsd, costGbpReference: costUsd * (0.84385 / 1.1253), latencyMs: Math.round(latencyMs) };
}

export async function executePlan(plan, { ledger, apiKey, transport = providerCall, now = Date.now, load = loadModules }) {
  const candidate = load(plan.modules.candidate), baseline = load(plan.modules.baseline);
  const contract = candidate("lib/generation-contract.ts"), grounding = candidate("lib/factual-grounding.ts");
  const drafts = new Map(); let calls = 0, stopped = false;
  async function call(pack, stage, body, previousHash, remaining) {
    try {
    demand(now() < plan.expires && remaining > 0 && !stopped, "execution_closed");
    const { payloadHash } = validatePayload(body, stage);
    demand(await ledger.reserve(plan.planHash, `${pack.id}:${stage}`, payloadHash, previousHash), "duplicate_or_denied_admission");
    // No transaction remains open during network work. Lost acknowledgement never triggers a call.
    const start = now(); calls++;
    let evidence;
    try { evidence = responseEvidence(await transport(body, apiKey, Math.max(1, Math.floor(remaining))), body, stage, apiKey, now() - start); }
    catch {
      stopped = true;
      await ledger.finish(plan.planHash, `${pack.id}:${stage}`, "unknown", { failure: "provider_outcome_uncertain", latencyMs: now() - start });
      throw new Error("provider_outcome_uncertain");
    }
    const ok = evidence.status === "completed" && evidence.outputText.length > 0;
    if (!ok) stopped = true;
    await ledger.finish(plan.planHash, `${pack.id}:${stage}`, ok ? "succeeded" : "failed", evidence);
    demand(ok, "provider_incomplete");
    console.log(JSON.stringify({ benchmarkStage: `${pack.id}:${stage}`, status: "succeeded", latencyMs: evidence.latencyMs }));
    return evidence;
    } catch (error) { stopped = true; throw error; }
  }
  try {
    const initial = await ledger.inspect(plan.planHash);
    const slots = plan.packs.flatMap(p => [{ id: `${p.id}:draft`, hash: p.payloadHash }, ...(p.variant === "candidate" ? [1, 2].map(n => ({ id: `${p.id}:review${n}`, hash: null })) : [])]);
    demand(initial.enabled && initial.unexpired && initial.reservedGbpMicros === 0 && initial.jobs.length === 12 && initial.jobs.every(j => j.state === "ready" && slots.some(s => s.id === j.id && s.hash === j.payloadHash)), "ledger_not_pristine");
    // Collect paired drafts before reviews, preserving raw evidence even if a later review fails.
    // Queue time is excluded; each candidate retains the route's 90-second shared provider budget.
    for (const pack of plan.packs) {
      const evidence = await call(pack, "draft", pack.body, null, 90000);
      drafts.set(pack.id, evidence);
      if (pack.variant === "baseline") {
        let outcome;
        try { const result = baseline("baseline-parser.ts").parseOpenAIJson(evidence.outputText, pack.request);
          outcome = { status: "delivered", result, latencyMs: evidence.latencyMs, reviews: 0 };
        } catch { outcome = { status: "blocked", reason: "invalid_generation", latencyMs: evidence.latencyMs, reviews: 0 }; }
        await ledger.outcome(plan.planHash, pack.id, outcome);
      }
    }
    for (const pack of plan.packs.filter(p => p.variant === "candidate")) {
      const draft = drafts.get(pack.id); let elapsed = draft.latencyMs, previousHash = draft.responseHash, reviews = 0;
      let outcome;
      try {
        const parsed = contract.parseGenerationOutput(draft.outputText, pack.request);
        const result = await grounding.groundGeneration(parsed, pack.request, async input => {
          const remaining = Math.floor(90000 - elapsed);
          if (remaining <= 0) throw new Error("deadline_exhausted");
          const stage = `review${++reviews}`;
          const body = JSON.stringify({ model: "gpt-5.2", store: false, service_tier: "default", instructions: grounding.groundingReviewInstructions, input,
            max_output_tokens: 16000, text: { format: { type: "json_schema", name: "content_grounding_review", strict: true, schema: grounding.groundingReviewSchema() } } });
          const evidence = await call(pack, stage, body, previousHash, remaining);
          elapsed += evidence.latencyMs; previousHash = evidence.responseHash;
          return evidence.outputText;
        });
        outcome = { status: "delivered", result, latencyMs: elapsed, reviews };
      } catch (error) {
        if (stopped) throw error;
        outcome = { status: "blocked", reason: error instanceof grounding.GroundingError ? error.reason : "invalid_generation_or_deadline", latencyMs: elapsed, reviews };
      }
      await ledger.outcome(plan.planHash, pack.id, outcome);
    }
    return { calls };
  } finally { await ledger.disable(plan.planHash); }
}
