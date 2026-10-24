import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
const { AbortSignal, Response } = globalThis;

export const QA = Object.freeze({
  branch: 'br-divine-term-b2rihbxv', cap: 2_680_000, calls: 6,
  database: 'contentos_pr7_qa', roles: Object.freeze(['pr7_qa_synthetic_a', 'pr7_qa_synthetic_b', 'pr7_qa_synthetic_c']),
  project: 'proj_cWmsh75EFvfVU0gLoqEoD3OV',
  textModel: 'gpt-4.1', imageModel: 'gpt-image-2.5-flare-2026-09-08',
  maxima: Object.freeze({ text: 547431, image: 345576 })
});
export class QAError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new QAError(code); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));

// Reuse the reviewed pricing policy without importing customer routes or secrets.
const costModule = { exports: {} };
const compiled = ts.transpileModule(readFileSync(new URL('../../lib/ai-cost.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
new Function('require', 'exports', compiled)(name => {
  if (name !== 'node:crypto') fail('unexpected_cost_dependency');
  return { createHash };
}, costModule.exports);
const { quoteAI, usageCost } = costModule.exports;

export function validateEnvironment(env) {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { fail('isolated_database_required'); }
  if (env.CONTENTOS_ISOLATED_BRANCH !== QA.branch || url.pathname !== '/' + QA.database ||
      !QA.roles.includes(decodeURIComponent(url.username)) ||
      !['ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech', 'ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech'].includes(url.hostname)) fail('isolated_database_required');
  if (env.VERCEL || env.VERCEL_ENV || env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production' ||
      !['mock', 'live'].includes(env.CONTENTOS_QA_MODE)) fail('local_qa_only');
  for (const key of ['OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'RESEND_API_KEY']) {
    if (env[key] || process.env[key]) fail('ambient_credentials_forbidden');
  }
  return true;
}

export function manifest({ approval, account, email, slots, expiresAt, now = new Date() }) {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(approval) || !account ||
      !/^premium-preview-[a-z0-9-]+@example\.invalid$/.test(email)) fail('synthetic_identity_required');
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= +now || expiry > +now + 86400_000) fail('invalid_campaign_expiry');
  if (!Array.isArray(slots) || slots.length !== QA.calls || new Set(slots.map(s => s.id)).size !== QA.calls) fail('six_unique_slots_required');
  const sealed = slots.map(s => {
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(s.id) || !Object.hasOwn(QA.maxima, s.kind) ||
        !Number.isSafeInteger(s.reservation) || s.reservation <= 0 || s.reservation > QA.maxima[s.kind] ||
        (s.payloadHash !== undefined && !/^[a-f0-9]{64}$/.test(s.payloadHash))) fail('invalid_slot');
    return { id: s.id, kind: s.kind, reservation: s.reservation, payloadHash: s.payloadHash ?? null, state: 'reserved' };
  });
  const total = sealed.reduce((sum, s) => sum + s.reservation, 0);
  if (total > QA.cap) fail('campaign_budget_exceeded');
  const identity = { approval, account, email, expiresAt: new Date(expiry).toISOString(), slots: sealed };
  return { id: randomUUID(), ...identity, manifestHash: hash(identity), reserved: total, dispatches: 0, status: 'ready' };
}

function validState(c) {
  if (!c || !Array.isArray(c.slots) || c.slots.length !== 6 || c.reserved > QA.cap || c.dispatches > 6 ||
      c.reserved !== c.slots.reduce((n, s) => n + s.reservation, 0) ||
      c.dispatches !== c.slots.filter(s => s.state !== 'reserved').length) fail('corrupt_campaign');
  const sealed = c.slots.map(s => ({ id: s.id, kind: s.kind, reservation: s.reservation, payloadHash: s.payloadHash, state: 'reserved' }));
  if (c.manifestHash !== hash({ approval: c.approval, account: c.account, email: c.email, expiresAt: c.expiresAt, slots: sealed }) ||
      c.slots.some(s => !['reserved', 'dispatching', 'succeeded', 'failed', 'uncertain'].includes(s.state))) fail('corrupt_campaign');
}

export function createGate(store, { now = () => new Date() } = {}) {
  return {
    async create(input) {
      const c = manifest({ ...input, now: now() });
      await store.create(c);
      return { id: c.id, reserved: c.reserved, manifestHash: c.manifestHash };
    },
    async inspect(id) { return store.transaction(id, c => { validState(c); return clone(c); }); },
    async run({ campaignId, slotId, account, payload }, provider) {
      // Serialize once, then use precisely this snapshot for both pricing and dispatch.
      const body = clone(payload);
      const admission = await store.transaction(campaignId, c => {
        validState(c);
        if (c.account !== account) fail('account_mismatch');
        const slot = c.slots.find(s => s.id === slotId);
        if (!slot) fail('unapproved_slot');
        const digest = hash(body);
        if ((slot.boundHash ?? slot.payloadHash) && (slot.boundHash ?? slot.payloadHash) !== digest) fail('payload_mismatch');
        if (slot.state === 'succeeded') return { replay: clone(slot.response) };
        if (slot.state !== 'reserved') fail('attempt_already_consumed');
        if (c.status !== 'ready' || c.slots.some(s => s.state === 'dispatching')) fail('campaign_stopped_or_inflight');
        if (+now() >= Date.parse(c.expiresAt)) fail('campaign_expired');
        if (c.dispatches >= QA.calls) fail('dispatch_limit');
        if (body.model !== (slot.kind === 'text' ? QA.textModel : QA.imageModel)) fail('unapproved_model');
        if (slot.kind === 'text' && (Object.keys(body).some(k => !['model','instructions','input','max_output_tokens','text'].includes(k)) ||
            typeof body.input !== 'string' || (body.instructions !== undefined && typeof body.instructions !== 'string'))) fail('unapproved_text_payload');
        const quote = quoteAI(slot.kind, body, now());
        if (quote.maximum > slot.reservation) fail('slot_reservation_exceeded');
        slot.boundHash = digest;
        slot.quote = quote;
        slot.state = 'dispatching';
        slot.startedAt = now().toISOString();
        c.dispatches++;
        return { quote, kind: slot.kind };
      });
      if (admission.replay) return admission.replay;
      // The transaction is committed before the provider callback. Ambiguous commits
      // never reach this point, and a leftover dispatching slot cannot be retried.
      let response, state = 'uncertain', actual = null;
      try {
        response = await provider(body, admission.kind);
        if (!Number.isInteger(response?.status) || response.status < 200 || response.status > 599) throw new Error();
        if (response.status >= 400) state = 'failed';
        else if (response.status < 300) {
          actual = usageCost(admission.quote, response.body?.usage);
          if (actual !== null && Buffer.byteLength(JSON.stringify(response)) <= 8_000_000) state = 'succeeded';
        }
      } catch { /* Unknown provider outcomes retain the entire reservation. */ }
      await store.transaction(campaignId, c => {
        validState(c);
        const slot = c.slots.find(s => s.id === slotId);
        if (c.account !== account || slot?.state !== 'dispatching' || slot.boundHash !== hash(body)) fail('completion_mismatch');
        slot.state = state;
        slot.finishedAt = now().toISOString();
        slot.actualMicroGBP = actual;
        if (state === 'succeeded') slot.response = clone(response);
        // Failed HTTP responses can still be billable. Neither failures nor savings
        // reduce the original campaign reservation or reopen any slot.
        else c.status = 'stopped';
        if (c.dispatches === QA.calls && state === 'succeeded') c.status = 'complete';
      });
      if (state !== 'succeeded') fail(`provider_${state}`);
      return response;
    }
  };
}

export function postgresStore(pool, env) {
  validateEnvironment(env);
  validateEnvironment({ ...env, DATABASE_URL: pool.options?.connectionString });
  const role = decodeURIComponent(new URL(env.DATABASE_URL).username);
  const verifyConnection = async client => {
    const identity = (await client.query('SELECT current_database() AS db, session_user AS login, current_user AS role, contentos_pr7_qa.actor_id() AS actor')).rows[0];
    if (identity?.db !== QA.database || identity.login !== role || identity.role !== role || !identity.actor) fail('qa_database_identity_mismatch');
    return identity.actor;
  };
  return {
    async create(c) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (await verifyConnection(client) !== c.account) fail('account_mismatch');
        const row = (await client.query("SELECT 1 FROM contentos_app.profiles WHERE id=$1 AND email=$2 AND data->>'premium_preview_fixture'='true'", [c.account, c.email])).rows[0];
        if (!row) fail('synthetic_profile_required');
        await client.query('INSERT INTO contentos_pr7_qa.campaigns(id,approval,document) VALUES($1,$2,$3::jsonb)', [c.id, c.approval, JSON.stringify(c)]);
        await client.query('COMMIT');
      } catch { await client.query('ROLLBACK').catch(() => {}); fail('campaign_creation_refused'); }
      finally { client.release(); }
    },
    async transaction(id, fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await verifyConnection(client);
        const row = (await client.query('SELECT document FROM contentos_pr7_qa.campaigns WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!row) fail('campaign_missing');
        const before = JSON.stringify(row.document), result = fn(row.document);
        if (result instanceof Promise) fail('async_transaction_forbidden');
        if (JSON.stringify(row.document) !== before) await client.query('UPDATE contentos_pr7_qa.campaigns SET document=$2::jsonb WHERE id=$1', [id, JSON.stringify(row.document)]);
        await client.query('COMMIT');
        return result;
      } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e instanceof QAError ? e : new QAError('campaign_storage_unavailable'); }
      finally { client.release(); }
    }
  };
}

