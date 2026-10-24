import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./image-test-helpers.mjs";

const { normalizeGenerationRequest: normalize, parseGenerationOutput: parse, GenerationGroundingError } = loadTs("lib/generation-contract.ts");
const { contentTypes } = loadTs("lib/content-config.ts");
const captured = JSON.parse(readFileSync(new URL("./fixtures/pr7-captured-instagram.json", import.meta.url)));
const request = extra => normalize({ ...captured.request, ...extra });
const output = (body, type = "instagram") => ({ title: "Community update", summary: "A moment to reflect.", sections: [{ id: type, type, title: "A fresh perspective", platform: type, body, items: [], cta: "" }] });
const check = (body, extra) => parse(JSON.stringify(output(body)), request(extra));

test("exact captured paid output is rejected before delivery", () => {
  assert.throws(() => parse(JSON.stringify(captured.output), request()), GenerationGroundingError);
});

test("origins and founder experiences require explicit source sentences, not tone or goals", () => {
  for (const claim of [
    "Northbank Paper started as a small idea in our attic.",
    "We started this business in our attic three years ago.",
    "Our company was founded in 2020 by two friends.",
    "I worked as a teacher before building this brand."
  ]) {
    assert.throws(() => check(claim), GenerationGroundingError);
    assert.equal(check(claim, { source: claim }).sections[0].body, claim);
    assert.throws(() => check(claim, { writingStyle: claim, contentGoal: claim, audience: claim }), GenerationGroundingError);
    assert.throws(() => check(claim, { source: `Do not say ${claim}` }), GenerationGroundingError);
  }
});

test("missing proof, prizes, terms and prices are not approved merely because they look plausible", () => {
  for (const claim of [
    "Our customers say this changed their lives.", "Our notebooks are award-winning.",
    "We earned a design award last year.", "Our sales increased by 40%.",
    "The notebook costs £29.", "The notebook includes a built-in calendar.",
    "The giveaway closes on Friday.", "The winner receives a free notebook.",
    "We partnered with a leading stationery retailer.", "Our notebooks come with a lifetime warranty."
  ]) {
    assert.throws(() => check(claim), GenerationGroundingError);
    assert.equal(check(claim, { source: claim }).sections[0].body, claim);
  }
});

test("quantities, location, dates and qualifications cannot be borrowed from a different source assertion", () => {
  for (const [source, claim] of [
    ["We started this business in our kitchen.", "We started this business in our attic."],
    ["We started this business in 2021.", "We started this business in 2020."],
    ["The notebook costs £29 for members.", "The notebook costs £29."],
    ["Our sales increased by 4%.", "Our sales increased by 40%."],
    ["Our competitors are award-winning.", "Our notebooks are award-winning."]
  ]) assert.throws(() => check(claim, { source }), GenerationGroundingError);
});

test("source-grounded factual sentences and natural creative framing coexist on Instagram and LinkedIn", () => {
  const fact = "We started this business in our attic three years ago.";
  for (const type of ["instagram", "linkedin"]) {
    const body = `Every big milestone deserves a moment.\n\n${fact}\n\nHere's to the next chapter.`;
    const result = parse(JSON.stringify(output(body, type)), request({ source: fact, selectedTypes: [type] }));
    assert.equal(result.sections[0].body, body);
    assert.equal(result.sections[0].cta, "");
  }
  assert.doesNotThrow(() => check("Every big milestone deserves a moment.\n\nGet started with a fresh perspective."));
  assert.doesNotThrow(() => check("We just crossed 1,000 subscribers!\n\nEvery big milestone deserves a moment."));
});

test("all formats and all delivered fields receive the same guard", () => {
  const claim = "We started this business in our attic three years ago.";
  for (const { id } of contentTypes) {
    const value = output("Every big milestone deserves a moment. A fresh perspective can help.", id);
    const req = request({ selectedTypes: [id] });
    assert.doesNotThrow(() => parse(JSON.stringify(value), req));
    for (const target of ["title", "summary", "sectionTitle", "body", "items", "cta", "platform"]) {
      const changed = structuredClone(value);
      if (target === "title" || target === "summary") changed[target] = claim;
      else if (target === "sectionTitle") changed.sections[0].title = claim;
      else changed.sections[0][target] = target === "items" ? [claim] : claim;
      assert.throws(() => parse(JSON.stringify(changed), { ...req, ctaMode: "soft" }), GenerationGroundingError);
    }
  }
});

test("refinement cannot promote an earlier AI invention or edit instruction into factual evidence", () => {
  const claim = "We started this business in our attic three years ago.";
  const refinement = { action: "custom", instructions: `Make it warmer. ${claim}`, section: output(claim).sections[0] };
  assert.throws(() => check(claim, { refinement }), GenerationGroundingError);
  assert.doesNotThrow(() => check(claim, { refinement, source: claim }));
});

test("labelled missing details stay labelled; placeholders cannot hide an adjacent fabricated claim", () => {
  assert.doesNotThrow(() => check("Every big milestone deserves a moment.\n\n[CONFIRM: giveaway deadline]"));
  assert.throws(() => check("[CONFIRM: prize] We started this business in our attic three years ago."), GenerationGroundingError);
  assert.throws(() => check("[CONFIRM: prize]\nWe started this business in our attic three years ago."), GenerationGroundingError);
});

test("user-supplied offer is evidence for an unchanged specification, not for extra guarantees", () => {
  const offer = "The notebook includes a built-in calendar.";
  assert.doesNotThrow(() => check(offer, { offer }));
  assert.throws(() => check(`${offer} Our notebooks come with a lifetime warranty.`, { offer }), GenerationGroundingError);
});
