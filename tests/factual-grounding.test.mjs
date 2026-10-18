import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
function loadTs(relative, cache = new Map()) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  });
  const require = (id) => id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`, cache) : nativeRequire(id);
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}

const cache = new Map();
const grounding = loadTs("lib/factual-grounding.ts", cache);
const contract = loadTs("lib/generation-contract.ts", cache);
const { buildGroundingContext, groundingUnits, deterministicIssues, parseGroundingReview,
  groundGeneration, GroundingError, GROUNDING_LIMITS } = grounding;
const { normalizeGenerationRequest, parseGenerationOutput, GenerationOutputError,
  REPURPOSE_LABELS, HASHTAG_LABELS } = contract;
const fixtures = JSON.parse(readFileSync(resolve(root, "tests/fixtures/grounding-regressions.json"), "utf8"));
const source = "Example Studio is testing a weekly planning checklist. Results are not available yet.";
const fact = "Example Studio is testing a weekly planning checklist.";
const types = fixtures.briefs.pilot.selectedTypes;
const request = (extra = {}) => normalizeGenerationRequest({ source, selectedTypes: ["linkedin"], ...extra });
const fixture = (id) => {
  const value = fixtures.cases.find((item) => item.id === id);
  assert.ok(value, `Missing fixture ${id}`);
  return value;
};
function rawPack(selected = ["linkedin"], body = fact) {
  return {
    title: "Draft", summary: "Overview",
    sections: selected.map((type) => {
      let items = [];
      if (type === "hooks") items = Array(8).fill(fact);
      if (type === "ctas" || type === "carousel" || type === "xThread") items = Array(5).fill(fact);
      if (type === "emailNewsletter") items = ["A planning note", "A checklist note", "A studio note"];
      if (type === "repurposePack") items = REPURPOSE_LABELS.map((label) => `${label} ${fact}`);
      if (type === "platformHashtags") items = HASHTAG_LABELS.map((label) => `${label} #Planning`);
      return { id: `${type}-fixture`, type, title: "Draft", platform: "LinkedIn", body, items, cta: "" };
    })
  };
}
const pack = (req = request(), body = fact) => parseGenerationOutput(JSON.stringify(rawPack(req.selectedTypes, body)), req);
const supported = (id, statement, quote = statement.text) => ({
  id, kind: "supported", references: [{ sourceId: statement.id, quote }], reason: "none", replacement: null
});
const allowed = (id, kind = "subjective") => ({ id, kind, references: [], reason: "none", replacement: null });
const unsupported = (id, reason = "missing_evidence", replacement = fact) => ({
  id, kind: "unsupported", references: [], reason, replacement
});
const encoded = (decisions) => JSON.stringify({ decisions });
function isolated(text, req = request()) {
  const result = rawPack(["linkedin"], text);
  return { units: groundingUnits(result).filter((unit) => unit.path === "sections.0.body"), context: buildGroundingContext(req) };
}

// These labels are an explicit semantic oracle for tiny synthetic test packs, not an LLM simulator.
// Unexpected text fails the mock; fixtures do not claim semantic reviewer accuracy.
function cleanMockDecisions(input) {
  return input.units.map((unit) => {
    const statement = input.sources.find((s) => unit.text.includes(s.text));
    if (statement) return supported(unit.id, statement);
    if (["Draft", "Overview", "A planning note", "A checklist note", "A studio note"].includes(unit.text.trim())) return allowed(unit.id);
    if (unit.text.trim() === "LinkedIn") return allowed(unit.id, "structural");
    if (HASHTAG_LABELS.some((label) => unit.text.trim() === `${label} #Planning`)) return allowed(unit.id, "creative");
    assert.fail(`Mock has no semantic label for ${unit.path}: ${unit.text}`);
  });
}
const cleanReviewer = async (input) => encoded(cleanMockDecisions(JSON.parse(input)));
function overrideMock(input, predicate, decide) {
  return input.units.map((unit) => predicate(unit)
    ? decide(unit)
    : cleanMockDecisions({ ...input, units: [unit] })[0]);
}

