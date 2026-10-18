import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const cache = new Map();
const runtime = { fetch: async () => { throw new Error("Network forbidden in direct reviewer tests"); }, process: { env: {} } };
const load = (path) => loadTs(path, {}, cache, runtime);
const g = load("lib/factual-grounding.ts");
const b = load("lib/grounding-batches.ts");
const contract = load("lib/generation-contract.ts");
const fixture = JSON.parse(readFileSync(new URL("./fixtures/direct-reviewer-scope.json", import.meta.url), "utf8"));
const encode = (decisions) => JSON.stringify({ decisions });
const requestFor = (pair) => contract.normalizeGenerationRequest({
  source: pair.source, ...pair.brandContext, ctaMode: pair.ctaMode, selectedTypes: ["linkedin"]
});
function packFor(request, body) {
  return contract.parseGenerationOutput(JSON.stringify({
    title: "Draft", summary: "Overview",
    sections: [{ id: "direct-review", type: "linkedin", title: "Draft", platform: "LinkedIn", body, items: [], cta: "" }]
  }), request);
}
function originalSources(request) {
  return { currentBrief: request.source, savedBrand: {
    name: request.brandName ?? "", audience: request.audience ?? "", offer: request.offer ?? ""
  } };
}
function sourceIds(sources, quotes) {
  return quotes.map((quote) => {
    const matches = sources.filter((source) => source.text === quote);
    assert.equal(matches.length, 1, `Expected exactly one complete source statement: ${quote}`);
    return matches[0].id;
  });
}

// These are authored semantic labels, not an LLM simulation or an acceptance search.
// A new/unexpected body must fail the mock rather than being automatically certified.
function certificates(units, sources, pair, mode) {
  const body = mode === "legitimate" ? pair.legitimate.text : pair.unsupported.text;
  return units.map((unit) => {
    if (unit.path === "sections.0.body") {
      assert.equal(unit.text.trim(), body);
      if (mode === "unsupported") return { id: unit.id, kind: "unsupported", sourceIds: [],
        reason: pair.unsupported.reason, replacement: pair.unsupported.replacement };
      return { id: unit.id, kind: "supported", reason: "none", replacement: null,
        sourceIds: sourceIds(sources, mode === "legitimate" ? pair.legitimate.evidence : pair.unsupported.decoyEvidence) };
    }
    assert.ok(["Draft", "Overview", "LinkedIn"].includes(unit.text.trim()), `Unlabelled metadata: ${unit.text}`);
    return { id: unit.id, kind: unit.text.trim() === "LinkedIn" ? "structural" : "subjective",
      sourceIds: [], reason: "none", replacement: null };
  });
}
function fullReferences(decisions, sources) {
  return decisions.map(({ sourceIds: ids, ...decision }) => ({ ...decision,
    references: ids.map((id) => ({ sourceId: id, quote: sources.find((source) => source.id === id).text }))
  }));
}
function assertContext(wire, request, sources) {
  assert.deepEqual(wire.originalSources, originalSources(request));
  assert.deepEqual(wire.sources, sources);
  assert.equal(new Set(wire.sources.map((source) => source.id)).size, sources.length);
}

test("eight synthetic pairs retain the unchanged sealed original and fixed semantic expectations", () => {
  const original = readFileSync(new URL("./fixtures/independent-grounding-scope.json", import.meta.url));
  assert.equal(createHash("sha256").update(original).digest("hex"), fixture.sealedFixture.sha256);
  assert.equal(fixture.pairs.length, 8);
  assert.equal(new Set(fixture.pairs.map((pair) => pair.sealedCaseId)).size, 8);
  for (const pair of fixture.pairs) {
    assert.equal(pair.legitimate.expected, "allow");
    assert.equal(pair.unsupported.expected, "repair");
    assert.equal(pair.unsupported.replacement, pair.legitimate.text);
  }
});

