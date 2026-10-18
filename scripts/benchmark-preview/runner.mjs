import { createHash, verify } from "node:crypto";

export const PROJECT = "prj_aO6mDTNkCKe5jzepGPCvzOWy1eBS";
export const ROLE = "contentos_benchmark_runner_20261018";
export const SCHEMA = "contentos_benchmark_20261018";
export const RESERVATION = 568960;
export const JOBS = ["pilot:baseline","pilot:candidate","launch:baseline","launch:candidate","sparse:baseline","sparse:candidate"];
export const FOLLOWUP_JOBS = ["pilot:corrected","launch:corrected","sparse:corrected"];
export function reservationForJob(job) {
  if (!FOLLOWUP_JOBS.includes(job.id)) return RESERVATION;
  return Math.ceil(((Buffer.byteLength(job.body)+4096)*175+24000*1400)*125/10000);
}
const hash = value => createHash("sha256").update(value).digest("hex");
export function demand(value, code) { if (!value) throw new Error(code); }
export function validateManifest(signed, publicKey, now = Date.now()) {
  demand(signed && typeof signed.manifest === "string" && signed.manifest.length < 500000, "invalid_manifest");
  demand(verify(null, Buffer.from(signed.manifest), publicKey, Buffer.from(signed.signature,"base64")), "unauthorized_manifest");
  const plan = JSON.parse(signed.manifest);
  demand(plan.project === PROJECT && plan.environment === "preview" && plan.role === ROLE && /^[a-f0-9]{64}$/.test(plan.planHash), "wrong_target");
  demand(Number.isSafeInteger(plan.expires) && plan.expires > now && plan.expires <= now + 4*60*60*1000, "expired_authorization");
  const followup=plan.phase==="followup";
  demand(JSON.stringify(plan.jobs.map(job=>job.id)) === JSON.stringify(followup?FOLLOWUP_JOBS:JOBS), "invalid_jobs");
  if(followup) {
    demand(plan.startingReservedGbpMicros===3413760 && JSON.stringify(plan.priorJobs?.map(j=>j.id))===JSON.stringify(JOBS) && plan.priorJobs.every(j=>/^[a-f0-9]{64}$/.test(j.payloadHash)),"invalid_prior_audit");
    demand(plan.startingReservedGbpMicros+plan.jobs.reduce((s,j)=>s+reservationForJob(j),0)<=5000000,"cumulative_budget_exceeded");
  }
  for (const job of plan.jobs) {
    demand(hash(job.body) === job.payloadHash && Buffer.byteLength(job.body) <= 64000, "payload_changed");
    if(followup)demand(job.reserveGbpMicros===reservationForJob(job),"incorrect_exact_reservation");
    const p = JSON.parse(job.body);
    demand(p.model === "gpt-5.2" && p.service_tier === "default" && p.max_output_tokens === 24000 && p.store === false, "unpriced_request");
    demand(Object.keys(p).every(k=>["model","service_tier","instructions","input","max_output_tokens","text","store"].includes(k)), "extra_request_fields");
    demand(typeof p.instructions === "string" && typeof p.input === "string" && p.text?.format?.strict === true && p.text.format.type === "json_schema", "invalid_request");
  }
  return plan;
}
export function validateRuntime(env) {
  demand(env.VERCEL_ENV === "preview" && env.VERCEL_PROJECT_ID === PROJECT, "not_authorized_preview");
  demand(typeof env.OPENAI_API_KEY === "string" && /^sk-[A-Za-z0-9_-]{20,}$/.test(env.OPENAI_API_KEY), "missing_openai_credential");
  const url = new URL(env.BENCHMARK_DATABASE_URL);
  demand(["postgres:","postgresql:"].includes(url.protocol) && ["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech","ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(url.hostname) && url.pathname === "/contentos" && decodeURIComponent(url.username) === ROLE, "not_isolated_database");
  demand(url.searchParams.getAll("sslmode").length===1 && url.searchParams.get("sslmode")==="verify-full" && [...url.searchParams.keys()].every(k=>["sslmode","channel_binding"].includes(k)), "unsafe_database_options");
  return url.href;
}
export function evidenceFromResponse(response, apiKey, elapsedMs, job) {
  const usage = response.usage;
  demand(response.status === "completed" && response.service_tier === "default", "provider_incomplete_or_wrong_tier");
  demand(usage && ["input_tokens","output_tokens","total_tokens"].every(k=>Number.isSafeInteger(usage[k]) && usage[k]>=0), "missing_usage");
  demand(usage.input_tokens<=68096 && usage.output_tokens<=24000 && usage.total_tokens===usage.input_tokens+usage.output_tokens, "usage_out_of_bounds");
  if(job && FOLLOWUP_JOBS.includes(job.id))demand(usage.input_tokens<=Buffer.byteLength(job.body)+4096,"exact_input_bound_exceeded");
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  demand(Number.isSafeInteger(cached) && cached>=0 && cached<=usage.input_tokens, "invalid_cached_usage");
  const text = (typeof response.output_text === "string" ? response.output_text : (response.output??[]).flatMap(item=>item.content??[]).filter(part=>part.type==="output_text").map(part=>part.text).join(""));
  demand(typeof text==="string" && text.length>0 && Buffer.byteLength(text)<=1000000, "missing_or_large_output");
  const costUsd = ((usage.input_tokens-cached)*1.75+cached*0.175+usage.output_tokens*14)/1000000;
  demand(Math.ceil(costUsd*1.25*1000000)<=(job?reservationForJob(job):RESERVATION), "cost_out_of_bounds");
  return { outputText:text.replaceAll(apiKey,"[REDACTED]"), usage:{input_tokens:usage.input_tokens,output_tokens:usage.output_tokens,total_tokens:usage.total_tokens,cached_tokens:cached},
    costUsd, costGbpAtReferenceRate:costUsd*0.7546, latencyMs:Math.round(elapsedMs), model:"gpt-5.2", serviceTier:"default" };
}
export async function providerCall(job, key, fetcher=fetch) {
  const response = await fetcher("https://api.openai.com/v1/responses", {method:"POST",redirect:"error",signal:AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:job.body});
  if (!response.ok) { await response.body?.cancel(); throw new Error("provider_rejected"); }
  const reader=response.body?.getReader(); demand(reader,"missing_body");
  const chunks=[];let bytes=0;
  try { while(true) {const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;demand(bytes<=2000000,"oversized_response");chunks.push(Buffer.from(part.value));} }
  finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function executePlan(plan, { ledger, apiKey, transport=providerCall, now=Date.now }) {
  let succeeded=0;
  try {
    const initial=await ledger.inspect(plan.planHash);
    const followup=plan.phase==="followup",prior=followup?plan.priorJobs:[];
    demand(initial.enabled && initial.unexpired && initial.reservedGbpMicros===(followup?3413760:0) && initial.jobs.length===plan.jobs.length+prior.length && initial.jobs.every(j=>
      prior.some(p=>p.id===j.id && p.payloadHash===j.payloadHash && j.state==="succeeded") ||
      plan.jobs.some(p=>p.id===j.id && p.payloadHash===j.payloadHash && j.state==="ready" && (!followup || j.reservationGbpMicros===reservationForJob(p)))),"ledger_not_pristine");
    for (const job of plan.jobs) {
      demand(now()<plan.expires,"expired_authorization");
      // Autocommit has returned before the only provider call. Never refund or recreate an attempt.
      demand(await ledger.reserve(plan.planHash,job.id,job.payloadHash),"duplicate_attempt");
      const start=now();
      let evidence;
      try {evidence=evidenceFromResponse(await transport(job,apiKey),apiKey,now()-start,job);}
      catch {await ledger.finish(plan.planHash,job.id,"unknown",{failure:"provider_outcome_uncertain",latencyMs:now()-start});throw new Error("provider_outcome_uncertain");}
      await ledger.finish(plan.planHash,job.id,"succeeded",evidence);
      succeeded++;
      console.log(JSON.stringify({benchmarkJob:job.id,status:"succeeded",latencyMs:evidence.latencyMs}));
    }
    return {succeeded,reservedGbpMicros:(followup?3413760:0)+plan.jobs.reduce((s,j)=>s+reservationForJob(j),0)};
  } finally {await ledger.disable(plan.planHash);}
}
