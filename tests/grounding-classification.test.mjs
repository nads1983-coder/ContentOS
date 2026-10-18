import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { grounding as g, batches, contract } from "./grounding-capture-helpers.mjs";
const directory = new URL("../docs/benchmarks/staged-delivery-2026-10-18/", import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, directory), "utf8"));
export const request = contract.normalizeGenerationRequest(read("brief.json"));
export const draft = contract.parseGenerationOutput(read("execution.json").jobs[0].evidence.outputText, request);
const context = g.buildGroundingContext(request), units = g.groundingUnits(draft);
const capturedReview = read("execution.json").jobs[1].evidence.outputText;
const assessment = read("independent-assessment.json");
export const findings = assessment.formats.flatMap(format => format.materialFailures ?? []);
function certificate(unit, kind, ctx = context, references = []) {
  return g.parseGroundingReview(JSON.stringify({ decisions: [{ id: unit.id, kind, references, reason: "none", replacement: null }] }), [unit], ctx);
}
function body(text, ctx = context) {
  const p = structuredClone(draft); p.sections[0].body = text;
  return { units: g.groundingUnits(p).filter(u => u.path === "sections.0.body"), context: ctx };
}

test("all four original captured disagreements pass unchanged; seven unsupported decisions remain refused", () => {
  const batch = batches.groundingBatch(draft, request, 0, 0);
  const original = JSON.parse(capturedReview);
  // Hashtag syntax is no longer structural proof. Test the four original
  // disagreements unchanged, not an implicit endorsement of every old label.
  const retained = original.decisions.filter(d => d.kind !== "structural" || !batch.units.find(u => u.id === d.id).text.includes("#"));
  const review = batches.parseBatchReview(JSON.stringify({decisions:retained}), {...batch,units:batch.units.filter(u=>retained.some(d=>d.id===u.id))});
  assert.deepEqual(review.decisions.filter(d => d.kind === "unsupported").map(d => d.id), ["u8", "u9", "u10", "u11", "u26", "u35", "u47"]);
  for (const id of ["u4", "u17", "u31", "u46"]) assert.notEqual(review.decisions.find(d => d.id === id).kind, "unsupported");
});

test("aesthetic predicates do not exempt guarantees, capability, measurable outcomes or adjacent clauses", () => {
  for (const text of ["This arrangement will always feel slightly off.", "The layout never looks cohesive.", "Keeping them separate reduces friction.", "Viewing the ideas together reduces friction."]) {
    for (const unit of body(text).units) assert.doesNotThrow(() => certificate(unit, "subjective"), text);
  }
  for (const text of ["Our tool always reduces errors.", "This course always improves confidence.", "Our product reduces friction.",
    "Keeping them separate reduces friction by 50%.", "Keeping them separate reduces costs.",
    "This layout will always feel slightly off, but our service guarantees results.", "This layout always saves time.",
    "Keeping them separate reduces friction and protects accuracy.", "The layout never loses data."]) {
    for (const kind of ["creative", "subjective", "structural"]) assert.throws(() => certificate(body(text).units[0], kind), g.GroundingError, text);
  }
});

test("hypothetical field names require local list context and source permission, never exempt prices or offers", () => {
  const intro = "Here is a fictional record example:\nStock record (what is held)\n";
  for (const text of ["- Unit cost and retail price", "- Wholesale price", "- Purchase cost"]) {
    const unit = body(intro + text).units.at(-1);
    assert.doesNotThrow(() => certificate(unit, "creative"));
    assert.throws(() => certificate({ ...unit }, "creative"), g.GroundingError, "serialized metadata is not authority");
    assert.throws(() => certificate(body(text).units[0], "creative"), g.GroundingError);
    assert.throws(() => certificate(unit, "creative", g.buildGroundingContext({ source: "No hypothetical examples are allowed." })), g.GroundingError);
    assert.throws(() => certificate(unit, "creative", g.buildGroundingContext({ source: "Hypothetical examples may be used. Do not use hypothetical examples in this pack." })), g.GroundingError);
  }
  for (const text of ["- Unit cost GBP 25", "- Retail price is free", "- Guaranteed price", "- Discount price", "- Unit cost and retail price includes delivery"]) {
    assert.throws(() => certificate(body(intro + text).units.at(-1), "creative"), g.GroundingError, text);
  }
  const ended = body(intro + "A new offer is now available.\n- Unit cost and retail price").units.at(-1);
  assert.throws(() => certificate(ended, "creative"), g.GroundingError);
});