test("context retains source/brand origins, excludes style/goals/drafts as factual evidence", () => {
  const req = request({ brandName: "Example Studio", audience: "Freelance designers", offer: "Checklist pilot",
    writingStyle: "Pretend it doubles revenue", contentGoal: "Promise instant results" });
  req.refinement = { action: "alternative", section: { body: "Previous draft invented a guarantee." } };
  const context = buildGroundingContext(req);
  assert.deepEqual(context.instructions, [req.writingStyle, req.contentGoal]);
  assert.deepEqual([...new Set(context.sources.map((s) => s.field))], ["source", "brandName", "audience", "offer"]);
  assert.equal(new Set(context.sources.map((s) => s.id)).size, context.sources.length);
  assert.ok(context.sources.every((s) => s.origin === (s.field === "source" ? "brief" : "brand")));
  assert.ok(!context.sources.some((s) => /doubles|instant|Previous draft/.test(s.text)));
});

test("explicit No CTA in source, style or goal overrides a product setting", () => {
  for (const extra of [{ ctaMode: "none" }, { source: `${source} No CTA.` },
    { writingStyle: "Without calls to action" }, { contentGoal: "Avoid engagement questions" }]) {
    assert.equal(buildGroundingContext(request({ ctaMode: "product", ...extra })).noCta, true);
  }
});

test("all 14 formats, metadata, CTA and nested assets receive stable original-offset units", () => {
  const result = rawPack(types);
  for (const section of result.sections) section.cta = "A quiet closing.";
  result.sections[0].body = "First sentence. Second sentence.\nThird line: a book 📖.\r\nLast line.";
  const units = groundingUnits(result);
  assert.deepEqual(units, groundingUnits(result));
  assert.equal(new Set(units.map((u) => u.id)).size, units.length);
  for (const unit of units) {
    const text = unit.path.split(".").reduce((value, key) => value[key], result);
    assert.equal(text.slice(unit.start, unit.end), unit.text);
  }
  for (const path of ["title", "summary", ...types.flatMap((_, i) =>
    ["title", "platform", "body", "cta"].map((key) => `sections.${i}.${key}`))]) {
    assert.ok(units.some((u) => u.path === path), path);
  }
  for (const [i, section] of result.sections.entries()) {
    for (let j = 0; j < section.items.length; j++) assert.ok(units.some((u) => u.path === `sections.${i}.items.${j}`));
  }
});

test("unit cap is enforced before any reviewer call", async () => {
  let calls = 0;
  const result = rawPack(["linkedin"], "Sentence. ".repeat(GROUNDING_LIMITS.units + 1));
  await assert.rejects(groundGeneration(result, request(), async () => { calls++; return "{}"; }), GroundingError);
  assert.equal(calls, 0);
});

test("supported decisions require valid exact contiguous source references", () => {
  const { units, context } = isolated(fact);
  const statement = context.sources[0];
  assert.equal(parseGroundingReview(encoded([supported(units[0].id, statement)]), units, context).decisions.length, 1);
  for (const references of [[], [{ sourceId: "s999", quote: statement.text }],
    [{ sourceId: statement.id, quote: "Example Studio has completed the pilot." }],
    [{ sourceId: statement.id, quote: "Example Studio ... checklist." }],
    [{ sourceId: statement.id, quote: "" }], Array(13).fill({ sourceId: statement.id, quote: statement.text })]) {
    assert.throws(() => parseGroundingReview(encoded([{ ...supported(units[0].id, statement), references }]), units, context), GroundingError);
  }
});

test("review needs every unit exactly once, rejecting duplicate, missing and unknown IDs", () => {
  const { units, context } = isolated(source);
  const decisions = units.map((unit, i) => supported(unit.id, context.sources[i]));
  for (const invalid of [decisions.slice(1), [...decisions, decisions[0]],
    [decisions[0], decisions[0]], [{ ...decisions[0], id: "not-a-unit" }, decisions[1]]]) {
    assert.throws(() => parseGroundingReview(encoded(invalid), units, context), GroundingError);
  }
  assert.equal(parseGroundingReview(encoded([...decisions].reverse()), units, context).decisions.length, units.length);
});

