import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function loadTs(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  });
  const require = id => id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`) : nativeRequire(id);
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}
const { groundingUnits, deterministicIssues, buildGroundingContext, parseGroundingReview,
  groundGeneration, GroundingError } = loadTs("lib/factual-grounding.ts");
const { normalizeGenerationRequest, parseGenerationOutput } = loadTs("lib/generation-contract.ts");
const fact = "A planning note.";
const context = (source = fact, extra = {}) => buildGroundingContext({ source, ...extra });
const captions = [1, 2, 3].map(n => `Caption ${n}\n${fact}`).join("\n\n");
function pack(type, extra = {}) {
  const count = { hooks: 8, ctas: 5, xThread: 5, carousel: 5, emailNewsletter: 3 }[type] ?? 0;
  return { title: "Draft", summary: "Overview", sections: [{
    id: "section", type, title: "Draft", platform: "General", body: fact, cta: "",
    items: Array(count).fill(fact), ...extra
  }] };
}
function field(result, path) {
  return groundingUnits(result).filter(unit => unit.path === `sections.0.${path}`);
}
function review(units, kind, ctx = context(), refs = []) {
  return parseGroundingReview(JSON.stringify({ decisions: units.map(unit => ({
    id: unit.id, kind, references: refs, reason: "none", replacement: null
  })) }), units, ctx);
}
function findings(units, ctx = context()) {
  return units.flatMap(unit => deterministicIssues(unit, ctx));
}

// These examples are regression data following offline diagnosis, not unseen
// evaluation. This local fix is beyond the frozen paid benchmark and NOT live validated.
test("caption title counts require three real sequential body alternatives", () => {
  for (const [type, platform] of [["instagram", "Instagram"], ["tiktok", "TikTok"]]) {
    for (const title of [`${platform} captions (3): a planning note`, `${platform}: 3 short caption options`,
      `${platform}: 3 captions for a planning note`]) {
      const result = pack(type, { title, body: captions });
      assert.deepEqual(findings(field(result, "title")), [], title);
      assert.deepEqual(findings(field(result, "body")), []);
      assert.ok(field(result, "title")[0].annotations);
    }
    for (const body of [captions.replace("Caption 2", "Caption 4"), captions + "\nCaption 4\nAnother note.",
      captions.replace(`Caption 2\n${fact}`, "Caption 2"), fact]) {
      const unit = field(pack(type, { title: `${platform} captions (3): a planning note`, body }), "title")[0];
      assert.equal(unit.annotations, undefined);
      assert.ok(deterministicIssues(unit, context()).includes("missing_evidence"));
    }
  }
});

test("caption labels accept colon/newline and CRLF but not business prose masquerading as labels", () => {
  for (const separator of ["\n", ":\n", ":\r\n", ": "]) {
    const body = [1, 2, 3].map(n => `Caption ${n}${separator}${fact}`).join("\n");
    const units = field(pack("instagram", { body }), "body");
    assert.deepEqual(findings(units), []);
    assert.equal(units.filter(u => u.annotations).length, 3);
  }
  for (const body of ["Caption 1 costs 999 pounds.", "Caption 1.5% growth.", "Caption 1:999 customers."] ) {
    const units = field(pack("instagram", { body }), "body");
    assert.ok(findings(units).includes("missing_evidence"));
    assert.ok(units.every(u => !u.annotations));
  }
});

test("hooks and CTA counts match the actual required item cardinality", () => {
  for (const [type, title] of [["hooks", "Hooks: 8 angles"], ["hooks", "Hooks: 8 options"],
    ["ctas", "CTAs: 5 Product CTA options"]]) {
    const units = field(pack(type, { title }), "title");
    assert.deepEqual(findings(units), []);
    assert.doesNotThrow(() => review(units, "structural"));
    const wrongCount = field(pack(type, { title: title.replace(/\d/, "9") }), "title");
    assert.ok(findings(wrongCount).includes("missing_evidence"));
    assert.throws(() => review(wrongCount, "structural"), GroundingError);
    const missingItem = pack(type, { title });
    missingItem.sections[0].items.pop();
    assert.equal(field(missingItem, "title")[0].annotations, undefined);
  }
});

test("thread indices match array position and never certify fractions or decimal percentages", () => {
  for (const marker of ["1/ ", "1) ", "1. "]) {
    const result = pack("xThread");
    result.sections[0].items[0] = marker + fact;
    const units = field(result, "items.0");
    assert.deepEqual(findings(units), []);
    assert.doesNotThrow(() => review(units, "supported", context(), [{ sourceId: "s0", quote: fact }]));
  }
  for (const text of ["1/5 customers succeeded.", "1/ 1/5 customers succeeded.", "1/5 planning notes.",
    "1/ 9.5% growth.", "9.5% growth.", "1.5% growth.", "2/ A planning note.", "1/999 customers."]) {
    const result = pack("xThread");
    result.sections[0].items[0] = text;
    const units = field(result, "items.0");
    const ctx = context("Growth was 5%.");
    assert.ok(findings(units, ctx).includes("missing_evidence"), text);
    assert.throws(() => review(units, "supported", ctx, [{ sourceId: "s0", quote: ctx.sources[0].text }]), GroundingError, text);
  }
  assert.ok(deterministicIssues("9.5% growth.", context("Growth was 5%.")).includes("missing_evidence"));
});

test("nested carousel and video labels follow a full sequential series at format boundaries", () => {
  for (const item of [
    `Carousel: Slide 1: ${fact}\nSlide 2: ${fact}`,
    `Carousel: Slide 1: ${fact} | Slide 2: ${fact}`,
    `Video: Hook: ${fact} | Beat 1: ${fact} | Beat 2: ${fact}`,
    `Video: Hook: ${fact} Beat 1: ${fact} Beat 2: ${fact}`
  ]) {
    const units = field(pack("repurposePack", { items: [item] }), "items.0");
    assert.deepEqual(findings(units), [], item);
    assert.ok(units.some(u => u.annotations));
  }
  for (const item of [
    `Carousel: Slide 1: ${fact} | Slide 3: ${fact}`,
    `Carousel: Slide 1: ${fact} | Slide 1: ${fact}`,
    `Video: Beat 2: ${fact}`, `Video: Beat 1: ${fact} | Beat 2:`,
    `LinkedIn: Slide 1: ${fact} | Slide 2: ${fact}`,
    `Video: Our Beat 1: ${fact}`, `Carousel: revenue Slide 1: ${fact}`
  ]) {
    const units = field(pack("repurposePack", { items: [item] }), "items.0");
    assert.ok(findings(units).includes("missing_evidence"), item);
    assert.ok(units.every(u => !u.annotations), item);
  }
});

test("spoken beat annotations are confined to script fields and bounded production cues", () => {
  for (const separator of [": ", "\n"]) {
    const body = `Beat 1 (spoken)${separator}${fact}\nBeat 2 (spoken, clarity line)${separator}${fact}\nBeat 3 (spoken, details)${separator}${fact}`;
    assert.deepEqual(findings(field(pack("shortVideoScript", { body }), "body")), []);
    assert.ok(findings(field(pack("linkedin", { body }), "body")).includes("missing_evidence"));
  }
  for (const body of ["Beat 1 (spoken, guaranteed results): A planning note.",
    "Beat 1 (spoken, 999 customers): A planning note.", "Beat 1 (spoken, contact us): A planning note."]) {
    const units = field(pack("shortVideoScript", { body }), "body");
    assert.ok(units.every(u => !u.annotations));
    assert.throws(() => review(units, "creative", context(fact, { ctaMode: "none" })), GroundingError);
  }
});

test("body ordered lists require a full bounded sequence and preserve every business assertion", () => {
  for (const type of ["linkedin", "facebook", "emailNewsletter"]) {
    for (const body of ["1. Place a book by a chair.\n2. Start reading.",
      "1) Choose a quiet spot.\n2) Place a book there.\n3) Try reading."]) {
      const units = field(pack(type, { body }), "body");
      assert.deepEqual(findings(units), []);
      assert.doesNotThrow(() => review(units, "creative"));
    }
    for (const body of ["1. A planning note.\n3. Another note.", "1. A note.\n1. Another note.",
      "1.A note.\n2.Another note.", "1. \n2. A note.", "1. A note.",
      "1/5 customers succeeded.\n2/5 customers succeeded.", "1.5% growth.\n2.5% growth.",
      Array.from({ length: 31 }, (_, i) => `${i + 1}. A note.`).join("\n")]) {
      const units = field(pack(type, { body }), "body");
      assert.ok(findings(units).includes("missing_evidence"), body);
      assert.ok(units.every(u => !u.annotations), body);
    }
    for (const claim of ["GBP 999 per class.", "9.5% growth.", "Guaranteed results.", "Contact us."]) {
      const units = field(pack(type, { body: `1. ${claim}\n2. A planning note.` }), "body");
      assert.ok(units.some(u => u.annotations));
      assert.throws(() => review(units, "creative", context(fact, { ctaMode: "none" })), GroundingError, claim);
    }
  }
});

test("practical numbered experiment remains allowed at its actual thread item path", () => {
  const result = pack("xThread", { items: Array(6).fill(fact) });
  result.sections[0].items[5] = "6) You are not trying to prove anything. You are running a clean experiment: does lowering friction increase reps?";
  const units = field(result, "items.5");
  const ctx = context(fact, { ctaMode: "none" });
  assert.deepEqual(findings(units, ctx), []);
  assert.doesNotThrow(() => review(units, "creative", ctx));
});

test("annotations never exempt numbers or assertions after valid title and item labels", () => {
  for (const text of ["Price GBP 999.", "9.5% growth.", "900 customers succeeded.",
    "Guaranteed results.", "You will master planning.", "Certified experts.", "We provide free support."]) {
    for (const result of [pack("hooks", { title: `Hooks: 8 angles: ${text}` }),
      pack("carousel", { items: [`Slide 1: ${text}`, ...Array(4).fill(fact)] })]) {
      const units = field(result, result.sections[0].type === "hooks" ? "title" : "items.0");
      assert.ok(units.some(u => u.annotations));
      for (const kind of ["creative", "subjective", "structural"]) {
        assert.throws(() => review(units, kind), GroundingError, `${kind}: ${text}`);
      }
    }
  }
});

test("number references use the same assessment but still require actual source provenance", () => {
  const result = pack("xThread");
  result.sections[0].items[0] = "1/ We assessed 17 items.";
  const units = field(result, "items.0");
  const ctx = context("We assessed 17 items. A planning note.");
  assert.deepEqual(findings(units, ctx), []);
  assert.doesNotThrow(() => review(units, "supported", ctx, [{ sourceId: "s0", quote: "We assessed 17 items." }]));
  assert.throws(() => review(units, "supported", ctx, [{ sourceId: "s1", quote: fact }]), GroundingError);
  assert.throws(() => review(units, "supported", ctx, [{ sourceId: "s0", quote: "We assessed 18 items." }]), GroundingError);
  assert.throws(() => review(units, "structural", ctx), GroundingError);
});

test("labels do not weaken currency, duration, negation, brand conflict or No CTA guards", () => {
  const cases = [
    ["Price USD 18.", "Price EUR 18.", {}, "price_offer"],
    ["Finish planning in 45 minutes.", "A class lasts 45 minutes.", {}, "duration_outcome"],
    ["Contact us.", fact, { ctaMode: "none" }, "cta"],
    ["What about you?", fact, { ctaMode: "none" }, "cta"],
    ["Refunds are available.", "No refunds are available.", {}, null]
  ];
  for (const [copy, source, extra, reason] of cases) {
    const result = pack("carousel", { items: [`Slide 1: ${copy}`, ...Array(4).fill(fact)] });
    const units = field(result, "items.0");
    const ctx = context(source, extra);
    if (reason) assert.ok(findings(units, ctx).includes(reason), copy);
    const quote = source === "No refunds are available." ? "refunds are available." : source;
    assert.throws(() => review(units, "supported", ctx, [{ sourceId: "s0", quote }]), GroundingError, copy);
  }
  const result = pack("carousel", { items: ["Slide 1: Workshop price GBP 12.", ...Array(4).fill(fact)] });
  const ctx = context("Workshop price GBP 15.", { offer: "Workshop price GBP 12." });
  assert.throws(() => review(field(result, "items.0"), "supported", ctx, [{ sourceId: "s1", quote: "Workshop price GBP 12." }]), GroundingError);
});

test("same label text in an unrelated field has no server annotation exemption", () => {
  for (const text of ["1/ A planning note.", "1) A planning note.", "Slide 1: A planning note.",
    "Hooks: 8 angles", "Instagram captions (3): A planning note."]) {
    for (const path of ["body", "title", "cta"]) {
      const units = field(pack("linkedin", { [path]: text }), path);
      assert.ok(units.every(u => !u.annotations));
      assert.ok(findings(units).includes("missing_evidence"), `${path}: ${text}`);
    }
  }
});

test("external or modified annotation metadata cannot hide claims", () => {
  const result = pack("xThread");
  result.sections[0].items[0] = "1/ Guaranteed 999% growth.";
  const units = field(result, "items.0");
  units[0].annotations = [[0, units[0].text.length]];
  assert.ok(findings(units).includes("missing_evidence"));
  assert.throws(() => review(units, "structural"), GroundingError);
  const forged = units.map(u => ({ ...u, annotations: [[0, u.text.length]] }));
  assert.ok(findings(forged).includes("missing_evidence"));
  assert.throws(() => review(forged, "structural"), GroundingError);
});

test("original UTF-16 text and offsets survive annotations and review transport without duplicate claim text", async () => {
  const request = normalizeGenerationRequest({ source: fact, selectedTypes: ["xThread"] });
  const raw = pack("xThread", { items: ["1/ A planning note. Another note.",
    "2/ A book \u{1f4d6} nearby.\r\nA quiet start.", ...Array(3).fill(fact)] });
  const result = parseGenerationOutput(JSON.stringify(raw), request);
  let calls = 0;
  const output = await groundGeneration(result, request, async input => {
    const data = JSON.parse(input);
    calls++;
    for (const unit of data.units) {
      const original = unit.path.split(".").reduce((value, key) => value[key], result);
      assert.equal(original.slice(unit.start, unit.end), unit.text);
      assert.ok(!("assessmentText" in unit) && !("claimText" in unit));
      assert.deepEqual(unit.findings, []);
    }
    const annotated = data.units.find(u => u.annotations);
    assert.equal(annotated.text, "1/ A planning note. ");
    assert.deepEqual(annotated.annotations, [[0, 3]]);
    return JSON.stringify({ decisions: data.units.map(u => ({ id: u.id, kind: "subjective",
      references: [], reason: "none", replacement: null })) });
  });
  assert.equal(calls, 1);
  assert.deepEqual(output, result);
});

test("repairs use original offsets and derive annotations afresh without carrying exemptions forward", async () => {
  const request = normalizeGenerationRequest({ source: fact, selectedTypes: ["xThread"] });
  const raw = pack("xThread", { items: ["1/ Invented 999% growth. A planning note.", ...Array(4).fill(fact)] });
  const result = parseGenerationOutput(JSON.stringify(raw), request);
  let calls = 0;
  const output = await groundGeneration(result, request, async input => {
    calls++;
    const data = JSON.parse(input);
    return JSON.stringify({ decisions: data.units.map(u => u.text.includes("999%")
      ? { id: u.id, kind: "unsupported", references: [], reason: "statistic", replacement: "1/ A quiet start." }
      : { id: u.id, kind: "subjective", references: [], reason: "none", replacement: null }) });
  });
  assert.equal(calls, 2);
  assert.equal(output.sections[0].items[0], "1/ A quiet start. A planning note.");
});
