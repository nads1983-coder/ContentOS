import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
function loadTs(relative, mocks = {}, cache = new Map()) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`, mocks, cache) : nativeRequire(id);
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}
const contract = loadTs("lib/workspace-contract.ts");
const { workspaceFromProfile, updateWorkspaceProfile, parseWorkspaceWrite, WorkspaceError } = contract;
const preferences = { brandName: "Studio", audience: "Creators", offer: "", writingStyle: "Direct", contentGoal: "Teach" };
const generation = (id = "result-1") => ({ id, createdAt: "2026-10-18T10:00:00.000Z", source: "A useful source", title: "Title", summary: "Summary", tone: "professional", selectedTypes: ["linkedin"], sections: [{ id: "section-1", type: "linkedin", title: "Post", platform: "LinkedIn", body: "Useful text", items: [] }] });
const input = () => ({ revision: 0, store: { version: 1, recent: [], saved: [], drafts: [] }, preferences: { ...preferences } });
const profile = () => ({ id: "alice", email: "alice@example.test", plan: "free", subscription_status: "none" });

test("workspace imports existing history and read-only brands scoped to authenticated account", () => {
  const data = { ...profile(), generation_history_json: JSON.stringify([{ user_id: "alice", payload: generation() }, { user_id: "bob", payload: generation("secret") }]), brand_profiles_json: [{ id: "mine", user_id: "alice" }, { id: "other", user_id: "bob" }] };
  const result = workspaceFromProfile(data, "alice");
  assert.equal(result.revision, 0);
  assert.deepEqual(result.store.recent.map(x => x.id), ["result-1"]);
  assert.deepEqual(result.brandProfiles.map(x => x.id), ["mine"]);
  assert.throws(() => workspaceFromProfile(data, "bob"), e => e.status === 403);
  assert.throws(() => updateWorkspaceProfile(data, "", input()), e => e.status === 403);
});
test("onboarding supplies composer preferences and supported tone", () => {
  const data = { ...profile(), onboarding_json: { businessName: "Name", audience: "People", niche: "Useful detail", goals: "Educate", writingTone: "friendly" } };
  const { preferences: p } = workspaceFromProfile(data, "alice");
  assert.deepEqual(p, { brandName: "Name", audience: "People", offer: "", writingStyle: "Useful detail", contentGoal: "Educate", tone: "friendly" });
  data.onboarding_json.writingTone = "unsupported";
  assert.equal(workspaceFromProfile(data, "alice").preferences.tone, undefined);
});
test("compare-and-swap increments revision, retains unrelated data and refuses stale writes", () => {
  const data = { ...profile(), usage_events_json: [{ id: "usage" }], subscription_status: "active", generation_history_json: [{ payload: generation() }] };
  const first = updateWorkspaceProfile(data, "alice", input());
  assert.equal(first.result.revision, 1);
  assert.equal(first.result.store.recent.length, 1);
  assert.equal(data.studio_state_json, undefined);
  assert.deepEqual(first.data.usage_events_json, data.usage_events_json);
  assert.equal(first.data.subscription_status, "active");
  assert.throws(() => updateWorkspaceProfile(first.data, "alice", input()), e => e.status === 409 && e.revision === 1);
  assert.equal(updateWorkspaceProfile(first.data, "alice", { ...input(), revision: 1 }).result.revision, 2);
});
test("explicit projection excludes images, client usage and privileges cannot be written", () => {
  const value = input();
  value.store.saved = [{ ...generation(), imageBase64: "large", images: ["data:image/png;base64,xyz"] }];
  value.store.images = ["ignored"];
  value.preferences.plan = "pro_studio";
  const parsed = parseWorkspaceWrite(value);
  assert.equal(parsed.store.saved[0].imageBase64, undefined);
  assert.equal(parsed.preferences.plan, undefined);
  for (const field of ["userId", "email", "usage", "brandProfiles", "plan"]) assert.throws(() => parseWorkspaceWrite({ ...input(), [field]: "spoof" }), WorkspaceError);
  value.store.saved[0].sections[0].body = "data:image/png;base64,xyz";
  assert.throws(() => parseWorkspaceWrite(value), /Inline media/);
});
test("validates versions, shapes, revision integers, bounds and brand ownership", () => {
  for (const revision of [-1, 0.5, "0", null, Number.MAX_SAFE_INTEGER]) assert.throws(() => parseWorkspaceWrite({ ...input(), revision }), WorkspaceError);
  assert.throws(() => parseWorkspaceWrite({ ...input(), store: { ...input().store, version: 2 } }), /version/);
  assert.throws(() => parseWorkspaceWrite({ ...input(), store: { ...input().store, drafts: {} } }), WorkspaceError);
  assert.throws(() => parseWorkspaceWrite({ ...input(), preferences: { ...preferences, brandName: "x".repeat(181) } }), WorkspaceError);
  assert.throws(() => updateWorkspaceProfile(profile(), "alice", { ...input(), preferences: { ...preferences, brandProfileId: "bob-brand" } }), /Unknown brand/);
});
test("drafts retain optional brand fields and saved edits survive history merge", () => {
  const value = input();
  value.store.drafts = [{ id: "draft-1", title: "Draft", updatedAt: "2026-10-18T10:00:00Z", source: "Source text", tone: "friendly", selectedTypes: ["linkedin"], ...preferences }];
  value.store.recent = [{ ...generation(), title: "Edited" }];
  const result = updateWorkspaceProfile({ ...profile(), generation_history_json: [{ payload: generation() }] }, "alice", value).result;
  assert.equal(result.store.drafts[0].brandName, "Studio");
  assert.equal(result.store.recent.length, 1);
  assert.equal(result.store.recent[0].title, "Edited");
});
test("malformed overall stored data fails closed instead of overwriting legacy content", () => {
  for (const value of ["{invalid", {}, '"not-an-array"']) {
    const data = { ...profile(), generation_history_json: value };
    assert.throws(() => updateWorkspaceProfile(data, "alice", input()));
    assert.equal(data.generation_history_json, value);
  }
});
test("missing, null, serialized-null, serialized-array and array history remain compatible", () => {
  for (const value of [undefined, null, "null", "", "[]", []]) {
    const data = { ...profile(), generation_history_json: value };
    const updated = updateWorkspaceProfile(data, "alice", input());
    assert.deepEqual(updated.result.store.recent, []);
    assert.equal(updated.result.unavailableHistoryCount, undefined);
    assert.equal(updated.data.generation_history_json, value);
  }
});
test("valid history remains visible with warning count and unrenderable legacy history survives writes", () => {
  const entries = [{ user_id: "alice", payload: generation() }, { user_id: "alice", payload: { id: "legacy-incomplete", source: "Existing text" } }, { user_id: "bob", payload: { id: "foreign" } }];
  for (const raw of [entries, JSON.stringify(entries)]) {
    const data = { ...profile(), generation_history_json: raw };
    const snapshot = workspaceFromProfile(data, "alice");
    assert.equal(snapshot.unavailableHistoryCount, 1);
    assert.deepEqual(snapshot.store.recent.map(entry => entry.id), ["result-1"]);
    const saved = updateWorkspaceProfile(data, "alice", { ...input(), store: snapshot.store });
    assert.equal(saved.result.unavailableHistoryCount, 1);
    assert.equal(saved.data.generation_history_json, raw);
    assert.equal(saved.result.revision, 1);
    assert.equal(data.studio_state_json, undefined);
  }
});

function routeHarness() {
  let user = { id: "alice", email: "untrusted-email@example.test" };
  let data = profile(), failed = false, rejected = false;
  const calls = [];
  const routes = loadTs("app/api/workspace/route.ts", {
    "@/lib/workspace-contract": contract,
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/request-security": { rejectUnsafeWrite: () => rejected ? Response.json({ error: "origin" }, { status: 403 }) : null },
    "@/lib/postgres-repository": {
      getWorkspace: async id => { calls.push(id); if (failed) throw Error("DB unavailable"); return workspaceFromProfile(data, id); },
      saveWorkspace: async (id, value) => { calls.push(id); if (failed) throw Error("DB unavailable"); const update = updateWorkspaceProfile(data, id, value); data = update.data; return update.result; }
    }
  });
  return { routes, calls, setUser: value => { user = value; }, fail: () => { failed = true; }, reject: () => { rejected = true; } };
}
const getRequest = (account = "alice") => new Request("https://app.test/api/workspace?userId=bob", { headers: { "X-ContentOS-Account": account } });
const putRequest = (value, account = "alice") => new Request("https://app.test/api/workspace?userId=bob", { method: "PUT", headers: { "Content-Type": "application/json", "X-ContentOS-Account": account }, body: JSON.stringify(value) });
test("route requires authentication and only uses session ID, with no-store responses", async () => {
  const h = routeHarness();
  const response = await h.routes.GET(getRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await h.routes.PUT(putRequest(input()))).status, 200);
  assert.deepEqual(h.calls, ["alice", "alice"]);
  h.setUser(null);
  assert.equal((await h.routes.GET(getRequest())).status, 401);
  assert.equal((await h.routes.PUT(putRequest(input()))).status, 401);
  assert.equal(h.calls.length, 2);
});
test("route rejects unsafe writes, reports stale revisions and never invents persistence success", async () => {
  const h = routeHarness();
  assert.equal((await h.routes.PUT(putRequest(input()))).status, 200);
  const stale = await h.routes.PUT(putRequest(input()));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).revision, 1);
  h.fail();
  assert.equal((await h.routes.GET(getRequest())).status, 503);
  assert.equal((await h.routes.PUT(putRequest(input()))).status, 503);
  h.reject();
  assert.equal((await h.routes.PUT(putRequest(input()))).status, 403);
});
test("route bounds streamed body size and rejects invalid JSON before repository writes", async () => {
  const h = routeHarness();
  const request = body => new Request("https://app.test/api/workspace", { method: "PUT", headers: { "X-ContentOS-Account": "alice" }, body });
  assert.equal((await h.routes.PUT(request("x".repeat(contract.MAX_WORKSPACE_BYTES + 1)))).status, 413);
  assert.equal((await h.routes.PUT(request("{"))).status, 400);
  assert.equal(h.calls.length, 0);
});

test("a stale account tab cannot load or save content under a changed session", async () => {
  const h = routeHarness();
  for (const account of ["bob", ""]) {
    const read = await h.routes.GET(getRequest(account));
    const write = await h.routes.PUT(putRequest(input(), account));
    assert.equal(read.status, 409);
    assert.equal(write.status, 409);
    assert.equal((await write.json()).code, "account_changed");
  }
  h.setUser({ id: "bob", email: "bob@example.test" });
  assert.equal((await h.routes.PUT(putRequest(input(), "alice"))).status, 409);
  assert.deepEqual(h.calls, [], "Session binding rejects before any database access");
});