export function loadQaKey({ env, path, workspace, permit, now = new Date() }) {
  validateEnvironment(env);
  if (env.CONTENTOS_QA_MODE !== 'live' || !permit || permit.project !== QA.project ||
      permit.paidExecutionApproved !== true || !Number.isFinite(Date.parse(permit.keyExpiresAt)) ||
      Date.parse(permit.keyExpiresAt) <= +now) fail('live_execution_not_authorised');
  if (resolve(path) !== resolve(workspace, '.env.pr7-qa.local')) fail('unapproved_key_path');
  // O_NOFOLLOW plus descriptor checks prevent a symlink/permission race. The key
  // is returned only to the designated transport, never exported to process.env.
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const s = fstatSync(fd);
    if (!s.isFile() || s.nlink !== 1 || (s.mode & 0o777) !== 0o600 || s.uid !== process.getuid()) fail('unsafe_key_file');
    const match = readFileSync(fd, 'utf8').trim().match(/^OPENAI_API_KEY=(?:"(sk-[^"\s]+)"|(sk-[^\s]+))$/);
    if (!match) fail('invalid_key_file');
    return match[1] ?? match[2];
  } finally { closeSync(fd); }
}

// Inject this fetch into the existing routes/SDK only in a local QA harness.
// It is NOT exported from customer code and creates no HTTP endpoint.
export function guardedFetch({ gate, campaignId, slotId, account, env, permit, keyPath, workspace, send = globalThis.fetch }) {
  validateEnvironment(env);
  return async (url, init = {}) => {
    const href = String(url);
    if (init.method !== 'POST' || !['https://api.openai.com/v1/responses', 'https://api.openai.com/v1/images/generations'].includes(href) || typeof init.body !== 'string') fail('unapproved_endpoint');
    if (!permit || permit.campaignId !== campaignId || permit.paidExecutionApproved !== true || env.CONTENTOS_QA_MODE !== 'live') fail('live_execution_not_authorised');
    const response = await gate.run({ campaignId, slotId, account, payload: JSON.parse(init.body) }, async (body, kind) => {
      const expected = kind === 'text' ? 'https://api.openai.com/v1/responses' : 'https://api.openai.com/v1/images/generations';
      if (href !== expected) fail('endpoint_kind_mismatch');
      const key = loadQaKey({ env, path: keyPath, workspace, permit });
      const result = await send(expected, {
        method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'OpenAI-Project': QA.project },
        body: JSON.stringify(body), signal: AbortSignal.timeout(90_000)
      });
      // Bounded reads avoid persisting arbitrary provider errors or credentials.
      if (!result.ok) return { status: result.status };
      const reader = result.body.getReader(); let bytes = 0; const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 8_000_000) fail('provider_response_too_large');
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
      const serialized = Buffer.concat(chunks).toString('utf8');
      if (serialized.includes(key)) fail('secret_in_response');
      return { status: result.status, body: JSON.parse(serialized) };
    });
    return Response.json(response.body, { status: response.status });
  };
}
