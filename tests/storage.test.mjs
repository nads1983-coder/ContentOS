import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
function load(path) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const require = id => id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : nativeRequire(id);
  new Function("exports", "module", "require", compiled)(module.exports, module, require);
  return module.exports;
}
const { readStore, writeStore, storageKey } = load("lib/storage.ts");
const empty = () => ({ version: 1, recent: [], saved: [], drafts: [] });
const store = source => ({ ...empty(), drafts: [{ id: "current-draft", updatedAt: "2026-10-18T00:00:00Z", title: "Draft", source, tone: "professional", selectedTypes: ["linkedin"] }] });

test("device storage is account-scoped and never auto-imports unowned legacy data", () => {
  const items = new Map([["social-content-os:v1", JSON.stringify(store("Legacy private draft"))]]);
  globalThis.window = { localStorage: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) } };
  try {
    assert.deepEqual(readStore("alice"), empty());
    assert.ok(writeStore(store("Alice draft"), "alice"));
    assert.ok(writeStore(store("Bob draft"), "bob"));
    assert.equal(readStore("alice").drafts[0].source, "Alice draft");
    assert.equal(readStore("bob").drafts[0].source, "Bob draft");
    assert.deepEqual(readStore(), empty());
    assert.notEqual(storageKey("alice"), storageKey("bob"));
    assert.ok(items.has("social-content-os:v1"));
  } finally { delete globalThis.window; }
});

test("unavailable browser storage reports failure without destroying the caller's draft", () => {
  globalThis.window = { localStorage: { getItem() { throw Error("Unavailable"); }, setItem() { throw Error("Quota exceeded"); } } };
  try {
    const value = store("Keep this draft");
    assert.equal(writeStore(value, "alice"), false);
    assert.equal(value.drafts[0].source, "Keep this draft");
    assert.deepEqual(readStore("alice"), empty());
  } finally { delete globalThis.window; }
});
