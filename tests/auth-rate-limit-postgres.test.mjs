import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createRateLimitKey } from '@better-auth/core/utils/ip';
import { validateEnvironment, QA } from '../scripts/qa/campaign.mjs';
import { loadTs } from './image-test-helpers.mjs';

const enabled = process.env.CONTENTOS_AUTH_RATE_LIMIT_PG_TEST === '1';

test('concurrent Better Auth sign-ins share the PostgreSQL rate limit', { skip: !enabled, timeout: 60000 }, async () => {
  const path = '/tmp/contentos-pr7-qa-private/actor-a.json';
  assert.equal(statSync(path).mode & 0o777, 0o600);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  const env = { DATABASE_URL: config.env.DATABASE_URL, CONTENTOS_ISOLATED_BRANCH: config.env.CONTENTOS_ISOLATED_BRANCH, CONTENTOS_QA_MODE: 'mock',
    BETTER_AUTH_URL: 'https://auth-test.example.invalid', BETTER_AUTH_SECRET: 'synthetic-only-auth-test-secret-not-for-production' };
  validateEnvironment(env);
  assert.equal(decodeURIComponent(new URL(env.DATABASE_URL).username), QA.roles[0]);
  const cache = new Map();
  const runtime = { process: { env }, console: { ...console, error: () => {} } };
  const mocks = { 'server-only': {}, '@/lib/auth-mail': { queueAuthMail: async () => { throw new Error('QA mail forbidden'); } } };
  const { auth } = loadTs('lib/auth-config.ts', mocks, cache, runtime);
  const { getPool } = loadTs('lib/db/client.ts', mocks, cache, runtime);
  const pool = getPool();
  const bytes = randomBytes(2), ip = `198.18.${bytes[0]}.${bytes[1]}`;
  const key = createRateLimitKey(ip, '/sign-in/email');
  let ownsKey = false;
  try {
    const identity = (await pool.query('SELECT current_database() AS db, session_user AS login, current_user AS role, contentos_pr7_qa.actor_id() AS actor')).rows[0];
    assert.equal(identity.db, QA.database);
    assert.equal(identity.login, QA.roles[0]);
    assert.equal(identity.role, QA.roles[0]);
    assert.ok(identity.actor);
    const profile = await pool.query("SELECT 1 FROM contentos_app.profiles WHERE id=$1 AND email ~ $2 AND data->>'premium_preview_fixture'='true'", [identity.actor, '^premium-preview-[a-z0-9-]+@example[.]invalid$']);
    assert.equal(profile.rowCount, 1, 'marked synthetic profile required');
    const exists = await pool.query('SELECT 1 FROM contentos_auth.rate_limit WHERE key=$1', [key]);
    assert.equal(exists.rowCount, 0, 'synthetic rate-limit key must be unused');
    ownsKey = true;
    const email = `premium-preview-rate-${randomUUID()}@example.invalid`;
    const send = () => auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/account/sign-in/email`, {
      method: 'POST', headers: { origin: env.BETTER_AUTH_URL, 'content-type': 'application/json', 'x-vercel-forwarded-for': ip },
      body: JSON.stringify({ email, password: 'synthetic-not-a-real-password' })
    }));
    const responses = await Promise.all(Array.from({ length: 12 }, send));
    assert.equal(responses.filter(r => r.status === 401).length, 5, 'exactly five requests reach authentication');
    assert.equal(responses.filter(r => r.status === 429).length, 7, 'all excess concurrent requests are blocked');
    assert.equal((await send()).status, 429, 'the limit remains enforced after the burst');
    const rows = await pool.query('SELECT count FROM contentos_auth.rate_limit WHERE key=$1 AND qa_role=current_user', [key]);
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].count, 5);
  } finally {
    try {
      if (ownsKey) await pool.query('DELETE FROM contentos_auth.rate_limit WHERE key=$1 AND qa_role=current_user', [key]);
    } finally { await pool.end(); }
  }
});
