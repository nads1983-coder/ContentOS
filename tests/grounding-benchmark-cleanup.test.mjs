import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanupCampaign, isDeploymentNotFound, matchesCampaign } from "../scripts/grounding-benchmark/cleanup.mjs";

const projectId = "prj_synthetic", planHash = "a".repeat(64);
const target = { id: "dpl_Synthetic", projectId, target: null, meta: { benchmarkPlanHash: planHash } };
const stepNames = ["disable", "noLogin", "revokeFunctions", "revokeSchema", "terminateSessions", "verifyRevocation"];
function fixture() {
  const calls = [], active = new Map([[target.id, structuredClone(target)]]), remembered = [];
  const config = {
    projectId, planHash, attempted: true, knownDeployments: [],
    databaseSteps: Object.fromEntries(stepNames.map(name => [name, async () => { calls.push(name); }])),
    exportAudit: async () => { calls.push("audit"); },
    listDeployments: async () => { calls.push("list"); return { deployments: [...active.values()], next: null }; },
    getDeployment: async id => { calls.push(`get:${id}`); return active.get(id) ?? null; },
    deleteDeployment: async id => { calls.push(`delete:${id}`); active.delete(id); },
    rememberDeployment: async value => { calls.push("journal"); remembered.push(value); }
  };
  return { config, calls, active, remembered };
}

test("ambiguous CLI output is recovered by exact campaign metadata, then GET confirms deletion", async () => {
  const f = fixture(), result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.deletedDeploymentIds, [target.id]);
  assert.deepEqual(f.calls.slice(0, stepNames.length), stepNames);
  assert.equal(f.remembered[0].meta.benchmarkPlanHash, planHash);
  assert.ok(f.calls.indexOf("journal") < f.calls.indexOf(`delete:${target.id}`));
  assert.equal(f.calls.filter(c => c === `get:${target.id}`).length, 2);
});

test("each DB failure still attempts every other revocation step, audit and deletion", async t => {
  for (const name of stepNames) await t.test(name, async () => {
    const f = fixture();
    f.config.databaseSteps[name] = async () => { f.calls.push(name); throw Error("private database detail"); };
    const result = await cleanupCampaign(f.config);
    assert.equal(result.safeToEraseRecovery, false);
    assert.deepEqual(f.calls.slice(0, stepNames.length), stepNames);
    assert.ok(f.calls.includes("audit"));
    assert.deepEqual(result.deletedDeploymentIds, [target.id]);
    assert.ok(result.errors.includes(`database_${name}_failed`));
    assert.ok(!JSON.stringify(result).includes("private database detail"));
  });
});

test("audit failure cannot prevent deletion, but preserves credentials/recovery", async () => {
  const f = fixture(); f.config.exportAudit = async () => { throw Error("disk error"); };
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, false);
  assert.equal(result.auditExported, false);
  assert.deepEqual(result.deletedDeploymentIds, [target.id]);
});

test("server list filtering is not trusted: unrelated campaign deployments are untouched", async () => {
  const f = fixture();
  const other = { ...target, id: "dpl_Unrelated", meta: { benchmarkPlanHash: "b".repeat(64) } };
  f.active.set(other.id, other);
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, true);
  assert.ok(f.active.has(other.id));
  assert.ok(!f.calls.includes(`delete:${other.id}`));
});

test("production, foreign project, unknown target and absent metadata never authorize deletion", async t => {
  for (const patch of [{ target: "production" }, { projectId: "prj_foreign" }, { target: undefined }, { meta: {} }]) {
    await t.test(JSON.stringify(patch), async () => {
      const f = fixture(); f.config.knownDeployments = [target]; f.active.set(target.id, { ...target, ...patch });
      const result = await cleanupCampaign(f.config);
      assert.equal(result.safeToEraseRecovery, false);
      assert.ok(!f.calls.includes(`delete:${target.id}`));
      assert.ok(result.errors.includes("unsafe_deletion_target"));
    });
  }
});

test("deployment identity is checked again using full GET, not just list metadata", async () => {
  const f = fixture();
  f.config.listDeployments = async () => ({ deployments: [target], next: null });
  f.active.set(target.id, { ...target, meta: { benchmarkPlanHash: "b".repeat(64) } });
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, false);
  assert.equal(f.calls.some(c => c.startsWith("delete:")), false);
});

test("pagination and list uid identity are supported without widening deletion scope", async () => {
  const f = fixture(), cursors = [];
  f.config.listDeployments = async cursor => {
    cursors.push(cursor);
    return cursor === null ? { deployments: [], next: 123 } : { deployments: [{ ...target, id: undefined, uid: target.id }], next: null };
  };
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, true);
  assert.deepEqual(cursors, [null, 123]);
});

