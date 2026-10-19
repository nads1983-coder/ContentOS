import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH,"br-divine-term-b2rihbxv");
assert.ok(new URL(process.env.DATABASE_URL).hostname.startsWith("ep-proud-field-b291xbnc"));
for(const k of ["OPENAI_API_KEY","STRIPE_SECRET_KEY","RESEND_API_KEY"]) assert.ok(!process.env[k]);
const {users}=JSON.parse(readFileSync(process.env.PREVIEW_ACCOUNTS_FILE,"utf8"));
const member=users.find(u=>u.plan==="free");assert.match(member.email,/^premium-preview-.*@example\.invalid$/);
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try {
  const p=(await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1 AND email=$2",[member.id,member.email])).rows[0]?.data;
  assert.equal(p?.premium_preview_fixture,true);
  await pool.query("UPDATE contentos_app.profiles SET data=data || $2::jsonb WHERE id=$1 AND data->>'premium_preview_fixture'='true'",[member.id,JSON.stringify({lifetime_access:{source:"lifetime_purchase",status:"active",textCredits:12,imageCredits:4}})]);
  await pool.query("INSERT INTO contentos_app.ai_budget_configuration(singleton,starts_month,opening_microgbp,evidence_reference) VALUES(true,to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM'),0,'isolated-preview-synthetic-no-provider') ON CONFLICT(singleton) DO NOTHING");
  const c=(await pool.query("SELECT evidence_reference FROM contentos_app.ai_budget_configuration")).rows[0];assert.equal(c.evidence_reference,"isolated-preview-synthetic-no-provider");
  console.log("PASS: existing synthetic free fixture prepared with proposed 12/4 Lifetime credits; isolated zero-cost preview budget initialised.");
} finally { await pool.end(); }
