import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createRateLimitKey } from '@better-auth/core/utils/ip';
import { loadTs } from './image-test-helpers.mjs';

test('dedicated synthetic PostgreSQL Better Auth lifecycle', { skip: process.env.CONTENTOS_AUTH_LIFECYCLE_PG_TEST !== '1', timeout: 90000 }, async t => {
  const path = '/private/tmp/contentos-auth-lifecycle/actor.json';
  assert.equal(statSync(path).mode & 0o777, 0o600);
  for (const key of ['VERCEL', 'VERCEL_ENV', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']) assert.ok(!process.env[key], 'unsafe ambient environment');
  assert.notEqual(process.env.NODE_ENV, 'production');
  const config = JSON.parse(readFileSync(path, 'utf8')).env;
  const url = new URL(config.DATABASE_URL);
  assert.equal(config.CONTENTOS_ISOLATED_BRANCH, 'br-divine-term-b2rihbxv');
  assert.equal(url.hostname, 'ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech');
  assert.equal(url.pathname, '/contentos_auth_security_qa');
  assert.equal(decodeURIComponent(url.username), 'contentos_auth_lifecycle_qa');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  for (const key of ['VERCEL', 'VERCEL_ENV', 'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY']) assert.ok(!config[key], 'unsafe fixture environment');
  assert.notEqual(config.NODE_ENV, 'production');
  const base = 'https://auth-lifecycle.example.invalid';
  const env = { DATABASE_URL: config.DATABASE_URL, CONTENTOS_ISOLATED_BRANCH: config.CONTENTOS_ISOLATED_BRANCH,
    BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: 'synthetic-only-lifecycle-test-secret-never-production' };
  const mail = [], cache = new Map();
  const mocks = { 'server-only': {}, '@/lib/auth-mail': { queueAuthMail: async (user, link, kind) => { mail.push({ id: user.id, link, kind }); } } };
  const runtime = { process: { env }, fetch: async () => { throw new Error('external network forbidden'); }, console: { ...console, error: () => {}, warn: () => {} } };
  const { auth } = loadTs('lib/auth-config.ts', mocks, cache, runtime);
  const { getPool } = loadTs('lib/db/client.ts', mocks, cache, runtime);
  const pool = getPool();
  const prefix = `lifecycle-${randomUUID()}`, password = 'Synthetic-lifecycle-password-2026!', replacement = 'Synthetic-replacement-password-2026!';
  const keys = new Set(), ips = new Map(), octet = randomBytes(1)[0];
  let nextIp = 1, phase = 'database preflight', ready = false;
  const previousWarn = console.warn, previousError = console.error;
  const send = async (name, body, cookie, group) => {
    let ip = group && ips.get(group);
    if (!ip) { ip = `198.18.${octet}.${nextIp++}`; if (group) ips.set(group, ip); }
    const key = createRateLimitKey(ip, `/${name}`);
    if (!keys.has(key)) {
      assert.equal((await pool.query('SELECT 1 FROM contentos_auth.rate_limit WHERE key=$1', [key])).rowCount, 0, 'unique test rate-limit bucket');
      keys.add(key);
    }
    const request = new Request(`${base}/api/account/${name}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { origin: base, 'content-type': 'application/json', 'x-vercel-forwarded-for': ip, ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return auth.handler(request);
  };
  const cookies = response => response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  const session = async cookie => (await send('get-session', undefined, cookie)).json();
  try {
    console.warn = () => {}; console.error = () => {};
    const identity = (await pool.query('SELECT current_database() db, current_user role, session_user login, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.deepEqual(identity, { db: 'contentos_auth_security_qa', role: 'contentos_auth_lifecycle_qa', login: 'contentos_auth_lifecycle_qa', rolsuper: false, rolbypassrls: false });
    ready = true;
    phase = 'signup and verification';
    const users = [];
    for (const name of ['alice', 'bob']) {
      const email = `${prefix}-${name}@example.invalid`;
      const response = await send('sign-up/email', { name, email, password, callbackURL: `${base}/verified` });
      assert.equal(response.status, 200, 'synthetic signup');
      users.push({ id: (await response.json()).user.id, email });
    }
    assert.equal((await send('sign-in/email', { email: users[0].email, password })).status, 403, 'unverified sign-in');
    for (const user of users) {
      const item = mail.find(entry => entry.id === user.id && entry.kind === 'verification');
      assert.ok(item, 'verification captured in memory');
      const link = new URL(item.link);
      assert.equal(link.origin, base);
      const verifyIP = `198.18.${octet}.${nextIp++}`, verifyKey = createRateLimitKey(verifyIP, '/verify-email');
      assert.equal((await pool.query('SELECT 1 FROM contentos_auth.rate_limit WHERE key=$1', [verifyKey])).rowCount, 0);
      keys.add(verifyKey);
      const response = await auth.handler(new Request(link, { headers: { 'x-vercel-forwarded-for': verifyIP } }));
      assert.ok([200, 302].includes(response.status), 'verification response');
    }
    phase = 'sign-in and sessions';
    assert.equal((await send('sign-in/email', { email: users[0].email, password: 'synthetic-incorrect-password' })).status, 401, 'incorrect password');
    const login = async (user, pass) => { const response = await send('sign-in/email', { email: user.email, password: pass }); assert.equal(response.status, 200, 'verified sign-in'); return cookies(response); };
    const alice = await login(users[0], password), alice2 = await login(users[0], password), bob = await login(users[1], password);
    assert.equal((await session(alice)).user.id, users[0].id);
    assert.equal((await session(bob)).user.id, users[1].id);
    phase = 'password reset and account isolation';
    assert.equal((await send('request-password-reset', { email: users[0].email, redirectTo: `${base}/reset` })).status, 200);
    const reset = mail.findLast(entry => entry.id === users[0].id && entry.kind === 'reset');
    assert.ok(reset, 'reset captured in memory');
    const resetURL = new URL(reset.link); assert.equal(resetURL.origin, base);
    const token = resetURL.pathname.split('/').at(-1);
    assert.equal((await send('reset-password', { token, newPassword: replacement })).status, 200);
    assert.equal(await session(alice), null); assert.equal(await session(alice2), null);
    assert.equal((await session(bob)).user.id, users[1].id, 'other account session unchanged');
    assert.equal((await send('reset-password', { token, newPassword: replacement })).status, 400, 'reset token cannot replay');
    assert.equal((await send('sign-in/email', { email: users[0].email, password })).status, 401, 'old password rejected');
    const renewed = await login(users[0], replacement);
    assert.equal((await session(renewed)).user.id, users[0].id);
    assert.equal((await send('sign-out', {}, renewed)).status, 200);
    assert.equal(await session(renewed), null);
    assert.equal((await session(bob)).user.id, users[1].id);
    phase = 'concurrent rate limit';
    const burstIP = `198.18.${octet}.${nextIp++}`, rateKey = createRateLimitKey(burstIP, '/sign-in/email');
    assert.equal((await pool.query('SELECT 1 FROM contentos_auth.rate_limit WHERE key=$1', [rateKey])).rowCount, 0);
    keys.add(rateKey);
    const burst = await Promise.all(Array.from({ length: 12 }, () => auth.handler(new Request(`${base}/api/account/sign-in/email`, {
      method: 'POST', headers: { origin: base, 'content-type': 'application/json', 'x-vercel-forwarded-for': burstIP },
      body: JSON.stringify({ email: `${prefix}-missing@example.invalid`, password })
    }))));
    assert.equal(burst.filter(r => r.status === 401).length, 5);
    assert.equal(burst.filter(r => r.status === 429).length, 7);
    assert.equal((await pool.query('SELECT count FROM contentos_auth.rate_limit WHERE key=$1', [rateKey])).rows[0].count, 5);
    t.diagnostic('PASS: signup, verification, incorrect password, reset replay, session revocation, cross-account isolation, 5/12 concurrent admission; email mocked');
  } catch {
    throw new Error(`Synthetic auth lifecycle failed during ${phase}`);
  } finally {
    console.warn = previousWarn; console.error = previousError;
    try {
      if (ready) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const ids = (await client.query('SELECT id FROM contentos_auth."user" WHERE email LIKE $1', [`${prefix}-%@example.invalid`])).rows.map(row => row.id);
          await client.query('DELETE FROM contentos_app.profiles WHERE id=ANY($1::text[]) AND email LIKE $2', [ids, `${prefix}-%@example.invalid`]);
          await client.query('DELETE FROM contentos_auth.verification WHERE value=ANY($1::text[])', [ids]);
          await client.query('DELETE FROM contentos_auth."user" WHERE id=ANY($1::text[]) AND email LIKE $2', [ids, `${prefix}-%@example.invalid`]);
          await client.query('DELETE FROM contentos_auth.rate_limit WHERE key=ANY($1::text[])', [[...keys]]);
          const remaining = (await client.query('SELECT (SELECT count(*)::int FROM contentos_auth."user" WHERE email LIKE $1) AS users, (SELECT count(*)::int FROM contentos_app.profiles WHERE email LIKE $1) AS profiles, (SELECT count(*)::int FROM contentos_auth.rate_limit WHERE key=ANY($2::text[])) AS buckets', [`${prefix}-%@example.invalid`, [...keys]])).rows[0];
          assert.deepEqual(remaining, { users: 0, profiles: 0, buckets: 0 });
          await client.query('COMMIT');
        } catch { await client.query('ROLLBACK').catch(() => {}); throw new Error('Synthetic fixture cleanup failed'); }
        finally { client.release(); }
      }
    } finally { await pool.end(); }
  }
});
