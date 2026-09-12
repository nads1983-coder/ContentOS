// Isolated-database test only. Every provider call is replaced by an in-memory mock.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { CAMPAIGN, authorize, dispatchOne, summary } from '../../lib/migration-email.ts';
const url=fs.readFileSync(process.argv[2],'utf8').trim();
if (!url.includes('ep-odd-dawn-b234s8oy')) throw new Error('This test only permits the existing isolated test database');
const pool=new pg.Pool({connectionString:url,max:3});
const token=fs.readFileSync(process.argv[3],'utf8').trim();
const before=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
const calls=[];const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,init)=>{assert.equal(url,'https://api.resend.com/emails');calls.push(init);return Response.json({id:randomUUID()});};
try {
 assert.equal(await authorize(pool,token),true);assert.equal(await authorize(pool,'b'.repeat(64)),false);
 for(let n=0;n<4;n++) await Promise.all([dispatchOne(pool,'mock'),dispatchOne(pool,'mock')]);
 assert.equal(calls.length,8);assert.equal(new Set(calls.map(c=>c.headers['Idempotency-Key'])).size,8);
 assert.equal(new Set(calls.map(c=>JSON.parse(c.body).to[0])).size,8);
 for(let n=0;n<3;n++) await dispatchOne(pool,'mock');
 assert.equal(calls.length,8);assert.deepEqual(await summary(pool),{sent:8,skipped:3});
 await assert.rejects(pool.query("UPDATE contentos_app.migration_mail_recipient SET status='pending' WHERE campaign_id=$1 AND status='sent'",[CAMPAIGN]), /cannot be reopened/);
 await assert.rejects(pool.query("UPDATE contentos_app.migration_mail_recipient SET email='changed@example.com' WHERE campaign_id=$1",[CAMPAIGN]), /permission denied/);
 await assert.rejects(pool.query("DELETE FROM contentos_app.migration_mail_recipient WHERE campaign_id=$1",[CAMPAIGN]), /permission denied/);
 for(const name of Object.keys(before)) {
  const [schema,table]=name.split('.');
  const after=(await pool.query(`SELECT count(*)::int AS count,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS hash FROM ${schema}."${table}" t`)).rows[0];
  assert.deepEqual(after,before[name],`${name} must be unchanged`);
 }
 console.log('PASS: 8 distinct mocked sends; concurrent dispatch and repeated runs do not duplicate; sent rows cannot reopen; runtime cannot edit recipients/delete ledger; profiles and all checked authentication data unchanged. No real emails sent.');
} finally {globalThis.fetch=originalFetch;await pool.end();}