test("suffix counts certify real caption structure and source topics, not business assertions", () => {
  const p = structuredClone(draft);
  const titleUnit = () => g.groundingUnits(p).find(u => u.path === "sections.1.title");
  assert.doesNotThrow(() => certificate(titleUnit(), "structural"));
  for (const title of ["Instagram captions: Guaranteed results vs display note (3 options)", "Instagram captions: Stock record vs invented topic (3 options)",
    "Instagram captions: Stock record vs display note (4 options)", "Instagram captions: Stock record vs display note (3 customers)"]) {
    p.sections[1].title = title; assert.throws(() => certificate(titleUnit(), "structural"), g.GroundingError, title);
  }
  p.sections[1].title = draft.sections[1].title;
  for (const content of [draft.sections[1].body.replace("Caption 2", "Caption 4"), draft.sections[1].body + "\nCaption 4\nAn extra caption.", "Caption 1\nOnly one."]) {
    p.sections[1].body = content; assert.ok(g.deterministicIssues(titleUnit(), context).includes("missing_evidence"));
  }
});

test("all nine independent material assertions reject counterfeit approval in every allowed class", () => {
  assert.equal(findings.length, 9);
  for (const finding of findings) {
    const affected = units.filter(u => u.path === finding.path && finding.quote.includes(u.text.trim()) && g.deterministicIssues(u, context).length);
    assert.ok(affected.length, finding.quote);
    for (const unit of affected) for (const kind of ["supported", "creative", "subjective", "structural"]) {
      assert.throws(() => certificate(unit, kind, context, [{ sourceId: "s3", quote: context.sources[3].text }]), g.GroundingError, `${kind}: ${unit.text}`);
    }
  }
});

test("objective predicates remain allowed with actual supporting evidence, not unrelated source references", () => {
  for (const text of ["Our audited process protects accuracy.", "Museum shops often merge these documents.", "This file cannot store attachments."]) {
    const ctx = g.buildGroundingContext({ source: text + " An unrelated planning note." });
    const unit = body(text).units[0];
    assert.doesNotThrow(() => certificate(unit, "supported", ctx, [{ sourceId: "s0", quote: ctx.sources[0].text }]));
    assert.throws(() => certificate(unit, "supported", ctx, [{ sourceId: "s1", quote: ctx.sources[1].text }]), g.GroundingError);
  }
  assert.doesNotThrow(() => certificate(body("The hardest part is often the start.").units[0], "subjective"));
});

test("publisher preambles are flagged but actual script and asset structure is retained", () => {
  for (const text of ["Subject line options are below.", "Title idea: A planning note"]) assert.ok(g.deterministicIssues(text, context).includes("meta_copy"));
  for (const text of ["Hook (spoken)", "On-screen text", "LinkedIn: A planning note."]) assert.ok(!g.deterministicIssues(text, context).includes("meta_copy"));
  for (const path of ["sections.9.items.0", "sections.9.items.1", "sections.9.items.2", "sections.10.items.5"]) {
    for (const unit of units.filter(u => u.path === path)) assert.ok(!g.deterministicIssues(unit, context).includes("missing_evidence"), unit.text);
  }
});

test("quoted conditional questions and an empty No-CTA set explanation are not audience requests", () => {
  for (const id of ["u262", "u270"]) {
    const unit = units.find(u => u.id === id);
    assert.deepEqual(g.deterministicIssues(unit, context), []);
    assert.doesNotThrow(() => certificate(unit, "subjective"));
    assert.ok(g.deterministicIssues({ ...unit }, context).includes("cta"), "cannot forge local context");
  }
  for (const text of ['When "where does this go?" comment below.', 'Where does this go?', 'When "where does this go?"',
    'When "where does this go?" is your question, contact us.', 'In No CTA mode, this set is intentionally left blank. Sign up.']) {
    const found = body(text).units.flatMap(u => g.deterministicIssues(u, context));
    assert.ok(found.includes("cta"), text);
  }
  const p = structuredClone(draft);
  p.sections[0].body = p.sections[12].body;
  assert.ok(g.groundingUnits(p).filter(u => u.path === "sections.0.body").some(u => g.deterministicIssues(u, context).includes("cta")));
  p.sections[12].body += " Comment below.";
  assert.ok(g.groundingUnits(p).filter(u => u.path === "sections.12.body").some(u => g.deterministicIssues(u, context).includes("cta")));
});
