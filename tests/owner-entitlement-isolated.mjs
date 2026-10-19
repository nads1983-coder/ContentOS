import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadTs } from "./image-test-helpers.mjs";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH, "br-divine-term-b2rihbxv");
assert.ok(["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech", "ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(url.hostname));
for (const key of ["OPENAI_API_KEY", "STRIPE_SECRET_KEY", "RESEND_API_KEY"]) assert.ok(!process.env[key]);
const cache = new Map(), mocks = { "server-only": {} }, runtime = { process };
const repository = loadTs("lib/postgres-repository.ts", mocks, cache, runtime);
const { getPool } = loadTs("lib/db/client.ts", mocks, cache, runtime);
const id = `owner-entitlement-test-${randomUUID()}`, email = `${id}@example.invalid`;
const data = { id, email, plan: "pro_studio", subscription_status: "active", entitlement_source: "owner_complimentary_lifetime",
  subscription_current_period_end: null, amount_paid: 0, stripe_customer_id: "cus_synthetic", stripe_subscription_id: "sub_synthetic",
  generation_history_json: [{ id: "synthetic-history" }], usage_events_json: [], private_test_marker: id };
const pool = getPool();
try {
  await pool.query("INSERT INTO contentos_app.profiles(id,email,data) VALUES ($1,$2,$3::jsonb)", [id,email,JSON.stringify(data)]);
  await Promise.all(Array.from({ length: 6 }, (_, i) => repository.updateSubscriptionStatus({ userId: id,
    plan: i % 2 ? "free" : "pro_creator", status: i % 2 ? "canceled" : "past_due", stripeSubscriptionId: "sub_old" })));
  const actual = (await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1", [id])).rows[0].data;
  assert.deepEqual(actual, data);
  assert.equal((await repository.getUserProfile(id)).plan, "pro_studio");
  console.log("PASS: isolated Neon row-locked lifetime protection survives six concurrent billing updates; history, identifiers and usage unchanged.");
} finally {
  await pool.query("DELETE FROM contentos_app.profiles WHERE id=$1 AND email=$2 AND data->>'private_test_marker'=$1", [id,email]);
  await pool.end();
}