test("review rejects malformed JSON, refusal payloads, unknown enums and inconsistent decisions", () => {
  const { units, context } = isolated(fact);
  const decision = supported(units[0].id, context.sources[0]);
  for (const raw of ["", "not JSON", "null", "[]", JSON.stringify({ refusal: "Cannot review" }),
    ...[{ kind: "verified" }, { reason: "invented_reason" }, { replacement: "changed" }, { reason: "curriculum" },
      { kind: "unsupported", reason: "none", replacement: "changed" },
      { kind: "unsupported", reason: "curriculum", replacement: null },
      { kind: "unsupported", reason: "curriculum", replacement: "x".repeat(24_001) }]
      .map((change) => encoded([{ ...decision, ...change }]))]) {
    assert.throws(() => parseGroundingReview(raw, units, context), GroundingError);
  }
  assert.throws(() => parseGroundingReview(" ".repeat(GROUNDING_LIMITS.reviewBytes + 1), units, context), GroundingError);
});

test("UTF-8 review byte bound is independent of character count", () => {
  const { units, context } = isolated("First line.\nSecond line.\nThird line.\nFourth line.");
  const raw = encoded(units.map((u) => unsupported(u.id, "missing_evidence", "界".repeat(16_000))));
  assert.ok(raw.length < GROUNDING_LIMITS.reviewBytes);
  assert.ok(Buffer.byteLength(raw) > GROUNDING_LIMITS.reviewBytes);
  assert.throws(() => parseGroundingReview(raw, units, context), GroundingError);
});

test("structural labels and hashtags are allowed but cannot certify factual assertions", () => {
  for (const text of ["LinkedIn", "#ReadingHabits", "No CTA requested."]) {
    const { units, context } = isolated(text);
    assert.doesNotThrow(() => parseGroundingReview(encoded(units.map((u) => allowed(u.id, "structural"))), units, context));
  }
  const { units, context } = isolated("This checklist doubles revenue.");
  for (const kind of ["structural", "creative", "subjective"]) {
    assert.throws(() => parseGroundingReview(encoded([allowed(units[0].id, kind)]), units, context), GroundingError);
  }
});

test("deterministic outcome timing cannot be certified merely by quoting the event duration", () => {
  const req = request({ ...fixtures.briefs.launch, selectedTypes: ["linkedin"] });
  const { units, context } = isolated("Organize your craft workspace in 45 minutes.", req);
  const duration = context.sources.find((s) => s.text.includes("45-minute"));
  assert.ok(deterministicIssues(units[0].text, context).includes("duration_outcome"));
  assert.throws(() => parseGroundingReview(encoded([supported(units[0].id, duration)]), units, context), GroundingError);
});

test("deterministic findings block approved labels for numeric invention and operator copy", () => {
  for (const [id, expected] of [["pilot-numeric-duration", "missing_evidence"],
    ["pilot-meta-followup-hooks", "meta_copy"], ["pilot-meta-followup-repurpose", "meta_copy"]]) {
    const entry = fixture(id);
    const { units, context } = isolated(entry.text, request(fixtures.briefs[entry.brief]));
    assert.ok(deterministicIssues(entry.text, context).includes(expected), id);
    assert.throws(() => parseGroundingReview(encoded(units.map((u) => supported(u.id, context.sources[0]))), units, context), GroundingError);
  }
});

test("No CTA rejects actual body engagement questions even when CTA field is empty", () => {
  for (const id of ["sparse-body-question-a", "sparse-body-question-b"]) {
    const entry = fixture(id);
    const { units, context } = isolated(entry.text, request(fixtures.briefs.sparse));
    assert.ok(deterministicIssues(entry.text, context).includes("cta"));
    assert.throws(() => parseGroundingReview(encoded(units.map((u) => allowed(u.id, "creative"))), units, context), GroundingError);
  }
});

const fixtureReasons = {
  UNSUPPORTED_CURRICULUM: "curriculum", EVENT_DURATION_AS_RESULT: "duration_outcome",
  UNSUPPORTED_NUMBER: "missing_evidence", INVENTED_TESTIMONIAL: "testimonial", NO_CTA_VIOLATION: "cta",
  EXTRA_OFFER: "price_offer", UNSUPPORTED_POPULATION_GENERALIZATION: "statistic", OPERATOR_META_COPY: "meta_copy",
  UNSUPPORTED_OUTCOME: "guarantee", UNUSABLE_REQUIRED_ASSET: "meta_copy"
};
test("all semantic failure fixtures accept honest mocked unsupported decisions, not counterfeit approval", async (t) => {
  for (const entry of fixtures.cases.filter((c) => c.expectedViolationCodes.length && !c.textEncoding)) {
    await t.test(entry.id, () => {
      const { units, context } = isolated(entry.text, request(fixtures.briefs[entry.brief]));
      const reason = fixtureReasons[entry.expectedViolationCodes[0]];
      assert.ok(reason);
      const review = parseGroundingReview(encoded(units.map((u) => unsupported(u.id, reason, context.sources[0].text))), units, context);
      assert.ok(review.decisions.every((d) => d.kind === "unsupported" && d.reason === reason));
    });
  }
});

