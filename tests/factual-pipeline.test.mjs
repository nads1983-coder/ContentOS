import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./image-test-helpers.mjs";

const { reviewBusinessFacts: review } = loadTs("lib/business-facts.ts");
const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse, GenerationGroundingError } = loadTs("lib/generation-contract.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const { request: original } = JSON.parse(readFileSync(new URL("fixtures/pr7-captured-instagram.json", import.meta.url)));
const captured = JSON.parse(readFileSync(new URL("fixtures/pr7-instagram-quality-comparison.json", import.meta.url)));
const request = extra => normalize({ ...original, ...extra });
const value = (body, type = "instagram") => ({ title: "A milestone", summary: "A moment to celebrate.", sections: [{ id: type, type, title: "Community update", platform: type, body, items: [], cta: "" }] });
const parseBody = (body, extra = {}) => parse(JSON.stringify(value(body)), request(extra));
const claims = [
  "Hit 1,000 subscribers today and we’re celebrating with a giveaway.",
  "Northbank Paper exists to support your creative process and share your wins along the way.",
  "Details coming soon—keep an eye out for how to enter."
];

test("exact latest capture is immutable and each of its three factual inventions is independently rejected", () => {
  const before = JSON.stringify(captured);
  assert.throws(() => parse(before, request()), GenerationGroundingError);
  for (const claim of claims) assert.throws(() => parseBody(claim), GenerationGroundingError);
  const decisions = review(captured, request()).filter(d => d.classification === "unsupported");
  assert.deepEqual(decisions.map(d => d.category), ["timing", "purpose", "commitment"]);
  assert.equal(JSON.stringify(captured), before);
});

test("factual support has a source location; absence of a match is never reported as verified", () => {
  const fact = "Our mission is to support independent makers.";
  const output = value(`${fact}\nEvery big milestone deserves a moment.\n[CONFIRM: deadline]`);
  const decisions = review(output, request({ source: fact }));
  assert.deepEqual(decisions.find(d => d.text === fact).evidence, { source: "brief", index: 0 });
  assert.equal(decisions.find(d => d.text.startsWith("Every")).classification, "unverified_expression");
  assert.equal(decisions.find(d => d.text.startsWith("[CONFIRM")).classification, "confirmation_required");
  assert.doesNotThrow(() => parse(JSON.stringify(output), request({ source: fact })));
});

test("timing, purpose and commitments need supplied facts, not audience, preferences or previous AI copy", () => {
  for (const claim of [...claims, "We just reached 1,000 subscribers!", "Our mission is to support makers.", "We will announce the winners on Friday.", "The giveaway details will follow next week.", "We launched on Monday."]) {
    assert.throws(() => parseBody(claim), GenerationGroundingError);
    assert.doesNotThrow(() => parseBody(claim, { source: claim }));
    assert.throws(() => parseBody(claim, { writingStyle: claim, audience: claim, contentGoal: claim }), GenerationGroundingError);
    assert.throws(() => parseBody(claim, { source: `Do not claim: ${claim}` }), GenerationGroundingError);
    assert.throws(() => parseBody(claim, { refinement: { action: "custom", instructions: `Make this warmer: ${claim}`, section: value(claim).sections[0] } }), GenerationGroundingError);
  }
});

test("saved factual wording is usable, but a current explicit contradiction overrides it", () => {
  const offer = "Our mission is to support makers.";
  assert.throws(() => parseBody(offer, { offer }), GenerationGroundingError);
  assert.doesNotThrow(() => parseBody(offer, { offer, source: "Use the saved business facts." }));
  assert.throws(() => parseBody(offer, { offer, source: "Use the saved business facts. Our mission is not to support makers. Announce a milestone instead." }), GenerationGroundingError);
});

test("typed milestone matching preserves entity, quantity, relationship, scope and uncertainty", () => {
  for (const body of ["We reached 1,000 subscribers!", "Northbank Paper hit 1k subscribers!", "Hit a big milestone: 1,000 subscribers on Northbank Paper!"]) assert.doesNotThrow(() => parseBody(body));
  for (const body of ["We reached 10,000 subscribers!", "We reached 1,000 customers!", "Another Brand reached 1,000 subscribers!", "We reached 1,000 subscribers every day.", "We lost 1,000 subscribers.", "We will reach 1,000 subscribers.", "Over 1,000 subscribers!", "We reached 1,000 subscribers in 2020."]) assert.throws(() => parseBody(body), GenerationGroundingError);
  for (const source of ["Northbank Paper hopes to reach 1,000 subscribers.", "Northbank Paper has not reached 1,000 subscribers.", "Northbank Paper reached over 1,000 subscribers.", "Another Brand reached 1,000 subscribers.", "Northbank Paper's founder reached 1,000 subscribers.", "Northbank Paper reached 1,000 subscribers in Bristol."]) assert.throws(() => parseBody("We reached 1,000 subscribers!", { source }), GenerationGroundingError);
});

test("ordinary creative language, educational examples and non-event temporal CTAs remain usable", () => {
  for (const body of ["Every big milestone deserves a moment.", "A little pause. A big thank-you. You make this worth celebrating.", "Try a fresh perspective today.", "Imagine a quieter morning. What would you make space for?", "Number your notes 1, 2 and 3.", "Think about the mission before choosing a voice."]) assert.doesNotThrow(() => parseBody(body));
});

test("all 14 formats reject inventions in every field before cleanup, including explicit No CTA", () => {
  for (const { id } of contentTypes) {
    for (const claim of claims) for (const target of ["title", "summary", "body", "items", "cta", "platform", "sectionTitle"]) {
      const output = value("Every big milestone deserves a moment.", id);
      if (["title", "summary"].includes(target)) output[target] = claim;
      else output.sections[0][target === "sectionTitle" ? "title" : target] = target === "items" ? [claim] : claim;
      assert.throws(() => parse(JSON.stringify(output), request({ selectedTypes: [id], ctaMode: "none", automaticSettings: [] })), GenerationGroundingError);
    }
  }
});

test("No CTA reaches body and items, not only the dedicated CTA property", () => {
  for (const { id } of contentTypes) {
    for (const constraint of [{ ctaMode: "none", automaticSettings: [] }, { source: `${original.source} No CTA.` }]) {
      for (const field of ["body", "items"]) {
        const output = value("A moment worth marking. Thank you for being here.", id);
        output.sections[0][field] = field === "items" ? ["Follow us for more."] : "A moment worth marking. Follow us for more.";
        assert.throws(() => parse(JSON.stringify(output), request({ ...constraint, selectedTypes: [id] })), /incomplete or cannot be saved/);
      }
    }
  }
  assert.doesNotThrow(() => parseBody("A moment worth marking. Follow us for more.", { ctaMode: "soft" }));
  assert.doesNotThrow(() => parseBody("Every big milestone deserves a moment. Thank you for being here.", { ctaMode: "none", automaticSettings: [] }));
  assert.doesNotThrow(() => parseBody("A thoughtful comment can open a conversation. No pressure to reply.", { ctaMode: "none", automaticSettings: [] }));
});
