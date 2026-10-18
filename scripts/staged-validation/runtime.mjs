import { createHash, verify } from "node:crypto";
import * as crypto from "node:crypto";
import { runInNewContext } from "node:vm";
export const PROJECT = "prj_aO6mDTNkCKe5jzepGPCvzOWy1eBS";
export const SCHEMA = "contentos_staged_validation_20261018";
export const ROLE = "contentos_staged_runner_20261018";
export const CANDIDATE = "c32110aa3711a14bc59a8e7b1da7e8d5f0e38e4c";
export const sha = value => createHash("sha256").update(value).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function demand(value, code) { if (!value) throw new Error(code); }
export function loadModules(modules) {
  const cache = new Map();
  const load = path => {
    demand(typeof modules[path] === "string", "unexpected_module");
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    runInNewContext(modules[path], { module, exports: module.exports, Buffer, TextEncoder, structuredClone, performance,
      crypto, require: id => {
        if (id === "node:crypto") return crypto;
        demand(id.startsWith("@/"), "unexpected_import"); return load(`${id.slice(2)}.ts`);
      }
    }, { timeout: 2000 });
    return module.exports;
  };
  return load;
}
export function validatePayload(body) {
  demand(typeof body === "string" && Buffer.byteLength(body) <= 160000, "payload_size");
  const p = JSON.parse(body), bytes = Buffer.byteLength(body);
  demand(p.model === "gpt-5.2" && p.store === false && p.service_tier === "default" && [24000,4800].includes(p.max_output_tokens), "unpriced_payload");
  demand(Object.keys(p).sort().join() === "input,instructions,max_output_tokens,model,service_tier,store,text" &&
    typeof p.input === "string" && typeof p.instructions === "string" && p.text?.format?.strict === true && p.text.format.type === "json_schema", "invalid_payload");
  return { hash: sha(body), bytes, inputLimit: bytes + 4096, outputLimit: p.max_output_tokens,
    reserve: Math.ceil(((bytes + 4096) * 1.75 + p.max_output_tokens * 14) * 1.25) };
}
export function validateManifest(signed, publicKey, now = Date.now()) {
  demand(typeof signed?.manifest === "string" && Buffer.byteLength(signed.manifest) < 2000000 &&
    verify(null, Buffer.from(signed.manifest), publicKey, Buffer.from(signed.signature, "base64")), "unsigned_manifest");
  const p = JSON.parse(signed.manifest), { planHash, ...material } = p;
  demand(planHash === sha(JSON.stringify(material)), "changed_manifest");
  demand(p.project === PROJECT && p.role === ROLE && p.environment === "preview" && p.candidate === CANDIDATE &&
    p.cap === 4000000 && p.maxCalls === 23 && p.expires > now && p.expires < now + 4 * 3600000, "wrong_authorization");
  demand(p.account.startsWith("staged-validation-") && p.request.selectedTypes.length === 14 && new Set(p.request.selectedTypes).size === 14, "wrong_fixture");
  demand(sha(JSON.stringify(p.request)) === p.requestHash && Object.keys(p.modules).length > 5 &&
    Object.entries(p.modules).every(([path,s]) => sha(s) === p.moduleHashes[path]), "changed_modules");
  return p;
}
export function validateRuntime(env) {
  demand(env.VERCEL_ENV === "preview" && env.VERCEL_PROJECT_ID === PROJECT && /^sk-[A-Za-z0-9_-]{20,}$/.test(env.OPENAI_API_KEY ?? ""), "unsafe_preview_or_missing_key");
  const url = new URL(env.BENCHMARK_DATABASE_URL);
  demand(["postgres:","postgresql:"].includes(url.protocol) && url.hostname === "ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech" &&
    url.pathname === "/contentos" && decodeURIComponent(url.username) === ROLE && url.search === "?sslmode=verify-full", "not_isolated_runner");
  return url.href;
}
export async function providerCall(body, key, fetcher = fetch) {
  validatePayload(body);
  const response = await fetcher("https://api.openai.com/v1/responses", { method: "POST", redirect: "error", signal: AbortSignal.timeout(90000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body });
  if (!response.ok) { await response.body?.cancel(); throw new Error("provider_rejected"); }
  const reader = response.body?.getReader(); demand(reader, "missing_body");
  const chunks = []; let size = 0;
  try { while (true) { const p = await reader.read(); if (p.done) break; size += p.value.byteLength; demand(size <= 2000000, "response_size"); chunks.push(Buffer.from(p.value)); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function responseEvidence(r, body, key, durationMs) {
  const v = validatePayload(body), u = r.usage, cached = u?.input_tokens_details?.cached_tokens ?? 0;
  demand(r.service_tier === "default" && /^gpt-5\.2(?:-|$)/.test(r.model ?? "") && u &&
    [u.input_tokens,u.output_tokens,u.total_tokens,cached].every(n => Number.isSafeInteger(n) && n >= 0) &&
    cached <= u.input_tokens && u.input_tokens <= v.inputLimit && u.output_tokens <= v.outputLimit && u.total_tokens === u.input_tokens + u.output_tokens, "unpriced_or_uncertain_usage");
  const output_text = (r.output_text ?? (r.output ?? []).flatMap(o=>o.content ?? []).filter(c=>c.type === "output_text").map(c=>c.text).join(""));
  demand(!output_text.includes(key), "credential_echo");
  const costUsd = ((u.input_tokens-cached)*1.75 + cached*.175 + u.output_tokens*14)/1000000;
  demand(Math.ceil(costUsd*1250000) <= v.reserve, "reservation_exceeded");
  return { status:r.status, output_text, usage:{input_tokens:u.input_tokens,output_tokens:u.output_tokens},
    evidence:{status:r.status,outputText:output_text,responseHash:sha(output_text),usage:u,model:r.model,serviceTier:r.service_tier,
      costUsd,costGbpReference:costUsd*(.84385/1.1253),durationMs:Math.round(durationMs),payloadHash:v.hash,inputBytes:v.bytes} };
}

// The exact candidate's pure transition functions execute against a single isolated
// synthetic profile. SQL commits every transition before any provider transport.
export async function execute(plan, { ledger, apiKey, transport = providerCall, load = loadModules }) {
  let expected = null, calls = 0, recovered = false;
  const started = performance.now(), loader = load(plan.modules), stages = loader("lib/generation-stages.ts");
  const contract = loader("lib/generation-contract.ts"), request = contract.normalizeGenerationRequest(plan.request);
  try {
    const initial = await ledger.inspect(); demand(initial.enabled && initial.jobs.length === 0 && initial.reserved === 0, "ledger_not_pristine");
    for (let n = 0; n < 60; n++) {
      demand(Date.now() < plan.expires, "expired");
      const admission = await ledger.mutate(d => stages.beginGenerationStage(d, plan.account, request.requestId, request, expected));
      if (admission.status === "replay") {
        const saved = await ledger.snapshot();
        demand(saved.generation_history_json?.length === 1 && saved.usage_events_json?.length === 1 &&
          equal(saved.generation_history_json[0].payload,admission.result) && admission.result.sections.length === 14, "final_save_mismatch");
        const duplicate = await ledger.mutate(d => stages.beginGenerationStage(d, plan.account, request.requestId, request, expected));
        demand(duplicate.status === "replay" && equal(duplicate.result,admission.result), "final_replay_mismatch");
        const outcome = {status:"delivered",result:admission.result,calls,recoveryVerified:recovered,durationMs:Math.round(performance.now()-started),
          pipelineAudit:saved.generation_reservations_json[0].pipelineAudit};
        await ledger.outcome(outcome); return outcome;
      }
      if (admission.status === "progress") {
        demand(admission.progress.status === "pending" && !admission.progress.running, "pipeline_stopped");
        expected = admission.progress.nextStage; continue;
      }
      const stage = admission.stage, body = JSON.stringify(stage.payload), bound = validatePayload(body);
      demand(stage.hash === bound.hash && stage.reservedMicroUsd === bound.reserve && calls < 23, "stage_binding");
      demand(await ledger.reserve(stage.key, body), "dispatch_denied");
      calls++;
      const start = performance.now(); let receipt;
      try { receipt = responseEvidence(await transport(body, apiKey), body, apiKey, performance.now()-start); }
      catch { await ledger.finish(stage.key,"unknown",{failure:"provider_uncertain",durationMs:Math.round(performance.now()-start)}); throw new Error("provider_uncertain"); }
      await ledger.finish(stage.key,receipt.status === "completed" ? "succeeded" : "failed",receipt.evidence);
      const progress = await ledger.mutate(d => stages.checkpointGenerationStage(d,plan.account,request.requestId,admission.fingerprint,stage,request,receipt,performance.now()-start));
      demand(progress.status === "pending", "validation_failed");
      const saved = await ledger.snapshot(), p = saved.generation_reservations_json[0].pipeline;
      // A confirmed unsupported factual assertion is a stop condition in this
      // final validation, not permission to buy another corrective model pass.
      demand(!p.decisions.some(d => d.kind === "unsupported"), "unsupported_claim_detected");
      if (!recovered) {
        const replay = await ledger.mutate(d => stages.beginGenerationStage(d,plan.account,request.requestId,request,null));
        demand(replay.status === "progress" && replay.progress.nextStage === progress.nextStage, "checkpoint_recovery_failed");
        recovered = true;
      }
      expected = progress.nextStage;
      console.log(JSON.stringify({stage:stage.key,status:"checkpointed",reviewed:progress.reviewedUnits,total:progress.totalUnits}));
    }
    throw new Error("continuation_limit");
  } catch(error) {
    const allowed = new Set(["provider_uncertain","validation_failed","unsupported_claim_detected","expired","ledger_not_pristine","dispatch_denied","stage_binding","pipeline_stopped","checkpoint_recovery_failed","final_save_mismatch","final_replay_mismatch","continuation_limit"]);
    const outcome = {status:"blocked",reason:allowed.has(error?.message)?error.message:"internal_or_persistence_failure",calls,durationMs:Math.round(performance.now()-started)};
    await ledger.outcome(outcome); return outcome;
  } finally { await ledger.disable(); }
}