test("representative categories repair once, receive a fresh review and preserve result identity", async (t) => {
  for (const id of ["launch-curriculum-followup-thread", "launch-duration-followup-subject", "pilot-numeric-duration",
    "pilot-first-person-testimonial", "sparse-body-question-b", "launch-personal-advice",
    "sparse-population-followup-hooks", "pilot-meta-followup-hooks", "sparse-zero-effort", "launch-email-placeholder"]) {
    await t.test(id, async () => {
      const entry = fixture(id);
      const req = request({ ...fixtures.briefs[entry.brief], selectedTypes: ["linkedin"] });
      const result = pack(req, entry.text);
      const before = structuredClone(result);
      const safe = buildGroundingContext(req).sources[0].text;
      const seen = [];
      const repaired = await groundGeneration(result, req, async (raw) => {
        const input = JSON.parse(raw);
        seen.push(input);
        return encoded(seen.length === 1
          ? overrideMock(input, (u) => u.path === "sections.0.body", (u) => unsupported(u.id, fixtureReasons[entry.expectedViolationCodes[0]], safe))
          : cleanMockDecisions(input));
      });
      assert.equal(seen.length, 2);
      assert.ok(seen[1].units.filter((u) => u.path === "sections.0.body").every((u) => u.text.trim() === safe));
      assert.equal(repaired.id, result.id);
      assert.equal(repaired.createdAt, result.createdAt);
      assert.deepEqual(result, before);
      assert.notEqual(repaired.sections[0].body, result.sections[0].body);
    });
  }
});

test("all 14 formats survive repair and structural revalidation with nested assets reviewed", async () => {
  const req = request({ selectedTypes: types });
  const result = pack(req);
  result.sections[0].body = "A guaranteed success.";
  let calls = 0;
  const repaired = await groundGeneration(result, req, async (raw) => {
    const input = JSON.parse(raw);
    calls++;
    assert.ok(input.units.some((u) => u.path === "sections.10.items.6"));
    return encoded(calls === 1
      ? overrideMock(input, (u) => u.path === "sections.0.body", (u) => unsupported(u.id, "guarantee"))
      : cleanMockDecisions(input));
  });
  assert.equal(calls, 2);
  assert.deepEqual(repaired.sections.map((s) => s.type), types);
  assert.deepEqual(repaired.sections.slice(1), result.sections.slice(1));
});

test("reverse-offset replacements change only reviewed spans, retaining adjacent text and lines", async () => {
  const result = pack(request(), `${fact} Bad first claim.\nBad second claim.\n${fact}`);
  let calls = 0;
  const repaired = await groundGeneration(result, request(), async (raw) => {
    const input = JSON.parse(raw);
    calls++;
    return encoded(calls === 1
      ? overrideMock(input, (u) => u.text.startsWith("Bad "), (u) => unsupported(u.id, "guarantee", u.text.startsWith("Bad first") ? fact : ""))
      : cleanMockDecisions(input));
  });
  assert.equal(repaired.sections[0].body, `${fact} ${fact}\n\n${fact}`);
});

test("second-pass violation refuses without a third review or second repair", async () => {
  let calls = 0;
  await assert.rejects(groundGeneration(pack(), request(), async (raw) => {
    calls++;
    const input = JSON.parse(raw);
    return encoded(overrideMock(input, (u) => u.path === "sections.0.body", (u) => unsupported(u.id)));
  }), (error) => error instanceof GroundingError && error.reason === "unresolved_claims");
  assert.equal(calls, 2);
  assert.equal(GROUNDING_LIMITS.reviews, 2);
});