test("failed or incomplete discovery retains state even when a known deployment is deleted", async t => {
  for (const mode of ["error", "repeated", "truncated", "malformed"]) await t.test(mode, async () => {
    const f = fixture(); f.config.knownDeployments = [target]; let page = 0;
    f.config.listDeployments = async () => {
      if (mode === "error") throw Error("API unavailable");
      return { deployments: [], next: mode === "malformed" ? undefined : mode === "repeated" ? 1 : ++page };
    };
    const result = await cleanupCampaign(f.config);
    assert.equal(result.safeToEraseRecovery, false);
    assert.deepEqual(result.deletedDeploymentIds, [target.id]);
  });
});

test("empty listing after submission is uncertain, not proof that no deployment exists", async () => {
  const f = fixture(); f.active.clear();
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, false);
  assert.ok(result.errors.includes("deployment_identity_unresolved"));
});

test("prepared but never submitted campaign can clean up with a complete empty listing", async () => {
  const f = fixture(); f.active.clear(); f.config.attempted = false;
  assert.equal((await cleanupCampaign(f.config)).safeToEraseRecovery, true);
});

test("lost DELETE acknowledgement is reconciled by verified absence", async () => {
  const f = fixture();
  f.config.deleteDeployment = async id => { f.active.delete(id); throw Error("lost acknowledgement"); };
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, true);
  assert.deepEqual(result.deletedDeploymentIds, [target.id]);
});

test("a successful DELETE is insufficient without confirming GET absence", async t => {
  for (const mode of ["still_exists", "get_failed"]) await t.test(mode, async () => {
    const f = fixture(); let deleting = false;
    f.config.deleteDeployment = async () => { deleting = true; };
    f.config.getDeployment = async () => { if (deleting && mode === "get_failed") throw Error("API timeout"); return target; };
    const result = await cleanupCampaign(f.config);
    assert.equal(result.safeToEraseRecovery, false);
    assert.ok(result.errors.includes("deployment_deletion_unconfirmed"));
  });
});

test("persisted verified identity allows repeat cleanup after deletion; bare IDs do not", async () => {
  const f = fixture(); f.active.clear(); f.config.knownDeployments = [target];
  assert.equal((await cleanupCampaign(f.config)).safeToEraseRecovery, true);
  f.config.knownDeployments = [{ id: target.id }];
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, false);
  assert.ok(result.errors.includes("unverified_missing_deployment"));
});

test("journal failure still attempts deletion but does not erase recovery", async () => {
  const f = fixture(); f.config.rememberDeployment = async () => { throw Error("disk unavailable"); };
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, false);
  assert.deepEqual(result.deletedDeploymentIds, [target.id]);
});

test("missing plan identity never prevents DB revocation or authorizes arbitrary deletion", async () => {
  const f = fixture(); f.config.planHash = null;
  const result = await cleanupCampaign(f.config);
  assert.equal(result.safeToEraseRecovery, false);
  assert.ok(stepNames.every(name => f.calls.includes(name)));
  assert.equal(f.calls.includes("list"), false);
  assert.equal(f.calls.some(c => c.startsWith("delete:")), false);
});

test("only explicit API not-found evidence confirms absence", () => {
  for (const stderr of ["Error: Deployment not found (404)", "HTTP/1.1 404 Not Found", "status code: 404"]) {
    assert.equal(isDeploymentNotFound({ status: 1, stdout: "", stderr }), true);
  }
  assert.equal(isDeploymentNotFound({ status: 1, stdout: '{"error":{"code":"not_found"}}' }), true);
  for (const stderr of ["Error: HTTP 403 Forbidden", "timeout after 404 milliseconds", "network unavailable", "not found in local CLI cache"]) {
    assert.equal(isDeploymentNotFound({ status: 1, stdout: "", stderr }), false);
  }
  assert.equal(isDeploymentNotFound({ status: 0, stdout: '{"error":{"code":"not_found"}}' }), false);
});

test("operator binds deployment metadata, confirms revocation and gates erasure on complete cleanup", () => {
  const source = readFileSync(new URL("../scripts/grounding-benchmark/operator.mjs", import.meta.url), "utf8");
  assert.match(source, /"--meta", `benchmarkPlanHash=\$\{state\.planHash\}`/);
  assert.match(source, /"meta-benchmarkPlanHash": planHash/);
  assert.match(source, /page\.pagination\?\.next \?\? null/);
  assert.match(source, /rolcanlogin,has_schema_privilege\(oid,\$1,'USAGE'\)/);
  assert.match(source, /rows\[0\]\.rolcanlogin === false && rows\[0\]\.schema_usage === false/);
  const deletion = source.slice(source.indexOf("deleteDeployment: id =>"), source.indexOf("rememberDeployment:"));
  assert.doesNotMatch(deletion, /JSON\.parse|api\(/);
  assert.match(source, /if \(result\.safeToEraseRecovery\) \{[\s\S]*?rmSync\(STAGE[\s\S]*?rmSync\(`\$\{PRIVATE\}\/state\.json`/);
  assert.doesNotMatch(source, /DROP SCHEMA|DROP DATABASE|DROP ROLE/);
  assert.equal(matchesCampaign({ ...target, target: "preview" }, projectId, planHash), true);
});
