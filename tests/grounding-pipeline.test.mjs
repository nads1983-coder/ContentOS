import assert from "node:assert/strict";
import test from "node:test";
import { harness, input, receipt, reviewReceipt, requestId, source, loadTs } from "./generation-test-helpers.mjs";
import { captured, grounding, batches, captureResponse } from "./grounding-capture-helpers.mjs";

test("captured 719 units have disjoint exhaustive batch coverage, all context and no format-number flags", () => {
  let total = 0;
  for (const pack of captured) {
    const first = batches.groundingBatch(pack.result, pack.request, 0, 0), seen = new Set();
    for (let n = 0; n < first.count; n++) {
      const b = batches.groundingBatch(pack.result, pack.request, n, 0), wire = JSON.parse(b.input);
      assert.ok(b.units.length <= 48); assert.deepEqual(wire.sources, first.context.sources);
      assert.deepEqual(wire.wholePack, grounding.groundingFields(pack.result).filter(([, text]) => text));
      for (const u of b.units) {
        assert.ok(!seen.has(u.id)); seen.add(u.id);
        assert.deepEqual(grounding.deterministicIssues(u, b.context), u.text.startsWith("Title idea:") ? ["meta_copy"] : []);
        const original = first.all.find(v => v.id === u.id); assert.deepEqual(u, original);
      }
    }
    assert.equal(seen.size, first.all.length); total += seen.size;
    assert.throws(() => batches.groundingBatch(pack.result, pack.request, first.count, 0));
  }
  assert.equal(total, 719);
});
for (const pack of captured) test(`${pack.id}: full captured pack completes offline through actual route and durable checkpoints`, async () => {
  const h = harness(); h.provider = p => captureResponse(pack, p);
  const req = { ...pack.request, requestId: requestId() };
  const result = await h.finish(req);
  assert.equal(result.response.status, 200); assert.equal(result.body.sections.length, 14);
  const expected = structuredClone(pack.result.sections);
  expected[5].body = expected[5].body.replace(/^Title idea: /, "");
  assert.deepEqual(result.body.sections, expected);
  const entry = h.data.generation_reservations_json[0];
  assert.equal(entry.pipelineAudit.reviewedUnits, grounding.groundingUnits(pack.result).length);
  assert.equal(h.calls.length, 1 + 2 * Math.ceil(entry.pipelineAudit.reviewedUnits / 48));
  assert.equal(h.data.usage_events_json.length, 1);
  assert.ok(entry.pipelineAudit.reservedMicroUsd < 4_000_000);
});
test("interrupted captured review resumes from next batch, not from draft or prior reviews", async () => {
  const pack = captured[1], h = harness(); h.provider = p => captureResponse(pack, p);
  const req = { ...pack.request, requestId: requestId() };
  let r = await h.post(req); r = await h.post(req, { stage: r.body.nextStage });
  assert.equal(r.body.reviewedUnits, 48);
  // Simulate reload with no remembered stage: first request is a progress lookup only.
  const lookup = await h.post(req, { instance: h.instance() });
  assert.equal(h.calls.length, 2); assert.equal(lookup.body.reviewedUnits, 48);
  assert.equal((await h.finish(req, lookup.body.nextStage)).response.status, 200);
  assert.equal(h.calls.length, 13);
});
test("one corruption/missing batch fails closed for the entire captured pack", async () => {
  const pack = captured[2], h = harness(); let calls = 0;
  h.provider = p => { calls++; return calls === 4 ? receipt({ decisions: [] }) : captureResponse(pack, p); };
  const r = await h.finish({ ...pack.request, requestId: requestId() });
  assert.equal(r.body.code, "grounding_failed"); assert.equal(h.data.generation_history_json, undefined);
  assert.equal(h.data.generation_reservations_json[0].pipeline.decisions.length, 96);
});
test("compact references preserve complete source negation; invented sources and source flooding fail", () => {
  const pack = captured[0], b = batches.groundingBatch(pack.result, pack.request, 0, 0);
  const response = captureResponse(pack, { input: b.input, text: { format: { name: "review" } } });
  const parsed = batches.parseBatchReview(response.output_text, b);
  for (const d of parsed.decisions) for (const ref of d.references) assert.equal(ref.quote, b.context.sources.find(s => s.id === ref.sourceId).text);
  const bad = JSON.parse(response.output_text); bad.decisions[0].sourceIds = ["s-does-not-exist"];
  assert.throws(() => batches.parseBatchReview(JSON.stringify(bad), b));
  bad.decisions[0].sourceIds = Array(13).fill("s0"); assert.throws(() => batches.parseBatchReview(JSON.stringify(bad), b));
});
test("No CTA, invented price, guarantees and duration promises are removed and freshly revalidated, never approved", async () => {
  for (const text of ["Book now for GBP99.", "Our service guarantees 90% higher income.", "Finish your business plan in 45 minutes."]) {
    const h = harness(); h.provider = async p => p.text.format.name === "social_content_generation"
      ? receipt({ title: "Planning", summary: source, sections: [{ id: "a", type: "linkedin", title: "Planning", platform: "LinkedIn", body: text, items: [], cta: "" }] }) : reviewReceipt(p);
    const r = await h.finish(input({ ctaMode: "none" }));
    assert.equal(r.response.status, 200); assert.equal(r.body.sections[0].body, "A planning checklist is being tested with five designers.");
    assert.ok(!JSON.stringify(r.body).includes(text)); assert.equal(h.calls.length, 3);
    const metrics = h.data.generation_reservations_json[0].pipelineAudit.metrics;
    assert.deepEqual(metrics.map(m => m.kind), ["draft", "review", "correction", "revalidation", "save"]);
    assert.equal(h.data.usage_events_json.length, 1);
  }
});
test("whole-pack contradiction information is present even when conflicting unit is outside this batch", () => {
  const pack = structuredClone(captured[1]); pack.result.sections.at(-1).body = "The assessment is free and lasts 40 minutes.";
  const b = batches.groundingBatch(pack.result, pack.request, 0, 0), wire = JSON.parse(b.input);
  assert.ok(wire.wholePack.some(([, text]) => text.includes("free and lasts 40")));
  assert.ok(!b.units.some(u => u.text.includes("free and lasts 40")));
  assert.match(batches.batchReviewInstructions, /cross-format/);
});
test("call and monetary caps stop dispatch without refunds", async () => {
  for (const mutate of [p => { p.reservedMicroUsd = 4_000_000; }, p => { p.metrics = Array.from({ length: 23 }, (_, i) => ({ key: `old${i}`, payloadHash: "hash", status: "complete" })); }]) {
    const h = harness(); const r = await h.post(); mutate(h.data.generation_reservations_json[0].pipeline);
    assert.equal((await h.post(input(), { stage: r.body.nextStage })).body.code, "generation_budget"); assert.equal(h.calls.length, 1);
  }
});
test("payload and durable journal byte caps fail closed before dispatch", async () => {
  const p = loadTs("lib/generation-pipeline.ts");
  assert.throws(() => p.planProviderStage(p.newGenerationPipeline(), { ...input(), source: "x".repeat(170_000) }));
  const h = harness(); const r = await h.post();
  h.data.generation_reservations_json[0].pipeline.draft.source = "x".repeat(750_001);
  assert.equal((await h.post(input(), { stage: r.body.nextStage })).body.code, "checkpoint_limit");
  assert.equal(h.calls.length, 1);
});
test("legacy history, usage and Founder entitlement survive staged completion", async () => {
  const h = harness({ profile: { entitlement_source: "founder_offer", amount_paid: 0, subscription_status: "cancelled", originalContent: { title: "Synthetic saved draft" } } });
  const before = structuredClone(h.data);
  assert.equal((await h.finish()).response.status, 200);
  assert.deepEqual(h.data.originalContent, before.originalContent); assert.equal(h.data.entitlement_source, "founder_offer");
  assert.equal(h.data.amount_paid, 0); assert.equal(h.data.subscription_status, "cancelled");
});
test("expiry is terminal, does not redispatch, and legacy in-flight attempts are never restarted", async () => {
  const h = harness(); await h.post(); h.now = new Date(h.now.getTime() + 46 * 60_000);
  assert.equal((await h.post()).body.code, "request_expired"); assert.equal(h.calls.length, 1);
  const legacy = harness(); await legacy.repository.reserveTextGeneration("user-test", requestId(), legacy.load("lib/generation-contract.ts").normalizeGenerationRequest(input()));
  assert.equal((await legacy.post()).body.code, "request_in_progress"); assert.equal(legacy.calls.length, 0);
});
test("unvalidated or altered result cannot be completed through the repository", async () => {
  const h = harness(); const a = await h.post(), entry = h.data.generation_reservations_json[0];
  await assert.rejects(h.repository.completeTextGeneration("user-test", requestId(), entry.fingerprint, entry.pipeline.draft), /validation is incomplete/);
  await h.post(input(), { stage: a.body.nextStage });
  await assert.rejects(h.repository.completeTextGeneration("user-test", requestId(), entry.fingerprint, { ...entry.pipeline.draft, summary: "Fabricated." }), /validated checkpoint/);
});
test("per-stage remaining time preserves cleanup headroom without a shared cross-stage clock", () => {
  const { remainingGenerationTime } = loadTs("lib/generation-contract.ts");
  for (const [elapsed, expected] of [[0, 90_000], [35_000, 65_000], [99_999, 1], [120_000, 0]]) assert.equal(remainingGenerationTime(elapsed), expected);
});