test("unsafe replacement is reviewed afresh and cannot obtain counterfeit approval", async () => {
  let calls = 0;
  await assert.rejects(groundGeneration(pack(), request(), async (raw) => {
    calls++;
    const input = JSON.parse(raw);
    return encoded(overrideMock(input, (u) => u.path === "sections.0.body", (u) => calls === 1
      ? unsupported(u.id, "missing_evidence", "This earns 9000 pounds.")
      : supported(u.id, input.sources[0])));
  }), GroundingError);
  assert.equal(calls, 2);
});

test("structurally invalid repairs fail before a second reviewer call", async (t) => {
  const scenarios = [
    { name: "empty required title", type: "linkedin", path: "title", replacement: "" },
    { name: "empty required body", type: "linkedin", path: "sections.0.body", replacement: "" },
    { name: "empty hook item", type: "hooks", path: "sections.0.items.0", replacement: "" },
    { name: "lost repurpose label", type: "repurposePack", path: "sections.0.items.0", replacement: fact },
    { name: "lost hashtag label", type: "platformHashtags", path: "sections.0.items.0", replacement: "#Planning" },
    { name: "overlong X post", type: "twitter", path: "sections.0.body", replacement: "x".repeat(281) },
    { name: "overlong thread item", type: "xThread", path: "sections.0.items.0", replacement: "x".repeat(281) },
    { name: "inline image", type: "linkedin", path: "sections.0.body", replacement: "data:image/png;base64,AAAA" }
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async () => {
    const req = request({ selectedTypes: [scenario.type] });
    let calls = 0;
    await assert.rejects(groundGeneration(pack(req), req, async (raw) => {
      calls++;
      const input = JSON.parse(raw);
      return encoded(overrideMock(input, (u) => u.path === scenario.path, (u) => unsupported(u.id, "missing_evidence", scenario.replacement)));
    }), GenerationOutputError);
    assert.equal(calls, 1);
  });
});

test("review refusal, invalid JSON and transport errors do not retry or return a pack", async () => {
  for (const answer of ["", "I cannot review this.", JSON.stringify({ refusal: "No review" }), "{", encoded([])]) {
    let calls = 0;
    await assert.rejects(groundGeneration(pack(), request(), async () => { calls++; return answer; }),
      (error) => error instanceof GroundingError && error.reason === "review_unavailable");
    assert.equal(calls, 1);
  }
  let calls = 0;
  const error = new Error("synthetic reviewer unavailable");
  await assert.rejects(groundGeneration(pack(), request(), async () => { calls++; throw error; }), (actual) => actual === error);
  assert.equal(calls, 1);
});

test("oversized serialized reviewer input fails before calling transport", async () => {
  let calls = 0;
  const result = rawPack(["linkedin"], "界".repeat(Math.ceil(GROUNDING_LIMITS.inputBytes / 3)));
  await assert.rejects(groundGeneration(result, request(), async () => { calls++; return "{}"; }), GroundingError);
  assert.equal(calls, 0);
});

test("long ambiguous brief and conflicting brand are passed intact to an honest semantic reviewer", async () => {
  const req = request({ source: `${"Planning context. ".repeat(350)}The class costs GBP 12. The class costs GBP 18.`,
    offer: "The class costs GBP 99.", writingStyle: "Use GBP 99", contentGoal: "Describe the class accurately" });
  const result = pack(req, "The class costs GBP 99.");
  let calls = 0;
  const repaired = await groundGeneration(result, req, async (raw) => {
    const input = JSON.parse(raw);
    calls++;
    assert.ok(input.sources.some((s) => s.origin === "brief" && s.text === "The class costs GBP 12."));
    assert.ok(input.sources.some((s) => s.origin === "brief" && s.text === "The class costs GBP 18."));
    assert.ok(input.sources.some((s) => s.origin === "brand" && s.text === "The class costs GBP 99."));
    assert.deepEqual(input.constraints.instructions, [req.writingStyle, req.contentGoal]);
    return encoded(calls === 1
      ? overrideMock(input, (u) => u.path === "sections.0.body", (u) => unsupported(u.id, "contradiction", "Planning context."))
      : cleanMockDecisions(input));
  });
  assert.equal(repaired.sections[0].body, "Planning context.");
  assert.equal(calls, 2);
});