for (const pair of fixture.pairs) {
  test(`${pair.id}: legitimate supported certificate passes the actual batch and whole parsers`, () => {
    const request = requestFor(pair), result = packFor(request, pair.legitimate.text);
    const batch = b.groundingBatch(result, request, 0, 0), wire = JSON.parse(batch.input);
    assertContext(wire, request, g.buildGroundingContext(request).sources);
    assert.deepEqual(wire.wholePack, g.groundingFields(result).filter(([, text]) => text));
    assert.equal(wire.pass, "initial_review");
    const decisions = certificates(batch.units, batch.context.sources, pair, "legitimate");
    const parsed = b.parseBatchReview(encode(decisions), batch);
    assert.deepEqual(parsed, g.parseGroundingReview(encode(fullReferences(decisions, wire.sources)), batch.units, batch.context));
    for (const decision of parsed.decisions) for (const reference of decision.references) {
      assert.equal(reference.quote, wire.sources.find((source) => source.id === reference.sourceId).text);
    }
  });

  test(`${pair.id}: honest unsupported decision repairs and fresh batch revalidates with full original context`, () => {
    const request = requestFor(pair), result = packFor(request, pair.unsupported.text);
    const batch = b.groundingBatch(result, request, 0, 0);
    const review = b.parseBatchReview(encode(certificates(batch.units, batch.context.sources, pair, "unsupported")), batch);
    assert.equal(review.decisions.filter((decision) => decision.kind === "unsupported").length, 1);
    assert.equal(review.decisions.find((decision) => decision.kind === "unsupported").reason, pair.unsupported.reason);
    const fixed = g.repairGrounding(result, batch.units, review, request);
    assert.equal(fixed.sections[0].body, pair.legitimate.text);
    assert.equal(result.sections[0].body, pair.unsupported.text);
    assert.equal(fixed.id, result.id);
    assert.equal(fixed.createdAt, result.createdAt);
    const fresh = b.groundingBatch(fixed, request, 0, 1), wire = JSON.parse(fresh.input);
    assertContext(wire, request, batch.context.sources);
    assert.equal(wire.pass, "fresh_final_revalidation");
    assert.deepEqual(wire.wholePack, g.groundingFields(fixed).filter(([, text]) => text));
    assert.ok(!wire.wholePack.some(([, text]) => text === pair.unsupported.text));
    const accepted = b.parseBatchReview(encode(certificates(fresh.units, fresh.context.sources, pair, "legitimate")), fresh);
    assert.ok(accepted.decisions.every((decision) => decision.kind !== "unsupported"));
  });

  test(`${pair.id}: whole-review callback retains original sources during repair and fresh revalidation`, async () => {
    const request = requestFor(pair), result = packFor(request, pair.unsupported.text);
    const sources = g.buildGroundingContext(request).sources;
    let calls = 0;
    const fixed = await g.groundGeneration(result, request, async (input) => {
      const wire = JSON.parse(input);
      assertContext(wire, request, sources);
      assert.ok(calls < 2, "No third review expected for the authored valid repair");
      const mode = calls++ === 0 ? "unsupported" : "legitimate";
      return encode(fullReferences(certificates(wire.units, wire.sources, pair, mode), wire.sources));
    });
    assert.equal(calls, 2);
    assert.equal(fixed.sections[0].body, pair.legitimate.text);
  });

  test(`${pair.id}: wrong supported certificate cannot borrow a different relationship`, () => {
    const request = requestFor(pair), result = packFor(request, pair.unsupported.text);
    const batch = b.groundingBatch(result, request, 0, 0);
    const decisions = certificates(batch.units, batch.context.sources, pair, "tampered");
    assert.throws(() => b.parseBatchReview(encode(decisions), batch), g.GroundingError,
      `Wrong supported certificate bypass: ${pair.boundary}: ${pair.unsupported.text}`);
  });
}

test("every batch of both passes retains unsplit multi-paragraph context, all statements and the whole pack", () => {
  const request = contract.normalizeGenerationRequest({
    source: "Fictional service notice.\n\nThe Larch session lasts 45 minutes; it costs GBP20.\nNo refunds are available.\nThis notice supersedes the saved offer: sessions are on Wednesday only.",
    brandName: "Larch", audience: "Independent illustrators", offer: "Sessions were held every weekday.",
    writingStyle: "Plain language", contentGoal: "Explain the current notice", ctaMode: "none", selectedTypes: ["linkedin"]
  });
  const context = g.buildGroundingContext(request);
  assert.ok(context.sources.some((source) => source.text === "No refunds are available."));
  assert.ok(context.sources.some((source) => source.origin === "brand" && source.field === "offer"));
  const result = packFor(request, Array(100).fill("The Larch session lasts 45 minutes.").join("\n"));
  const all = g.groundingUnits(result);
  assert.ok(all.length > 2 * b.REVIEW_BATCH_SIZE);
  for (const pass of [0, 1]) {
    const first = b.groundingBatch(result, request, 0, pass), seen = new Set();
    for (let index = 0; index < first.count; index++) {
      const batch = b.groundingBatch(result, request, index, pass), wire = JSON.parse(batch.input);
      assertContext(wire, request, context.sources);
      assert.equal(wire.pass, pass === 0 ? "initial_review" : "fresh_final_revalidation");
      assert.deepEqual(wire.wholePack, g.groundingFields(result).filter(([, text]) => text));
      assert.deepEqual(wire.units.map((unit) => unit.id), batch.units.map((unit) => unit.id));
      for (const unit of batch.units) {
        assert.ok(!seen.has(unit.id)); seen.add(unit.id);
        assert.deepEqual(unit, all.find((other) => other.id === unit.id));
      }
    }
    assert.deepEqual(seen, new Set(all.map((unit) => unit.id)));
    assert.throws(() => b.groundingBatch(result, request, first.count, pass), g.GroundingError);
  }
});

test("batch parser rejects invented, duplicate, missing and cross-batch references or units", () => {
  const pair = fixture.pairs.find((value) => value.sealedCaseId === "scope-21"), request = requestFor(pair);
  const batch = b.groundingBatch(packFor(request, pair.legitimate.text), request, 0, 0);
  const valid = certificates(batch.units, batch.context.sources, pair, "legitimate");
  const bodyIndex = batch.units.findIndex((unit) => unit.path === "sections.0.body");
  b.parseBatchReview(encode(valid), batch);
  for (const mutate of [
    (decisions) => { decisions[bodyIndex].sourceIds = ["s-nonexistent"]; },
    (decisions) => { decisions[bodyIndex].sourceIds.push(decisions[bodyIndex].sourceIds[0]); },
    (decisions) => { decisions[bodyIndex].sourceIds = []; },
    (decisions) => { decisions[bodyIndex].sourceIds = [null]; },
    (decisions) => { decisions[bodyIndex].references = []; },
    (decisions) => { decisions[bodyIndex].quote = "returns accepted"; },
    (decisions) => { decisions.pop(); },
    (decisions) => { decisions[0].id = decisions[1].id; }
  ]) {
    const corrupted = structuredClone(valid); mutate(corrupted);
    assert.throws(() => b.parseBatchReview(encode(corrupted), batch), g.GroundingError);
  }
  const long = packFor(request, Array(60).fill(pair.legitimate.text).join("\n"));
  const first = b.groundingBatch(long, request, 0, 0), next = b.groundingBatch(long, request, 1, 0);
  const crossBatch = certificates(first.units, first.context.sources, pair, "legitimate");
  crossBatch[0].id = next.units[0].id;
  assert.throws(() => b.parseBatchReview(encode(crossBatch), first), g.GroundingError);
});
