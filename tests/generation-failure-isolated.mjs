import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadTs, input, receipt } from "./generation-test-helpers.mjs";
import { validateImageIsolatedEnvironment } from "./image-isolated.mjs";

// Existing isolated branch only. No auth accounts, provider calls or production writes.
validateImageIsolatedEnvironment(process.env);
const cache = new Map(), runtime = { process, fetch: async () => { throw new Error("Provider calls forbidden"); } };
const repo = loadTs("lib/postgres-repository.ts", { "server-only": {} }, cache, runtime);
const { getPool } = loadTs("lib/db/client.ts", { "server-only": {} }, cache, runtime);
const { normalizeGenerationRequest } = loadTs("lib/generation-contract.ts", {}, cache, runtime);
const pool = getPool(), id = `failure-isolated-${randomUUID()}`, email = `${id}@example.invalid`;
try {
  await pool.query("INSERT INTO contentos_app.profiles (id,email,data) VALUES ($1,$2,$3::jsonb)", [id, email,
    JSON.stringify({ id, email, plan: "pro_studio", subscription_status: "active", entitlement_source: "founder_offer", amount_paid: 0 })]);
  const req = normalizeGenerationRequest(input({ requestId: randomUUID() }));
  const a = await repo.beginTextGenerationStage(id, req.requestId, req, null);
  assert.equal(a.status, "dispatch");
  const response = { ...receipt(), output_text: '{"private":"synthetic evidence"}' };
  const save = () => repo.checkpointTextGenerationStage(id, req.requestId, a.fingerprint, a.stage, req, response, 25);
  const completed = await Promise.all([save(), save()]);
  assert.ok(completed.every(p => p.status === "failed" && p.diagnostic === "section_count"));
  const row = (await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1", [id])).rows[0].data;
  const pipeline = row.generation_reservations_json[0].pipeline;
  assert.deepEqual(pipeline.failureEvidence.receipt, response);
  assert.equal(pipeline.metrics.length, 1);
  assert.equal(row.generation_history_json, undefined);
  assert.equal(row.usage_events_json, undefined);
  assert.equal(row.entitlement_source, "founder_offer");
  const publicProfile = await repo.getUserProfile(id);
  assert.ok(!JSON.stringify(publicProfile).includes("failureEvidence"));
  assert.ok(!JSON.stringify(publicProfile).includes("synthetic evidence"));
  const retry = await repo.beginTextGenerationStage(id, req.requestId, req, null);
  assert.equal(retry.status, "progress");
  assert.equal(retry.progress.status, "failed");
  await assert.rejects(repo.checkpointTextGenerationStage(`${id}-other`, req.requestId,
    a.fingerprint, a.stage, req, response, 25));
  console.log("PASS: private failure evidence durable; concurrent checkpoint idempotent; reader projection redacted; account isolation; no successful usage/history; Founder preserved; no redispatch.");
} finally {
  await pool.query("DELETE FROM contentos_app.profiles WHERE id=$1 AND email=$2", [id, email]);
  await pool.end();
}