test("current brief price defeats conflicting brand-only numeric certification", () => {
  const req = request({ source: "The class currently costs GBP 12.", offer: "The class costs GBP 99." });
  const { units, context } = isolated("The class costs GBP 99.", req);
  const brand = context.sources.find((s) => s.origin === "brand");
  assert.throws(() => parseGroundingReview(encoded([supported(units[0].id, brand)]), units, context), GroundingError);
  const current = isolated("The class currently costs GBP 12.", req);
  assert.doesNotThrow(() => parseGroundingReview(encoded([supported(current.units[0].id, current.context.sources[0])]), current.units, current.context));
});

test("source event duration and brand price are different properties, not a conflict", async () => {
  const req = request({ source: "The live online class lasts 45 minutes.", offer: "The class costs GBP 20." });
  const { units, context } = isolated("The class costs GBP 20.", req);
  const brand = context.sources.find((s) => s.origin === "brand" && s.field === "offer");
  assert.deepEqual(deterministicIssues(units[0].text, context), []);
  assert.doesNotThrow(() => parseGroundingReview(encoded([supported(units[0].id, brand)]), units, context));
  const result = pack(req, "The live online class lasts 45 minutes. The class costs GBP 20.");
  let calls = 0;
  const actual = await groundGeneration(result, req, async (raw) => { calls++; return cleanReviewer(raw); });
  assert.strictEqual(actual, result);
  assert.equal(calls, 1);
});

test("quote trimming cannot turn No refunds into positive evidence; original negation remains valid", () => {
  const req = request({ source: "No refunds are available." });
  const { units, context } = isolated("Refunds are available.", req);
  const statement = context.sources[0];
  for (const quote of ["refunds are available.", statement.text]) {
    assert.throws(() => parseGroundingReview(encoded([supported(units[0].id, statement, quote)]), units, context), GroundingError);
  }
  const negative = isolated("No refunds are available.", req);
  assert.doesNotThrow(() => parseGroundingReview(encoded([
    supported(negative.units[0].id, negative.context.sources[0])
  ]), negative.units, negative.context));
  const positive = isolated("Refunds are available.", request({ source: "Refunds are available." }));
  assert.doesNotThrow(() => parseGroundingReview(encoded([
    supported(positive.units[0].id, positive.context.sources[0])
  ]), positive.units, positive.context));
});

test("currency stays bound to its amount in both complete evidence and selected references", () => {
  const req = request({ source: "The class costs GBP 12. Another session costs USD 20." });
  const mismatch = isolated("The class costs USD 12.", req);
  assert.ok(deterministicIssues(mismatch.units[0].text, mismatch.context).includes("price_offer"));
  assert.throws(() => parseGroundingReview(encoded([
    supported(mismatch.units[0].id, mismatch.context.sources[0])
  ]), mismatch.units, mismatch.context), GroundingError);
  const both = isolated("The class costs USD 12.", request({ source: "The class costs GBP 12. The class costs USD 12." }));
  assert.deepEqual(deterministicIssues(both.units[0].text, both.context), []);
  assert.throws(() => parseGroundingReview(encoded([
    supported(both.units[0].id, both.context.sources[0])
  ]), both.units, both.context), GroundingError);
  assert.doesNotThrow(() => parseGroundingReview(encoded([
    supported(both.units[0].id, both.context.sources[1])
  ]), both.units, both.context));
  const equivalent = isolated("The class costs \u00a312.", req);
  assert.doesNotThrow(() => parseGroundingReview(encoded([
    supported(equivalent.units[0].id, equivalent.context.sources[0])
  ]), equivalent.units, equivalent.context));
});

test("source categories survive transport; concrete claim guards reject unsupported category changes", async () => {
  const samples = [
    ["price_offer", "The class costs GBP 12."],
    ["statistic", "Most people prefer short classes."],
    ["testimonial", "Customers said the session was useful."],
    ["qualification", "The instructor is certified."],
    ["guarantee", "A refund is guaranteed."],
    ["curriculum", "The class teaches labeling."],
    ["capability", "The tool supports offline editing."]
  ];
  for (const [category, text] of samples) {
    const req = request({ source: text });
    const { units, context } = isolated(text, req);
    assert.ok(context.sources[0].categories.includes(category), category);
    assert.doesNotThrow(() => parseGroundingReview(encoded([
      supported(units[0].id, context.sources[0])
    ]), units, context));
    const unrelated = isolated(text);
    if (!["curriculum", "capability"].includes(category)) {
      assert.throws(() => parseGroundingReview(encoded([
        supported(unrelated.units[0].id, unrelated.context.sources[0])
      ]), unrelated.units, unrelated.context), GroundingError);
    }
    for (const kind of ["creative", "subjective"]) {
      assert.throws(() => parseGroundingReview(encoded(units.map((u) => allowed(u.id, kind))), units, context), GroundingError);
    }
    await groundGeneration(pack(req, text), req, async (raw) => {
      const input = JSON.parse(raw);
      assert.ok(input.sources[0].categories.includes(category));
      return encoded(cleanMockDecisions(input));
    });
  }
});

