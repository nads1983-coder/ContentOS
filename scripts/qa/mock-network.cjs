// Non-billable database tests only. Provider, mail and HTTP traffic fail closed.
const { syncBuiltinESMExports } = require('node:module');
const deny = () => { throw new Error('QA verification forbids HTTP/provider access'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
  const mod = require(name); mod.request = deny; mod.get = deny;
}
syncBuiltinESMExports();
for (const name of ['OPENAI_API_KEY', 'DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY']) delete process.env[name];
