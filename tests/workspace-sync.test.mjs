import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/workspace-sync.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { createWorkspaceWriter } = module.exports;
const state = (name) => ({ store: { version: 1, recent: [], saved: [], drafts: [] }, preferences: { brandName: name } });

test("serializes saves and coalesces newer edits behind an in-flight write", async () => {
  let release;
  const wait = new Promise(r => { release = r; });
  const calls = [];
  const writer = createWorkspaceWriter(4, async input => {
    calls.push(input);
    if (calls.length === 1) await wait;
    return { revision: input.revision + 1 };
  }, () => {});
  const pending = writer.enqueue(state("first"));
  await writer.enqueue(state("second"));
  await writer.enqueue(state("latest"));
  release();
  await pending;
  assert.deepEqual(calls.map(c => [c.revision, c.preferences.brandName]), [[4, "first"], [5, "latest"]]);
});

test("revision conflict stops writes instead of overwriting newer server data", async () => {
  const messages = [];
  let calls = 0;
  const writer = createWorkspaceWriter(2, async () => { calls++; throw new Error("Newer edits exist"); }, m => messages.push(m));
  await writer.enqueue(state("draft"));
  await writer.enqueue(state("later draft"));
  await writer.retry();
  assert.equal(calls, 1);
  assert.equal(messages.at(-1), "Newer edits exist");
});

test("a lost save acknowledgement is never silently retried with a new revision", async () => {
  let calls = 0;
  const writer = createWorkspaceWriter(0, async () => { calls++; throw new Error("Network failed"); }, () => {});
  await writer.enqueue(state("draft"));
  await writer.enqueue(state("newer"));
  assert.equal(calls, 1);
});

test("disposing a workspace cancels queued saves and ignores an in-flight completion", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [], messages = [];
  const writer = createWorkspaceWriter(0, async input => { calls.push(input); await gate; return { revision: 1 }; }, message => messages.push(message));
  const pending = writer.enqueue(state("old account"));
  await writer.enqueue(state("queued old account"));
  writer.dispose();
  await writer.enqueue(state("must not save"));
  release();
  await pending;
  assert.equal(calls.length, 1);
  assert.deepEqual(messages, ["Saving to your account..."]);
});