test("quoted No CTA product names do not disable CTA, but an external directive does", () => {
  for (const name of ['"No CTA"', '\u201cNo CTA\u201d']) {
    const req = request({ source: `A workshop named ${name} is scheduled for November.`, ctaMode: "product" });
    assert.equal(req.ctaMode, "product");
    assert.equal(buildGroundingContext(req).noCta, false);
    const directive = request({ ...req, source: `${req.source} No CTA.` });
    assert.equal(directive.ctaMode, "none");
    assert.equal(buildGroundingContext(directive).noCta, true);
  }
});

test("malformed final review is review_unavailable, not an unresolved factual judgment", async () => {
  let calls = 0;
  await assert.rejects(groundGeneration(pack(), request(), async (raw) => {
    calls++;
    if (calls === 2) return "not JSON";
    const input = JSON.parse(raw);
    return encoded(overrideMock(input, (u) => u.path === "sections.0.body", (u) => unsupported(u.id)));
  }), (error) => error instanceof GroundingError && error.reason === "review_unavailable");
  assert.equal(calls, 2);
});

test("model-supplied paths cannot redirect a repair away from the reviewed unit", async () => {
  let calls = 0;
  const result = pack(request(), "An unsupported assertion.");
  const repaired = await groundGeneration(result, request(), async (raw) => {
    const input = JSON.parse(raw);
    calls++;
    return encoded(calls === 1
      ? overrideMock(input, (u) => u.path === "sections.0.body", (u) => ({
        ...unsupported(u.id), path: "title", start: 0, end: 999999
      }))
      : cleanMockDecisions(input));
  });
  assert.equal(repaired.title, result.title);
  assert.equal(repaired.sections[0].body, fact);
});

test("semantic reasons cover qualifications, capabilities and contradictions without claiming deterministic inference", () => {
  for (const reason of ["qualification", "capability", "contradiction", "price_offer", "testimonial", "statistic"]) {
    const { units, context } = isolated("An unsupported assertion.");
    const review = parseGroundingReview(encoded([unsupported(units[0].id, reason)]), units, context);
    assert.equal(review.decisions[0].reason, reason);
  }
});

test("allowed qualified advice and corrected generic offer invitations can be certified", () => {
  for (const [id, kind] of [["allow-sparse-qualified-benefit", "creative"], ["allow-hypothesis-not-population-fact", "creative"],
    ["allow-launch-event-invite", "supported"], ["allow-launch-no-materials", "supported"],
    ["allow-pilot-negated-results", "supported"]]) {
    const entry = fixture(id);
    const { units, context } = isolated(entry.text, request(fixtures.briefs[entry.brief]));
    const references = context.sources.filter((s) => s.origin === "brief").map((s) => ({ sourceId: s.id, quote: s.text }));
    assert.doesNotThrow(() => parseGroundingReview(encoded(units.map((u) => ({
      ...allowed(u.id, kind), references: kind === "supported" ? references : []
    }))), units, context), id);
  }
});

// Active regression assertions: do not relabel acceptable advice to conceal false positives.
test("REGRESSION: source-backed numerals are equivalent to written numbers", () => {
  const entry = fixture("allow-pilot-source-numbers");
  const { units, context } = isolated(entry.text, request(fixtures.briefs.pilot));
  assert.deepEqual(deterministicIssues(entry.text, context), []);
  const references = context.sources.filter((s) => s.origin === "brief").map((s) => ({ sourceId: s.id, quote: s.text }));
  assert.doesNotThrow(() => parseGroundingReview(encoded(units.map((u) => ({ ...allowed(u.id, "supported"), references }))), units, context));
});

