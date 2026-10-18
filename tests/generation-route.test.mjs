import assert from "node:assert/strict";
import test from "node:test";
import { harness, input, output, receipt, reviewReceipt, requestId, source } from "./generation-test-helpers.mjs";

test("one bounded provider call per HTTP request; only fully reviewed packs enter history", async () => {
  const h = harness();
  const draft = await h.post();
  assert.equal(draft.response.status, 202); assert.equal(draft.body.stage, "review");
  assert.equal(h.calls.length, 1); assert.equal(h.data.generation_history_json, undefined);
  assert.equal(draft.body.sections, undefined); assert.ok(!JSON.stringify(draft.body).includes(source));
  assert.equal(h.clientOptions.maxRetries, 0); assert.equal(h.clientOptions.timeout, 90_000); assert.equal(h.clientOptions.logLevel, "off");
  const done = await h.finish(input(), draft.body.nextStage);
  assert.equal(done.response.status, 200); assert.equal(done.body.sections.length, 1);
  assert.equal(h.calls.length, 2); assert.equal(h.data.usage_events_json.length, 1);
  assert.equal(h.data.generation_reservations_json[0].pipelineAudit.metrics.filter(m => m.payloadHash).length, 2);
});
test("unsafe, anonymous, invalid and unconfigured requests never admit or call", async () => {
  for (const [opts, body, status] of [[{ unsafe: true }, input(), 403], [{ anonymous: true }, input(), 401],
    [{}, { source: "bad" }, 400], [{ noDatabase: true }, input(), 503], [{ noKey: true }, input(), 503], [{ model: "unknown-price-model" }, input(), 503]]) {
    const h = harness(opts), r = await h.post(body);
    assert.equal(r.response.status, status); assert.equal(h.calls.length, 0); assert.equal(h.data.generation_reservations_json, undefined);
  }
});
test("missing/stale account header is rejected before parsing and storage", async () => {
  for (const account of [null, "", "other-account"]) {
    const h = harness(), r = await h.post(input(), { account, rawBody: "{" });
    assert.equal(r.response.status, 409); assert.equal(r.body.code, "account_changed");
    assert.equal(r.bodyRead, false); assert.equal(h.calls.length, 0);
  }
});
test("paid-format and monthly quota enforcement precede dispatch", async () => {
  const free = harness({ profile: { plan: "free", subscription_status: "none" } });
  assert.equal((await free.post(input({ selectedTypes: ["repurposePack"] }))).response.status, 403);
  const window = free.load("lib/usage.ts").currentUsageWindow(new Date());
  free.data = { ...free.data, generation_usage_json: { [window.periodStart]: 3 } };
  assert.equal((await free.post()).body.code, "quota_exceeded"); assert.equal(free.calls.length, 0);
});
test("attempt rate limiting retains Retry-After and resumed stages do not spend new attempt slots", async () => {
  const h = harness(); await h.finish();
  assert.equal(h.data.text_generation_daily_attempts_json.count, 1);
  h.data = { ...h.data, text_generation_attempts_json: Array(20).fill(Date.now()) };
  const r = await h.post(input({ source: `${source} New.`, requestId: requestId(2) }));
  assert.equal(r.response.status, 429); assert.ok(Number(r.response.headers.get("Retry-After")) > 0);
});
test("completed replay charges once and does not call provider again", async () => {
  const h = harness(); const first = await h.finish(); const replay = await h.finish();
  assert.equal(replay.body.id, first.body.id); assert.equal(h.calls.length, 2);
  assert.equal(h.data.usage_events_json.length, 1); assert.equal(h.data.generation_history_json.length, 1);
});
test("same ID with changed inputs and new-ID duplicate work are refused", async () => {
  const h = harness(); await h.post();
  assert.equal((await h.post(input({ source: `${source} Different.` }))).body.code, "request_mismatch");
  assert.equal((await h.post(input({ requestId: requestId(2) }))).body.code, "duplicate_in_progress");
  assert.equal(h.calls.length, 1);
});
test("separate application instances coordinate concurrent dispatch through the repository lock", async () => {
  const h = harness(); let release; const gate = new Promise(r => { release = r; });
  h.provider = async () => { await gate; return receipt(); };
  const first = h.post();
  while (!h.calls.length) await new Promise(r => setTimeout(r, 1));
  const second = await h.post(input(), { instance: h.instance() });
  assert.equal(second.body.running, true); assert.equal(second.response.status, 202); assert.equal(h.calls.length, 1);
  release(); await first;
  const repeated = await h.post(); assert.equal(repeated.body.stage, "review"); assert.equal(h.calls.length, 1);
});
test("malformed/refused/incomplete drafts remain terminal and do not consume successful usage", async () => {
  for (const response of [{ ...receipt(), output_text: "" }, { ...receipt(), output_text: "{}" },
    { ...receipt(), status: "incomplete" }, { ...receipt(), status: "failed" }]) {
    const h = harness(); h.provider = async () => response;
    assert.equal((await h.post()).body.code, "generation_failed");
    assert.equal((await h.post()).response.status, 409); assert.equal(h.calls.length, 1); assert.equal(h.data.usage_events_json, undefined);
  }
});
test("provider timeout, abort and connection errors retain reservations and never retry", async () => {
  for (const name of ["Error", "APIConnectionTimeoutError", "APIUserAbortError"]) {
    const h = harness(); h.provider = async () => { throw Object.assign(new Error("private provider detail"), { name }); };
    assert.equal((await h.post()).body.code, "generation_uncertain");
    const p = h.data.generation_reservations_json[0].pipeline;
    assert.ok(p.reservedMicroUsd > 0); assert.equal(p.metrics[0].status, "unknown");
    await h.post(); assert.equal(h.calls.length, 1); assert.equal(h.data.usage_events_json, undefined);
  }
});
test("installed SDK performs no retry on 429, 500 or network exceptions", async () => {
  for (const failure of [429, 500, "connection", "timeout"]) {
    let calls = 0;
    const h = harness({ sdkFetch: async () => { calls++; if (typeof failure === "string") throw new Error(failure);
      return Response.json({ error: { message: "Synthetic failure" } }, { status: failure, headers: { "x-should-retry": "true" } }); } });
    assert.equal((await h.post()).body.code, "generation_uncertain"); assert.equal(calls, 1);
  }
});
test("lost draft checkpoint acknowledgment resumes review without repeating draft", async () => {
  const h = harness(); h.provider = async p => { if (p.text.format.name === "social_content_generation") h.fault = "lost-ack"; return p.text.format.name === "social_content_generation" ? receipt() : reviewReceipt(p); };
  assert.equal((await h.post()).body.code, "generation_save_uncertain");
  assert.equal((await h.finish()).response.status, 200); assert.equal(h.calls.length, 2);
});
test("checkpoint rollback/crash after paid work is terminal uncertainty, never lease takeover", async () => {
  const h = harness(); h.provider = async () => { h.fault = "rollback"; return receipt(); };
  assert.equal((await h.post()).response.status, 503);
  assert.equal((await h.post()).body.running, true); assert.equal(h.calls.length, 1);
  h.now = new Date(h.now.getTime() + 121_000);
  assert.equal((await h.post()).body.code, "generation_uncertain"); assert.equal(h.calls.length, 1);
});
test("final save rollback is resumable without another draft or review", async () => {
  const h = harness(); const a = await h.post(); const b = await h.post(input(), { stage: a.body.nextStage });
  assert.equal(b.body.stage, "save"); h.fault = "rollback";
  assert.equal((await h.post(input(), { stage: b.body.nextStage })).response.status, 503);
  assert.equal((await h.finish(input(), b.body.nextStage)).response.status, 200); assert.equal(h.calls.length, 2);
});
test("lost final save acknowledgment converges to exactly one history/usage entry", async () => {
  const h = harness(); const a = await h.post(); const b = await h.post(input(), { stage: a.body.nextStage });
  h.fault = "lost-ack"; assert.equal((await h.post(input(), { stage: b.body.nextStage })).response.status, 503);
  assert.equal((await h.finish()).response.status, 200); assert.equal(h.data.usage_events_json.length, 1); assert.equal(h.calls.length, 2);
});
test("correction is a measured local stage followed by complete fresh revalidation", async () => {
  const h = harness(); let reviews = 0;
  h.provider = async p => {
    if (p.text.format.name === "social_content_generation") return receipt(output({ sections: [{ ...output().sections[0], body: "Our checklist guarantees 90% more income." }] }));
    reviews++;
    return reviewReceipt(p, (d, unit) => unit.text.includes("90%") ? { ...d, kind: "unsupported", reason: "guarantee", replacement: source } : d);
  };
  const r = await h.finish(); assert.equal(r.response.status, 200); assert.equal(r.body.sections[0].body, source); assert.equal(reviews, 2);
  const audit = h.data.generation_reservations_json[0].pipelineAudit;
  assert.deepEqual(audit.metrics.map(m => m.kind), ["draft", "review", "correction", "revalidation", "save"]);
  assert.ok(audit.metrics.every(m => Number.isFinite(m.durationMs)));
});
test("second-pass violation refuses delivery with no third review or regenerated draft", async () => {
  const h = harness(); h.provider = async p => p.text.format.name === "social_content_generation" ? receipt()
    : reviewReceipt(p, (d, u) => u.path === "sections.0.body" ? { ...d, kind: "unsupported", reason: "missing_evidence", replacement: "An unsupported fact remains." } : d);
  assert.equal((await h.finish()).body.code, "grounding_failed"); assert.equal(h.calls.length, 3); assert.equal(h.data.generation_history_json, undefined);
});
test("missing/duplicate/counterfeit/incomplete review coverage cannot certify a batch", async () => {
  for (const change of [() => receipt({ decisions: [] }), () => ({ ...receipt({ decisions: [] }), status: "incomplete" }),
    p => reviewReceipt(p, d => ({ ...d, sourceIds: ["invented"] })), p => { const r = reviewReceipt(p), v = JSON.parse(r.output_text); v.decisions[1] = v.decisions[0]; return receipt(v); }]) {
    const h = harness(); h.provider = async p => p.text.format.name === "social_content_generation" ? receipt() : change(p);
    const r = await h.finish(); assert.equal(r.body.code, "grounding_failed"); assert.ok(!JSON.stringify(r.body).includes(source)); assert.equal(h.data.usage_events_json, undefined);
  }
});
test("review infrastructure failure retains the completed draft without redelivery or repeated spend", async () => {
  const h = harness(); h.provider = async p => { if (p.text.format.name !== "social_content_generation") throw new Error("secret review"); return receipt(); };
  assert.equal((await h.finish()).body.code, "generation_uncertain");
  assert.ok(h.data.generation_reservations_json[0].pipeline.draft); await h.post(); assert.equal(h.calls.length, 2);
});
test("telemetry is per-stage and excludes source, IDs, raw errors and provider metadata", async () => {
  const h = harness(); await h.finish();
  assert.equal(h.analytics.length, 2);
  for (const [, f] of h.analytics) { assert.equal(f.input_tokens, 100); assert.equal(f.output_tokens, 200); assert.ok(f.duration_ms >= 0); }
  assert.ok(!JSON.stringify(h.analytics).includes(source)); assert.ok(!JSON.stringify(h.analytics).includes(requestId()));
  h.provider = async () => { throw new Error(`private@example.invalid ${source}`); };
  await h.post(input({ requestId: requestId(2), source: `${source} Another.` }));
  assert.ok(!JSON.stringify(h.logs).includes("private@")); assert.ok(!JSON.stringify(h.logs).includes(source));
});
test("analytics failure does not corrupt stage success or delivery", async () => { assert.equal((await harness({ analyticsError: true }).finish()).response.status, 200); });
test("aborted initial request and exhausted route admission budget do not dispatch", async () => {
  const c = new AbortController(); c.abort(); const h = harness();
  assert.equal((await h.post(input(), { signal: c.signal })).response.status, 408); assert.equal(h.calls.length, 0);
  assert.equal((await harness({ remaining: 0 }).post()).response.status, 408);
});
test("disconnect after accepted draft still checkpoints it but never starts review in that request", async () => {
  const c = new AbortController(), h = harness(); h.provider = async () => { c.abort(); return receipt(); };
  const r = await h.post(input(), { signal: c.signal }); assert.equal(r.response.status, 202); assert.equal(h.calls.length, 1); assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
});
test("account switching cannot resume another account's stage or expose draft", async () => {
  const h = harness(); await h.post(); const original = structuredClone(h.data);
  h.userId = "other-user"; const r = await h.post(input(), { account: "user-test", stage: "1:review:0:0" });
  assert.equal(r.body.code, "account_changed"); assert.deepEqual(h.data, original); assert.equal(h.calls.length, 1);
});
test("stale stage token can read progress but cannot dispatch the next paid stage", async () => {
  const h = harness(); await h.post(); const r = await h.post(input(), { stage: "1:draft:0:0" });
  assert.equal(r.body.stage, "review"); assert.equal(h.calls.length, 1);
  assert.equal((await h.post(input(), { stage: "invalid" })).response.status, 400);
});
test("missing, malformed or over-bound usage halts paid continuations with full reservation retained", async () => {
  for (const usage of [undefined, { input_tokens: "private@example.invalid", output_tokens: -1 }, { input_tokens: 100, output_tokens: 24_001 }, { input_tokens: 1_000_000, output_tokens: 1 }]) {
    const h = harness(); h.provider = async () => ({ ...receipt(), usage });
    assert.equal((await h.post()).body.code, "generation_uncertain");
    await h.post(); assert.equal(h.calls.length, 1);
    assert.ok(h.data.generation_reservations_json[0].pipeline.reservedMicroUsd > 0);
    assert.ok(!JSON.stringify(h.analytics).includes("private@"));
  }
});
