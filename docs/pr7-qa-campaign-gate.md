# PR7 QA campaign safety gate

Setup and mocked verification only. No paid execution is authorised by this change.

## Scope

- `scripts/qa/campaign.mjs` is an operator-only module, not imported by application code and not an HTTP endpoint.
- `scripts/qa/schema.sql` and `scripts/qa/isolation.sql` apply only to the EMPTY, synthetic-only database `contentos_pr7_qa` on existing temporary branch `br-divine-term-b2rihbxv`. They are deliberately outside production `drizzle/` migration discovery. The former database `contentos` is no longer an accepted QA target.
- No application routes, UI, provider models, subscriptions, entitlements, customer quotas, GBP30 monthly controls or production migrations changed.
- Three dedicated SQL-created roles have no administrator memberships, inheritance, BYPASSRLS, schema ownership or DDL rights. Forced RLS binds each role to one synthetic account using `session_user` and an owner-only registry, not a caller-supplied setting. They can maintain only their own sessions, rate limits, profile data and campaign records. They cannot register accounts, change credentials, access billing/mail tables or reset/delete campaign audits. These grants do not apply to production.
- Historical mock audits remain unchanged in the old database. No copied customer rows were imported into the new QA database. See `pr7-qa-database-isolation.md` for the current verification verdict and setup cleanup requirement; the earlier gate-only GO was not proof of database isolation.

## Accounting and recovery

Creation reserves all six explicitly named slots in one database insert. Maximum total is 2,680,000 integer micro-GBP. The planned three text / three image maxima reserve 2,679,021; this leaves 979 micro-GBP, not an extra call. A unique approval reference prevents accidental re-creation under the same authority. Campaigns use random UUIDs and expire within 24 hours.

Each dispatch locks the campaign row, verifies the synthetic account, slot, payload identity, exact model, current reviewed cost quote and slot allowance, and commits `dispatching` before network I/O. One in-flight call is permitted per campaign. No database transaction remains open during the provider call. The full reservation is never reduced or recycled, including on success. Actual usage-priced cost is a separate audit field.

Completed requests replay the persisted response without dispatch. Reusing a slot with a different payload or account is rejected. HTTP failure, timeout, malformed usage or provider-bound violation consumes the slot and stops the campaign. An interrupted/lost-acknowledgement `dispatching` slot blocks all further dispatches, including after process restart. There is no expiry lease, automatic retry or recovery operation that resets a consumed slot. Failed persistence fails closed. Database triggers protect manifest identity, slot allocations, terminal slots and monetary reservations; privileged database owners remain trusted administrators.

## Credential handling

The already-approved `.env.pr7-qa.local` remains Git-ignored, mode 0600, and is not a normal Next.js auto-loaded env filename. No secret value was changed, copied to a new destination or loaded during these tests. The designated loader rejects symlinks, extra hard links, wrong ownership/permissions, other filenames, expired permission metadata, production and Vercel/Preview environments, ambient OpenAI/payment/email secrets and wrong database identity.

`guardedFetch()` loads the key only after durable dispatch admission, sends only to the two fixed OpenAI endpoints with redirects refused, and replaces caller headers with the QA project/key. It never exports the key to `process.env`, command-line arguments, reports or SDK logging. Output reads are bounded; raw error bodies are not retained. Tests use an obviously fake credential and mocked transport. A separate explicit paid-execution permit is required; none has been created for the real campaign.

Residual limitation: Unix file permissions are not a boundary against other processes running as the same OS user, root, or a malicious operator with access to the local runner/database. Complete same-user isolation would require an additional OS identity or sandbox. No such stronger isolation is claimed. Keep the key outside ordinary dev processes, use its 24-hour expiry, and revoke immediately after the later authorised campaign. The local expiry check supplements, not replaces, provider-enforced expiry. Recheck the exact provider expiry before execution; do not renew automatically.

## Later live execution, only after separate approval

1. Reverify the exact candidate, QA project restrictions, actual key expiry, current model pricing and payload bounds. Keep production/Preview credentials and customer data inaccessible.
2. Load only the account-specific private QA configuration from `/tmp/contentos-pr7-qa-private/actor-a.json` (or the explicitly selected synthetic actor). Never load the former Preview database credential. No public listener, Preview generation or firewall change is required. The gate rejects the legacy database and runtime role and verifies the authenticated database identity on each transaction.
3. Create ONE manifest using the founder's unique paid-approval reference and three text/three image slots, bound to one synthetic account. Seal known payload hashes; dependent refinement can bind its exact payload at its first admission. Persist and reuse the returned campaign ID on restart. Do not manufacture a new approval reference to bypass a stop.
4. Connect `guardedFetch` to the existing application's SDK/image transport inside the local test harness. The SDK receives a dummy key only; the real credential is owned by the guarded transport. Keep `maxRetries: 0`. Invoke existing application auth, request validation, usage and saving logic, not an alternate customer endpoint. Mock injection demonstrates the transport's safety but does not constitute completed live route testing.
5. Dispatch one approved slot at a time. Independently assess each result and stop on unsafe output. There is no built-in live execution command, scheduler or automatic campaign restart in this change.
6. On any uncertain result, stop; do not retry. Recover already persisted responses read-only. Preserve the audit for cost reconciliation. Stop the local harness, revoke the exact QA key through its project API Keys page, verify revocation, remove the approved QA secret file, and retain sanitized evidence. Do not delete campaign records or reset reservations.

GBP2.68 is a hard application reservation limit, NOT a guaranteed provider invoice maximum. Image output has a conservative 6,250-token accounting allowance, not an API-enforced output-token ceiling. Provider price/usage discrepancies, currency conversion, taxes and other callers can affect actual invoices. A bound violation stops future requests but cannot undo a provider charge already incurred. A strict unconditional invoice ceiling is not established here.

## Verification

- Full mocked application suite: 246 passed, including the 12 new QA cases, auth/isolation, subscription checkout, Founder and owner lifetime protections, generation/image contracts, quotas, replay/recovery and cost policy.
- QA tests cover six successes, seventh rejection, duplicate approval, concurrent instances, failed/timeout/uncertain responses, cost-bound violations, restart/lost acknowledgements, account/payload mismatch, oversized allocations, expired/corrupted state, production/Preview refusal and guarded credential loading.
- Existing isolated Neon: 10 scenarios passed using actual row locks and separate pools with mocked providers. Audit records are retained, marked `mock-only-*`. Synthetic profiles and the existing monthly budget/ledger were verified unchanged.
- Application lint, additional QA-module lint, typecheck and production build passed. Typecheck initially found stale generated types referencing a removed historical browser fixture; preserving the old `.next` directory and rebuilding resolved it without source changes.
- Desktop/tablet/mobile interaction checks were not repeated: no UI, application route or styling files changed; earlier PR7 browser evidence remains applicable. This does not claim new live generation validation.
- No paid OpenAI calls, Stripe operations, production changes, firewall modifications, Preview credential activation, merge or deployment.

The historical gate-only GO is superseded by the final database-isolation report. No paid permission has been granted or recorded.
