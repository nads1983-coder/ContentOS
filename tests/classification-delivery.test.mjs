import test from "node:test";
import assert from "node:assert/strict";
import { harness, requestId } from "./generation-test-helpers.mjs";
import { grounding } from "./grounding-capture-helpers.mjs";
import { request, draft, findings, classificationResponse, repairs } from "./classification-capture-helpers.mjs";

test("captured live draft completes review, bounded correction and every-unit revalidation through the actual route offline", async () => {
  const h = harness({ profile: { plan: "founder", entitlement_source: "founder_offer", amount_paid: 0, subscription_status: "active", savedDraft: "Existing customer draft fixture" } });
  const req = { ...request, requestId: requestId() }, seen = { initial_review: new Set(), fresh_final_revalidation: new Set() };
  h.provider = payload => {
    if (payload.text.format.name !== "social_content_generation") {
      const data = JSON.parse(payload.input);
      for (const u of data.units) { assert.ok(!seen[data.pass].has(u.id)); seen[data.pass].add(u.id); }
      assert.equal(h.data.generation_history_json, undefined, "unchecked draft must never be published");
      assert.equal(h.data.usage_events_json, undefined);
    }
    return classificationResponse(payload);
  };
  const first = await h.post(req), next = await h.post(req, { stage: first.body.nextStage });
  assert.equal(next.body.reviewedUnits, 48);
  const lookup = await h.post(req, { stage: first.body.nextStage, instance: h.instance() });
  assert.equal(h.calls.length, 2); assert.equal(lookup.body.reviewedUnits, 48);
  const done = await h.finish(req, lookup.body.nextStage);
  assert.equal(done.response.status, 200); assert.equal(done.body.sections.length, 14);
  assert.equal(seen.initial_review.size, 280);
  assert.equal(seen.fresh_final_revalidation.size, grounding.groundingUnits(done.body).length);
  assert.equal(h.calls.length, 13); assert.equal(h.data.usage_events_json.length, 1); assert.equal(h.data.generation_history_json.length, 1);
  assert.equal(h.data.savedDraft, "Existing customer draft fixture"); assert.equal(h.data.entitlement_source, "founder_offer");
  for (const f of findings) assert.ok(!f.path.split(".").reduce((v, k) => v[k], done.body).includes(f.quote), f.id);
  for (const id of ["u4", "u17", "u31", "u46"]) {
    const original = grounding.groundingUnits(draft).find(u => u.id === id);
    assert.ok(original.path.split(".").reduce((v, k) => v[k], done.body).includes(original.text));
  }
  assert.ok(done.body.sections.every(s => s.cta === ""));
  assert.ok(!JSON.stringify(done.body.sections).includes("Title idea:"));
  assert.ok(!JSON.stringify(done.body.sections).includes("Subject line options are below"));
  assert.equal((await h.post(req)).response.status, 200); assert.equal(h.calls.length, 13); assert.equal(h.data.usage_events_json.length, 1);
});

test("corrected draft does not bypass full revalidation, even for a single remaining material claim", async () => {
  const h = harness(); let injected = false;
  h.provider = payload => classificationResponse(payload, { change(decisions, data) {
    if (data.pass === "fresh_final_revalidation" && !injected) {
      injected = true;
      decisions[0] = { id: decisions[0].id, kind: "unsupported", sourceIds: [], reason: "missing_evidence", replacement: "Another correction is not authorized." };
    }
  } });
  const req = { ...request, requestId: requestId() }, done = await h.finish(req);
  assert.equal(done.response.status, 502); assert.equal(done.body.code, "grounding_failed");
  assert.equal(h.data.generation_history_json, undefined); assert.equal(h.data.usage_events_json, undefined);
  assert.equal(h.data.generation_reservations_json[0].pipeline.pass, 1);
  const calls = h.calls.length; assert.equal((await h.post(req)).response.status, 409); assert.equal(h.calls.length, calls);
});

test("scripted corrections retain original evidence and remove all nine material findings before revalidation", () => {
  const units = grounding.groundingUnits(draft);
  assert.equal(findings.length, 9);
  for (const finding of findings) assert.ok(repairs.some(r => r.path === finding.path && finding.quote.includes(r.original.trim())), finding.id);
  for (const repair of repairs) assert.equal(units.find(u => u.id === repair.id).text, repair.original);
});
