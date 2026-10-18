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
  const require = id => id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`, cache) : nativeRequire(id);
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}
const { scopeFindings } = loadTs("lib/claim-scope.ts");
const reject = (text, sources) => assert.ok(scopeFindings(text, sources).length, text);
const allow = (text, sources) => assert.deepEqual(scopeFindings(text, sources), [], text);
const evidenceDir = resolve(root, "docs/benchmarks/final-delivery-2026-10-18");
const brief = JSON.parse(readFileSync(resolve(evidenceDir, "brief.json"), "utf8"));
const raw = JSON.parse(readFileSync(resolve(evidenceDir, "raw-draft.json"), "utf8"));

// Captures are regression data, not unseen validation or a semantic-review oracle.
const captured = [
  ["linkedin", "body", "Margin Tide’s new Fieldline notebook (A5, moss green cover) has three printed section headings on every page:"],
  ["tiktok", "body", "A5 notebook page with three prompts, no pressure: Notice. Sketch. Revisit."],
  ["facebook", "body", "Each page has three printed headings: Notice, Sketch, Revisit."],
  ["youtubeShorts", "body", "Fieldline by Margin Tide is an A5 notebook with a moss green cover and three printed section headings on each page."],
  ["shortVideoScript", "body", "Every page gives you three headings: Notice, Sketch, Revisit."],
  ["carousel", 1, "Support: Fieldline pages are divided by these headings, designed for everyday observation and informal notes."],
  ["emailNewsletter", "body", "It’s an A5 format notebook with a moss green cover, and each page prints three headings:"],
  ["repurposePack", 0, "Margin Tide’s new Fieldline notebook (A5, moss green cover) has three printed section headings on every page:"],
  ["repurposePack", 5, "Beat: Three headings per page: Notice, Sketch, Revisit."],
  ["repurposePack", 6, "A5 format, moss green cover, and three headings on each page: Notice, Sketch, Revisit."]
];
for (const [i, [type, field, text]] of captured.entries()) {
  test(`captured layout assertion ${i + 1}: ${type}`, () => {
    const section = raw.sections.find(s => s.type === type);
    assert.ok((field === "body" ? section.body : section.items[field]).includes(text));
    reject(text, [brief.source, brief.offer]);
  });
}

test("printed overlays cannot promote notebook-level quantity to per-page quantity", () => {
  reject("3 headings per page", [brief.source]);
  reject("Three headings are printed on every page.", [brief.source]);
  reject("Fieldline pages contain three printed headings.", [brief.source]);
});

test("original notebook specification and one unambiguous generic reference pass", () => {
  for (const text of ["Fieldline has three printed section headings.",
    "Fieldline by Margin Tide has an A5 paper format, a moss green cover and three printed section headings.",
    "The notebook has three printed section headings.",
    "Fieldline has 3 printed headings.", "The notebook contains three headings."]) allow(text, [brief.source]);
});

test("source-backed precise equivalents preserve container, quantity and universal scope", () => {
  for (const text of ["Every page has 3 printed headings.", "All pages contain three printed headings.",
    "3 printed headings per page"]) allow(text, ["Each page has three printed headings."]);
  allow("Every room has three chairs.", ["All rooms contain 3 chairs."]);
  allow("The box has two compartments.", ["The box contains 2 compartments."]);
});

test("quantity belongs to the same object, container and location", () => {
  reject("Each kit contains four screws.", ["Each kit contains two screws and four washers."]);
  reject("Each compartment contains three tools.", ["The kit contains three tools."]);
  reject("Every lesson includes three activities.", ["The course includes three activities."]);
  reject("Three hooks in the kitchen.", ["Three hooks in the hallway."]);
  allow("3 hooks in the kitchen.", ["Three hooks in the kitchen."]);
});

test("bounds are not actual quantities; exact count can support a weaker bound", () => {
  reject("Each box contains four bottles.", ["Each box can contain at most four bottles."]);
  reject("Each kit contains three screws.", ["Each kit contains at least three screws."]);
  allow("Each kit contains at most four screws.", ["Each kit contains four screws."]);
  allow("Each kit contains at least two screws.", ["Each kit contains three screws."]);
  reject("Each kit contains three red screws.", ["Each kit contains three blue screws."]);
});

test("aggregate placement cannot establish a per-item count or vice versa", () => {
  reject("Three hooks in every room.", ["Three hooks across all rooms."]);
  reject("Every room has three hooks.", ["Three hooks across all rooms."]);
  reject("Three hooks across all rooms.", ["Three hooks in every room."]);
  allow("Three hooks across all rooms.", ["Three hooks across all rooms."]);
  allow("Three hooks in every room.", ["Three hooks per room."]);
  reject("The hotel has three hooks in every room.", ["The hotel has three hooks across all rooms."]);
  allow("The hotel has three hooks across all rooms.", ["The hotel has three hooks across all rooms."]);
});

test("written ranges retain both bounds instead of certifying their lower endpoint", () => {
  reject("Each kit contains three tools.", ["Each kit contains three to five tools."]);
  reject("Each kit contains five tools.", ["Each kit contains three to five tools."]);
  allow("Each kit contains three to five tools.", ["Each kit contains 3-5 tools."]);
  allow("Each kit contains at most five tools.", ["Each kit contains three to five tools."]);
  allow("Each kit contains at least three tools.", ["Each kit contains three to five tools."]);
  reject("Each kit contains at most four tools.", ["Each kit contains three to five tools."]);
  reject("Each kit contains three tools.", ["Each kit contains three to several tools."]);
});

test("unresolved pronouns defer to semantic review without supplying named evidence", () => {
  for (const text of ["It has three headings.", "They have three headings.",
    "This has three headings.", "It will contain three headings."]) allow(text, [brief.source]);
  reject("Fieldline has five headings.", [brief.source, "It has five headings."]);
  reject("Every page has three headings.", [brief.source, "They have three headings."]);
  // A pronoun for the outer product does not erase explicit inner page scope.
  reject("It has three headings on every page.", [brief.source]);
  reject("Fieldline has three headings on every page.", [brief.source]);
});

test("one, some, or unspecified objects do not establish every object", () => {
  for (const source of ["A room has three chairs.", "Some rooms have three chairs.", "Rooms have three chairs."]) {
    reject("Every room has three chairs.", [source]);
  }
  allow("Some rooms have three chairs.", ["Every room has three chairs."]);
  reject("The service always delivers reports.", ["The service sometimes delivers reports."]);
  reject("The service usually delivers reports.", ["The service often delivers reports."]);
});

test("negated, hypothetical, conditional and tentative source statements cannot certify stronger claims", () => {
  for (const source of ["Every page does not have three headings.", "No page has three headings.",
    "Every page may have three headings.", "Every page has three headings if the optional template is selected."]) {
    reject("Every page has three headings.", [source]);
  }
  reject("The service will reduce errors.", ["The service may reduce errors."]);
  reject("The service guarantees accurate reports.", ["The service may deliver reports."]);
  allow("The service guarantees accurate reports.", ["The service guarantees accurate reports."]);
  allow("The service may reduce errors.", ["The service reduces errors."]);
});

test("other products cannot supply matching quantities or locations", () => {
  reject("Fieldline has three headings on every page.", [brief.source, "OtherBook has three headings on every page."]);
  reject("Atlas course has five lessons.", ["Atlas course has three lessons. Beacon course has five lessons."]);
  allow("Atlas course has three lessons.", ["Atlas course has three lessons. Beacon course has five lessons."]);
  reject("The notebook has three headings.", ["The notebook, Fieldline, has two headings. The notebook, OtherBook, has three headings."]);
});

test("a joint claim cannot splice quantity from one fact and frequency from another", () => {
  reject("Every room has three chairs.", ["Every room has two chairs.", "Some rooms have three chairs."]);
});

test("local hypothetical illustrations and aesthetic always/never remain semantic work", () => {
  for (const text of ["A quiet blue cover can feel like a fresh start.",
    "The colour always feels welcoming.", "The cover never feels ordinary.",
    "Keeping them separate reduces friction.", "Give each thought one home.",
    "One optional idea: sketch two possible desk layouts and compare which feels calmer.",
    "Optional imaginary example: a box contains three toys.", "Imagine a room with three chairs."]) allow(text, [brief.source]);
  reject("Optional idea: Fieldline has three headings on every page.", [brief.source]);
});

test("with-participants is not a physical containment relation", () => {
  allow("I am testing a 3 step weekly plan with 5 freelance designers for 2 weeks. No results yet, just the process.",
    ["I am testing a three-step weekly plan with five freelance designers for two weeks."]);
});

test("action counts, duration modifiers and subset sentences remain semantic work", () => {
  const examples = [
    "We assessed 17 items in total.",
    "On-screen text: 9 repaired on the day",
    "On-screen text: 6 waiting on parts",
    "Eight platform-flexible hooks grounded in the recorded counts and limitations from the 6 Sep 2027 session.",
    "That is why North Quay Scan Desk offers a 25-minute remote assessment of a household photograph collection.",
    "North Quay Scan Desk offers a 25-minute remote assessment where we look at up to six sample photographs on camera.",
    "We inspect up to six sample photos on camera, identify condition questions, and discuss a possible digitisation order.",
    "Hooks: 8 angles that stay within the facts",
    "Bracken Route Atlas now has Welsh translations on 8 of our 12 route-information pages, reviewed by volunteers.",
    "We have published Bracken Route Atlas 2.6, and 8 of 12 route-information pages are now available in Welsh, volunteer-reviewed.",
    "We have manually checked keyboard navigation on 3 page templates.",
    "Release 2.6 is now live on Bracken Route Atlas.",
    "8 of 12 route pages now in Welsh"
  ];
  for (const text of examples) allow(text, []);
  // Narrowing unknown syntax must retain concrete location and count checks.
  reject("Three printed headings on every page.", [brief.source]);
  reject("Every room has four chairs.", ["Every room has three chairs."]);
});

test("all historical candidate units avoid scope false positives (exposed regression captures)", async () => {
  const { captured, grounding } = await import("./grounding-capture-helpers.mjs");
  let count = 0;
  for (const pack of captured) {
    const sources = grounding.buildGroundingContext(pack.request).sources.map(source => source.text);
    for (const unit of grounding.groundingUnits(pack.result)) {
      assert.deepEqual(scopeFindings(unit.text, sources), [], `${pack.id} ${unit.id}: ${unit.text}`);
      count++;
    }
  }
  assert.equal(count, 719);
});

test("findings are deterministic, deduplicated and contain no source or account data", () => {
  const text = "Every page has three headings. Every page has three headings.";
  const first = scopeFindings(text, [brief.source]);
  assert.deepEqual(first, scopeFindings(text, [brief.source]));
  assert.equal(new Set(first).size, first.length);
  assert.ok(first.every(reason => /^[a-z_]+_scope$/.test(reason)));
});

test("eight exposed independent relationship misses have bounded guards; all paired positives remain allowed", () => {
  const fixture = JSON.parse(readFileSync(resolve(root, "tests/fixtures/independent-grounding-scope.json"), "utf8"));
  const missed = new Set(["scope-01", "scope-05", "scope-07", "scope-09", "scope-11", "scope-15", "scope-17", "scope-21"]);
  for (const item of fixture.cases) {
    if (!missed.has(item.id) && item.expected !== "allow") continue;
    const sources = [item.source, ...Object.values(item.brandContext ?? {})];
    const findings = scopeFindings(item.output, sources, [item.source]);
    if (missed.has(item.id)) assert.ok(findings.length, item.id);
    else assert.deepEqual(findings, [], item.id);
  }
});

test("explicit universal coverage and receipts preserve their actor and property", () => {
  reject("Every submitted design received written feedback.", ["One submitted design received written feedback."]);
  allow("Every submitted design received written feedback.", ["All submitted designs received written feedback."]);
  allow("All gallery pages and ticket checkout have audio descriptions.", ["Every gallery page has audio descriptions. Ticket checkout has audio descriptions."]);
  reject("All gallery pages and ticket checkout have audio descriptions.", ["One gallery page has audio descriptions. Ticket checkout has audio descriptions."]);
  reject("All gallery pages and ticket checkout have audio descriptions.", ["Every gallery page has audio descriptions. Ticket checkout has captions."]);
  reject("Every gallery page has audio descriptions.", ["Every gallery page has captions."]);
  reject("All gallery pages have audio descriptions.", ["Some gallery pages have audio descriptions."]);
  allow("Every submitted design received written feedback.", ["Each submitted design received written feedback."]);
  for (const text of ["Every idea has value.", "All colours have personality.", "Every story has a beginning.",
    "One submission got feedback.", "One submitted design received written feedback.",
    "Three of six submitted designs received written feedback."]) allow(text, ["Six designs were submitted. One submitted design received written feedback."]);
  allow("Every submitted design received written feedback.", ["Each submission got written feedback."]);
});

test("service location and recurring schedule need their exact business relationship", () => {
  const sources = ["River Post provides package collection at its North desk only."];
  allow("Collect packages at River Post's North desk.", sources);
  reject("Collect packages at River Post's South desk.", sources);
  reject("Collect packages at Another Post's North desk.", sources);
  allow("River Arts hosts demonstrations every week.", ["River Arts holds demonstrations weekly."]);
  reject("River Arts hosts demonstrations every week.", ["River Arts holds demonstrations monthly."]);
  reject("River Arts hosts demonstrations every week.", ["River Arts has announced demonstrations on 5 May 2029."]);
});

test("completed review counts cannot borrow capacity or a different review's actual count", () => {
  allow("Four fabric samples were reviewed during the latest evaluation.", ["Four fabric samples were reviewed during the latest evaluation."]);
  reject("Four fabric samples were reviewed during the latest evaluation.", ["Three samples were reviewed during the latest evaluation. Four samples were reviewed during the previous evaluation."]);
  reject("Four fabric samples were reviewed during the latest evaluation.", ["The latest evaluation can include at most four samples."]);
  allow("The latest evaluation reviewed four fabric samples.", ["Four fabric samples were reviewed during the latest evaluation."]);
  allow("The latest evaluation reviewed four samples.", ["Four fabric samples were reviewed during the latest evaluation."]);
  allow("Four samples were reviewed during the latest evaluation.", ["The latest evaluation reviewed four samples."]);
  reject("The latest evaluation reviewed four fabric samples.", ["The latest evaluation reviewed four paint samples."]);
  reject("Four fabric samples were reviewed during the latest evaluation.", ["Four paint samples were reviewed during the latest evaluation."]);
  allow("The latest evaluation reviewed four fabric samples.", ["Four fabric samples were reviewed during the latest evaluation."]);
  allow("The latest evaluation reviewed three fabric samples.", ["Three samples were reviewed during the latest evaluation."]);
  // No partial parse of a qualified source may certify the simpler assertion.
  reject("The latest evaluation reviewed four fabric samples.", ["The latest evaluation reviewed four fabric samples, if the proposed review goes ahead."]);
  reject("The latest evaluation reviewed four fabric samples.", ["The latest evaluation reviewed four fabric samples, or possibly fewer."]);
  allow("The latest evaluation reviewed three fabric samples, one below the four-sample maximum.", ["Three samples were reviewed during the latest evaluation."]);
});

test("capabilities and directional licenses stay attached to the named entities", () => {
  allow("Slate Pro supports offline document editing.", ["Slate Pro can edit documents offline."]);
  reject("Slate Plus supports offline document editing.", ["Slate Pro can edit documents offline."]);
  reject("Slate Pro supports offline document editing.", ["Slate Pro can edit documents online."]);
  allow("Cedar Type licenses its fonts to North Press under this agreement.", ["Cedar Type licenses its fonts to North Press."]);
  reject("North Press licenses its fonts to Cedar Type under this agreement.", ["Cedar Type licenses its fonts to North Press."]);
});

test("only explicit current-source provenance overrides a matching saved schedule", () => {
  const current = "River Post now accepts returns only on Wednesday.";
  const saved = "River Post accepts returns Monday through Friday.";
  const claim = saved;
  assert.ok(scopeFindings(claim, [saved, current], [current]).length);
  assert.ok(scopeFindings(claim, [current, saved], [current]).length);
  assert.ok(scopeFindings(claim, [saved], [current]).length, "a saved-only citation cannot evade current provenance");
  assert.deepEqual(scopeFindings(claim, [saved, current], []), [], "string order alone is not authoritative provenance");
  assert.deepEqual(scopeFindings("River Post accepts parcel returns only on Wednesday.", [saved, current], [current]), []);
  assert.deepEqual(scopeFindings(claim, [saved], ["Another Post now accepts returns only on Wednesday."]), []);
});

test("nonexclusive schedules admit subsets but not invented exclusive restrictions", () => {
  const broad = "River Post accepts returns Monday through Friday.";
  allow("River Post accepts returns on Wednesday.", [broad]);
  allow("River Post accepts returns Tuesday through Thursday.", [broad]);
  reject("River Post accepts returns only on Wednesday.", [broad]);
  reject("River Post accepts returns on Saturday.", [broad]);
  allow("River Post accepts returns on Wednesday.", ["River Post accepts returns only on Wednesday."]);
  reject("River Post accepts returns only on Wednesday.", ["River Post accepts returns on Wednesday."]);
});

test("collection exclusivity needs exclusive evidence, not merely one matching location", () => {
  const source = "River Post provides package collection at its North desk and South desk.";
  allow("Parcel collection is available at Copper Parcel's East Wharf desk only.", ["Copper Parcel offers parcel collection at its East Wharf desk only."]);
  allow("Package collection is available at River Post's North desk.", [source]);
  allow("Both River Post's North desk and South desk provide package collection.", [source]);
  reject("Package collection is available only at River Post's North desk.", [source]);
  reject("Package collection is available at River Post's North desk only.", [source]);
  reject("Both River Post's North desk and South desk provide package collection.", ["River Post provides package collection at its North desk only."]);
});

test("material qualifiers cannot borrow a generic total over an explicit other material", () => {
  for (const text of ["Four fabric samples were reviewed during the latest evaluation.", "The latest evaluation reviewed four fabric samples."]) {
    reject(text, ["Four metal samples were reviewed during the latest evaluation."]);
    reject(text, ["Four samples were reviewed during the latest evaluation. Four metal samples were reviewed during the latest evaluation."]);
  }
});

test("newly exposed eight paraphrase pairs reject decoys and preserve legitimate variants", () => {
  const fixture = JSON.parse(readFileSync(resolve(root, "tests/fixtures/direct-reviewer-scope.json"), "utf8"));
  for (const pair of fixture.pairs) {
    const sources = [pair.source, ...Object.values(pair.brandContext)];
    assert.ok(scopeFindings(pair.unsupported.text, sources, [pair.source]).length, pair.id);
    assert.deepEqual(scopeFindings(pair.legitimate.text, sources, [pair.source]), [], pair.id);
  }
  allow("All six submitted designs received written feedback.", ["Every submitted design received written feedback."]);
  allow("River Arts's demonstrations recur every week.", ["River Arts holds demonstrations weekly."]);
  allow("Slate Mini and Slate Plus both support offline note editing.", ["Slate Mini can edit notes offline. Slate Plus can edit notes offline."]);
  allow("North Press receives its font licence from Cedar Type under this agreement.", ["Cedar Type licenses its fonts to North Press."]);
  allow("The latest evaluation reviewed the full allowance of four fabric samples.", ["The latest evaluation can include at most four fabric samples. Four fabric samples were reviewed during the latest evaluation."]);
});

test("explicit universal cardinality cannot be discarded or borrowed from unrelated facts", () => {
  reject("All four gallery pages have audio descriptions.", ["All six gallery pages have audio descriptions."]);
  reject("All six gallery pages have audio descriptions.", ["All four gallery pages have audio descriptions."]);
  reject("All four submitted designs received written feedback.", ["All six submitted designs received written feedback."]);
  reject("All four gallery pages and ticket checkout have audio descriptions.", ["All six gallery pages have audio descriptions. Ticket checkout has audio descriptions."]);
  allow("All six gallery pages have audio descriptions.", ["All 6 gallery pages have audio descriptions."]);
  allow("All gallery pages have audio descriptions.", ["All six gallery pages have audio descriptions."]);
  allow("All six gallery pages have audio descriptions.", ["Every gallery page has audio descriptions."]);
  allow("All four gallery pages have audio descriptions.", ["All four gallery pages have audio descriptions. All six rooms have audio descriptions."]);
  reject("All four gallery pages have audio descriptions.", ["Every gallery page has audio descriptions. All six gallery pages have audio descriptions."]);
});
