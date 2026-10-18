import assert from "node:assert/strict";
import test from "node:test";
import { loadTs, input, requestId } from "./generation-test-helpers.mjs";
const client = loadTs("lib/generation-client.ts");
const make = () => { const payload = input(); delete payload.requestId; return { id: requestId(), payload, fingerprint: JSON.stringify(payload), createdAt: Date.now() }; };
const progress = (extra = {}) => ({ status: "pending", requestId: requestId(), stage: "review", nextStage: "1:review:0:0", running: false, reviewedUnits: 0, totalUnits: 20, ...extra });
const options = extra => ({ isCurrent: () => true, progress: () => {}, checkpoint: () => {}, sleep: async () => {}, ...extra });
test("client advances only confirmed stage tokens and accepts content only from final HTTP200", async () => {
  const a = make(), headers = [], messages = [];
  const r = await client.continueGeneration(a, "account-a", options({ progress: m => messages.push(m), fetch: async (_url, init) => {
    headers.push(init.headers); return headers.length === 1 ? Response.json(progress(), { status: 202 }) : Response.json({ sections: [{ body: "validated" }] });
  } }));
  assert.equal(r.sections[0].body, "validated"); assert.equal(headers[0]["X-ContentOS-Stage"], undefined);
  assert.equal(headers[1]["X-ContentOS-Stage"], "1:review:0:0"); assert.match(messages[0], /0 of 20/);
});
test("network and failed stage responses do not automatically retry or clear recovery identity", async () => {
  for (const fetch of [async () => { throw new Error("offline"); }, async () => Response.json({ code: "generation_uncertain", error: "Uncertain" }, { status: 502 })]) {
    let calls = 0; const a = make(); await assert.rejects(client.continueGeneration(a, "a", options({ fetch: (...args) => { calls++; return fetch(...args); } })));
    assert.equal(calls, 1); assert.equal(a.id, requestId());
  }
});
test("account switch stops continuations and ignores the old account response", async () => {
  let active = true, calls = 0, checkpoints = 0;
  await assert.rejects(client.continueGeneration(make(), "a", options({ isCurrent: () => active, checkpoint: () => checkpoints++, fetch: async () => {
    calls++; active = false; return Response.json(progress(), { status: 202 });
  } })), /account changed/);
  assert.equal(calls, 1); assert.equal(checkpoints, 0);
});
test("device recovery is account-scoped, bounded, and restores the same frozen payload", () => {
  const map = new Map(), storage = { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }, a = make();
  client.storeGenerationAttempt(storage, "a", a);
  assert.deepEqual(client.readGenerationAttempt(storage, "a"), a); assert.equal(client.readGenerationAttempt(storage, "b"), null);
  assert.equal(client.readGenerationAttempt(storage, "a", a.createdAt + 46 * 60_000), null);
  client.storeGenerationAttempt(storage, "a", null); assert.equal(client.readGenerationAttempt(storage, "a"), null);
});
test("corrupt device state and malformed/mismatched progress are not accepted", async () => {
  assert.equal(client.readGenerationAttempt({ getItem: () => "{" }, "a"), null);
  for (const p of [progress({ requestId: requestId(2) }), progress({ nextStage: "bad" }), progress({ reviewedUnits: 21 })]) {
    await assert.rejects(client.continueGeneration(make(), "a", options({ fetch: async () => Response.json(p, { status: 202 }) })), /Invalid progress/);
  }
});