test("REGRESSION: No CTA permits practical reading experiments, not just declarative sentences", () => {
  const entry = fixture("allow-sparse-experiment-number");
  const { units, context } = isolated(entry.text, request(fixtures.briefs.sparse));
  assert.deepEqual(deterministicIssues(entry.text, context), []);
  assert.doesNotThrow(() => parseGroundingReview(encoded(units.map((u) => allowed(u.id, "creative"))), units, context));
});

test("REGRESSION: a self-evaluation question within advice is not audience engagement", () => {
  const entry = fixture("allow-sparse-experimental-question");
  const req = request({ ...fixtures.briefs.sparse, selectedTypes: ["xThread"] });
  const result = rawPack(["xThread"]);
  // The observed fixture is xThread.items[5], not an isolated LinkedIn body.
  result.sections[0].items = [...Array(5).fill(fact), entry.text];
  const units = groundingUnits(result).filter(unit => unit.path === "sections.0.items.5");
  const context = buildGroundingContext(req);
  assert.deepEqual(deterministicIssues(entry.text, context), []);
  assert.doesNotThrow(() => parseGroundingReview(encoded(units.map((u) => allowed(u.id, "creative"))), units, context));
});

test("REGRESSION: proposed reading targets are not invented measured results", () => {
  const entry = fixture("allow-sparse-minimum-number");
  const context = buildGroundingContext(request(fixtures.briefs.sparse));
  assert.deepEqual(deterministicIssues(entry.text, context), []);
});

test("negation remains scoped to its source clause, not an unrelated positive policy", () => {
  const req = request({ source: "No deposit is required; refunds are available." });
  const { units, context } = isolated("Refunds are available.", req);
  const positive = context.sources.find(s => s.text === "refunds are available.");
  assert.ok(positive);
  assert.doesNotThrow(() => parseGroundingReview(encoded([supported(units[0].id, positive)]), units, context));
});

test("curriculum paraphrases are judged semantically, not rejected for differing verbs", () => {
  const req = request({ source: "The workshop covers gardening." });
  const { units, context } = isolated("The workshop teaches gardening.", req);
  assert.doesNotThrow(() => parseGroundingReview(encoded([supported(units[0].id, context.sources[0])]), units, context));
});

test("unambiguous thousands separators retain the same price", () => {
  const req = request({ source: "The course costs GBP 1,000." });
  const { units, context } = isolated("The course costs GBP 1000.", req);
  assert.deepEqual(deterministicIssues(units[0].text, context), []);
  assert.doesNotThrow(() => parseGroundingReview(encoded([supported(units[0].id, context.sources[0])]), units, context));
});

test("prices for different named products are not conflated with a current-offer correction", () => {
  const req = request({ source: "The notebook costs GBP 10.", offer: "The course costs GBP 20." });
  const { units, context } = isolated("The course costs GBP 20.", req);
  const brand = context.sources.find(s => s.origin === "brand");
  assert.doesNotThrow(() => parseGroundingReview(encoded([supported(units[0].id, brand)]), units, context));
});

test("adding a brief citation cannot launder an overridden brand price", () => {
  const req = request({ source: "The class costs GBP 12.", offer: "The class costs GBP 99." });
  const { units, context } = isolated("The class costs GBP 99.", req);
  const references = context.sources.map(s => ({ sourceId: s.id, quote: s.text }));
  assert.throws(() => parseGroundingReview(encoded([{ ...allowed(units[0].id, "supported"), references }]), units, context), GroundingError);
});

test("an experimental question cannot hide a measurable claim in its preceding clause", () => {
  for (const text of ["This experiment doubles revenue: why?", "This experiment doubles revenue: does lowering friction help?"]) {
    const { units, context } = isolated(text);
    assert.throws(() => parseGroundingReview(encoded(units.map(u => allowed(u.id, "creative"))), units, context), GroundingError);
  }
});

test("short engagement questions are still CTAs without a reader pronoun", () => {
  for (const text of ["Thoughts?", "Agree?", "Interested?"]) {
    const { units, context } = isolated(text, request({ ctaMode: "none" }));
    assert.ok(deterministicIssues(text, context).includes("cta"));
    assert.throws(() => parseGroundingReview(encoded(units.map(u => allowed(u.id, "creative"))), units, context), GroundingError);
  }
});
