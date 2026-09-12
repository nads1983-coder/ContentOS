import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { CAMPAIGN, CONTENT_HASH } from '../../lib/migration-email.ts';
const [ownerFile, sourceFile, tokenFile, snapshotFile] = process.argv.slice(2);
if (!snapshotFile) throw new Error('Expected owner URL file, original migration inventory, private token file, private snapshot file');
const users = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
if (users.length !== 11 || new Set(users.map(u => u.id)).size !== 11) throw new Error('Unexpected migration inventory');
const client = new pg.Client({ connectionString: fs.readFileSync(ownerFile, 'utf8').trim() });
await client.connect();
try {
  const snapshot = {};
  for (const [schema, table] of [['contentos_app','profiles'], ...['user','account','session','verification'].map(t => ['contentos_auth',t])]) {
    snapshot[`${schema}.${table}`] = (await client.query(`SELECT count(*)::int AS count,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS hash FROM ${schema}."${table}" t`)).rows[0];
  }
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot,null,2), { mode:0o600, flag:'wx' });
  const token = randomBytes(32).toString('hex');
  fs.writeFileSync(tokenFile, token, { mode:0o600, flag:'wx' });
  await client.query('BEGIN');
  // Fail on any previous campaign; never overwrite its token or results when rerun.
  await client.query("INSERT INTO contentos_app.migration_mail_campaign(id,content_hash,operator_token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '2 hours')", [CAMPAIGN, CONTENT_HASH, createHash('sha256').update(token).digest('hex')]);
  const seen = new Set(); const counts = { pending:0, skipped:0 }; const reasons = {};
  for (const source of users) {
    const live = (await client.query('SELECT id,email,name,disabled FROM contentos_auth."user" WHERE id=$1', [source.id])).rows[0];
    const email = (live?.email || source.email).trim().toLowerCase();
    const test = /\btest\b/i.test(source.name) || /\btest\b/i.test(live?.name || '') || /@example\.(com|org|net)$/.test(email) || /\+codex-|\+contentos-production-/.test(email);
    const reason = !live ? 'deleted_account' : (live.disabled || source.disabled) && test ? 'disabled_test_account' : live.disabled || source.disabled ? 'disabled_account' : test ? 'test_account' : seen.has(email) ? 'duplicate_email' : null;
    const status = reason ? 'skipped' : 'pending';
    const recipientKey = reason ? null : email;
    if (!reason) seen.add(email);
    counts[status]++; if (reason) reasons[reason] = (reasons[reason] || 0)+1;
    await client.query('INSERT INTO contentos_app.migration_mail_recipient(id,campaign_id,user_id,email,recipient_key,status,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)', [`${CAMPAIGN}/${source.id}`, CAMPAIGN,source.id,email,recipientKey,status,reason]);
  }
  if (counts.pending !== 8 || counts.skipped !== 3) throw new Error('Eligibility changed; review required before staging');
  await client.query('COMMIT');
  console.log(JSON.stringify({campaign:CAMPAIGN,counts,reasons,contentHash:CONTENT_HASH,expiresInHours:2}));
} catch (error) { await client.query('ROLLBACK'); throw new Error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]') : 'Preparation failed'); }
finally { await client.end(); }
