import assert from "node:assert/strict";
import test from "node:test";
import { harness, input, output, receipt, source } from "./generation-test-helpers.mjs";

test("draft rejection retains exact private evidence, not delivered content, and never retries", async () => {
  const h = harness();
  const returned = { ...receipt(), output_text: '{"private":"synthetic@example.invalid"}' };
  h.provider = async () => returned;
  const first = await h.post();
  assert.equal(first.response.status, 502);
  assert.equal(first.body.stage, "draft");
  assert.equal(first.body.diagnostic, "section_count");
  assert.match(first.body.error, /before factual review/);
  const p = h.data.generation_reservations_json[0].pipeline;
  assert.equal(p.metrics[0].diagnostic, "section_count");
  assert.equal(p.failureEvidence.captured, true);
  assert.deepEqual(p.failureEvidence.receipt, returned);
  assert.equal(p.failureEvidence.request.source, source);
  assert.equal(p.failureEvidence.responseHash, h.load("lib/generation-pipeline.ts").pipelineHash(returned));
  assert.equal(p.draft, undefined);
  assert.equal(h.data.generation_history_json, undefined);
  assert.equal(h.data.usage_events_json, undefined);
  const saved = structuredClone(h.data);
  assert.equal((await h.post()).response.status, 409);
  assert.deepEqual(h.data, saved);
  assert.equal(h.calls.length, 1);
  assert.equal(h.analytics[0][1].failure_reason, "section_count");
  for (const exposed of [first.body, h.analytics, h.logs]) {
    assert.ok(!JSON.stringify(exposed).includes("synthetic@example.invalid"));
    assert.ok(!JSON.stringify(exposed).includes(source));
    assert.ok(!JSON.stringify(exposed).includes("failureEvidence"));
  }
});

test("distinct draft failures retain distinct safe diagnostics, without changing refusal rules", async () => {
  const cases = [
    [{ ...receipt(), output_text: "not JSON" }, "output_json"],
    [{ ...receipt(), status: "incomplete" }, "provider_incomplete"],
    [receipt(output({ sections: [{ ...output().sections[0], body: "", items: [] }] })), "empty_section"],
    [receipt(output({ sections: [{ ...output().sections[0], body: "#tag" }] })), "missing_copy"],
    [receipt(output({ sections: [{ ...output().sections[0], type: "twitter" }] })), "section_identity"],
    [receipt(output({ title: "" })), "empty_text"]
  ];
  for (const [response, diagnostic] of cases) {
    const h = harness(); h.provider = async () => response;
    assert.equal((await h.post()).body.diagnostic, diagnostic);
    assert.equal(h.data.usage_events_json, undefined);
  }
});

test("over-bound response cannot enlarge the checkpoint, still retains diagnostic and hash", async () => {
  const h = harness();
  const response = { ...receipt(), output_text: "x".repeat(300_000) };
  h.provider = async () => response;
  assert.equal((await h.post()).body.diagnostic, "provider_response_size");
  const p = h.data.generation_reservations_json[0].pipeline;
  assert.equal(p.failureEvidence.captured, false);
  assert.equal(p.failureEvidence.receipt, undefined);
  assert.equal(p.failureEvidence.responseHash, h.load("lib/generation-pipeline.ts").pipelineHash(response));
  assert.ok(JSON.stringify(p).length < 3000);
  await h.post(); assert.equal(h.calls.length, 1);
});

test("review failures remain separate, preserve draft, and never appear as successful usage", async () => {
  const h = harness();
  h.provider = async payload => payload.text.format.name === "social_content_generation"
    ? receipt() : receipt({ decisions: [] });
  const failed = await h.finish();
  assert.equal(failed.body.code, "grounding_failed");
  assert.equal(failed.body.diagnostic, "review_unavailable");
  assert.match(failed.body.error, /Factual validation/);
  assert.ok(h.data.generation_reservations_json[0].pipeline.draft);
  assert.equal(h.data.generation_history_json, undefined);
  assert.equal(h.data.usage_events_json, undefined);
  assert.equal(h.calls.length, 2);
});

test("unexpected exceptions expose no exception text and preserve failed receipt", async () => {
  const h = harness();
  const stages = h.load("lib/generation-stages.ts"), contract = h.load("lib/generation-contract.ts");
  const req = contract.normalizeGenerationRequest(input());
  const a = stages.beginGenerationStage(h.data, "user-test", req.requestId, req, null);
  const brokenRequest = { ...req, selectedTypes: null };
  const result = stages.checkpointGenerationStage(a.data, "user-test", req.requestId,
    a.result.fingerprint, a.result.stage, brokenRequest, receipt(), 20);
  assert.equal(result.result.diagnostic, "internal_validation_error");
  assert.equal(result.result.sections, undefined);
});
