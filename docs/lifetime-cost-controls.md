# Lifetime Access and AI cost controls

Current follow-up: [21 October commercial release report](commercial-release-2026-10-21.md).
It supersedes the adapter/wiring and approval gaps described in this original
19 October preparation record. Historical evidence below is retained.

Status: protected Preview preparation only. The GBP49 checkout is deliberately
disabled in code. No live Stripe price, purchase, paid AI test, or production
commercial migration is authorised by this implementation.

## Already live, separately authorised

Production commit `21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc` retired new
FOUNDING100 acquisition and protected the verified owner's complimentary Pro
Studio entitlement. Deployment `dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs` was READY.
Existing Founder benefits and three outstanding qualifying GBP0 sessions were
preserved. Private identity/backup evidence is outside Git.

This branch does not change the existing generation engine, standard pricing,
Founder processing or owner benefits. Active Stripe Pro Creator GBP9/month and
Pro Studio GBP39/month were read-only verified. No active annual price was found
for these two products; none has been invented or replaced. Existing recurring
prices, including historical prices, have not been modified.

## Proposed offer, not an activated sale

- GBP49 once for eligible Studio access, with no recurring membership charge.
- Recommend **12 non-renewing text credits and 4 non-renewing image credits**.
- One text credit is one successful request: a pack of up to all 14 formats,
  a targeted refinement, or a regeneration. It is not one credit per format.
- One image credit is one successful AI-backed image. Template-only images do
  not record a successful image credit. Uncertain provider attempts remain held.
- Editing, cloud saving, search, history and export remain available after the
  AI allowance ends. No automatic top-ups or credit sales.
- Membership data is separate from recurring, Founder and complimentary access.
  An active recurring plan uses its ordinary allowances; Lifetime credits remain
  reserved for when that plan is no longer active. No subscription is cancelled
  or migrated by purchase fulfillment.

The private Preview presents this proposal as unavailable for purchase. The
public Lifetime route always returns 409 before any Stripe operation. Environment
variables cannot silently enable it. The payment service is prepared and tested
with mocked Stripe evidence, but its production Stripe adapter/webhook wiring
is NOT activated and requires a separately reviewed activation change.

## Pricing and maximum reservations

Reviewed 19 October 2026 against the official model pages:
[GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1),
[GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5).
Text uses USD2/M input tokens and USD8/M output tokens. Image text input uses
USD5/M; image output uses USD32/M. High rectangular image output is bounded at
6,250 tokens (USD0.20), above the published 6,240-token output example.

The quote includes the complete serialized provider payload, including schema,
with a UTF-8-byte input bound plus 4,096 tokens of overhead. Maximum serialized
payload: text 128,000 bytes; image 16,000 bytes. Text output remains 24,000 tokens.
Only reviewed model/configuration combinations are admitted. Oversized requests,
unknown models, tools, stale pricing and unbounded configurations fail BEFORE
provider dispatch. No customer input is silently shortened to fit a cost quote.

Accounting uses integer micro-GBP, USD1 = GBP1 plus 20% contingency, rounding up.
No cached-input discount is assumed. The original production compatibility
evidence used GPT-4.1; no provider model is changed by this branch. If a deployment
uses another model it must receive a reviewed cost policy before paid dispatch.
Policy expires 19 November 2026 and fails closed until reviewed. This is not a
guarantee about tax, the final provider invoice, FX or calls outside this app.

| Allowance | Conservative maximum |
| --- | ---: |
| One maximum-size text request | GBP0.547431 |
| One maximum-size image request | GBP0.360576 |
| Proposed original 50 text + 5 image | GBP29.174430 (not sustainable) |
| Mathematical ceiling 14 text + 5 image | GBP9.466914 (little failure margin) |
| Recommended 12 text + 4 image | GBP8.011476 |
| Plus 2 maximum failed text + 1 failed image | GBP9.466914 |

Caps remain GBP8 text, GBP2 images, GBP10 combined per Lifetime customer.
Known failed calls consume money, not a successful-delivery credit. Unknown
outcomes retain their entire financial reservation and a credit hold. Therefore
no finite credit promise can guarantee unlimited failed attempts within GBP10.
Before selling, approve an honest recovery/refund policy for unfulfillable
remaining credits; do not silently stop behind an undisclosed monetary cap.

## Global cap and commercial limitation

All application-controlled paid calls share GBP30 per Europe/London calendar
month, including owners, Founders and recurring customers. Admission coordinates
across processes using a short database transaction/advisory lock and a locked
account row. Provider calls occur only after commit. Reservation and profile
quota changes commit atomically. Dispatch is a once-only state transition;
pre-midnight reservations are re-admitted into the actual dispatch month.

Exact request IDs remain terminal across restarts. A crashed/lost dispatch
acknowledgement does not permit another paid call. Known usage is reconciled;
missing/malformed usage retains the full reserve. A provider-bound violation
suspends all further admissions until investigation. Final successful usage,
history persistence and delivery-credit settlement share one transaction.

The GBP20/GBP25 warning events are durable and deduplicated. They are visible
only to configured administrators at `/admin/ai-budget`; no customer email or
external notification is sent. An operator must monitor this page. Customer
interfaces show credits and temporary-capacity notices, not internal budgets.

At maximum-size bounds GBP30 funds only 54 text requests, or three complete
12+4 Lifetime allowances, before any existing customers' usage. A previous
single successful text sample would price at GBP0.034428 under this conservative
FX policy (about 871 such calls, without images). That ONE sample is not a
reliable demand forecast. A Pro Studio allowance can exceed the shared cap at
maximum usage; existing Founder demand also competes for it. Do not activate
Lifetime sales until a sustainable, disclosed capacity/service policy is
approved. Do not increase the GBP30 cap automatically.

GBP49 minus the full GBP10 provider allocation leaves GBP39 before payment
fees, tax, infrastructure, support and refunds. This is not net profit.

## Payment preparation

Mock-tested one-time orchestration validates the authoritative GBP49 price,
exact line item/quantity, currency, mode, payment status, customer, account and
attempt binding, and current charge/refund/dispute evidence. A success URL
grants nothing. Account-scoped durable attempts and Stripe idempotency reuse the
same checkout after concurrent requests or crashes. Uncertain attempts older
than Stripe's idempotency window require operator reconciliation, not recreation.
Expired attempts retain history before a new explicit attempt. Paid accounts
cannot be silently converted. Exactly-once fulfillment merges only the new
membership field, and retains old usage, customer and subscription fields.

Refund/dispute events suspend only the new membership. Reordered completions
cannot regrant credits after a recorded reversal. Dispute-won restoration and
partial-refund policy require operator review; no automatic reinstatement is
assumed. Before activation, wire this service to the existing signature-verified
webhook, authoritative current Stripe reads and approved price configuration;
repeat the mocked route tests for that wiring. Do not claim live payment
fulfillment has been tested or that merely enabling a flag completes activation.

## Migration and rollback (not applied to production)

1. Obtain approval for the precise deployment and customer-facing service terms.
2. Back up profiles and existing billing state. Confirm current production SHA.
3. Apply `drizzle/0003_commercial_spending.sql` transactionally as the migration
   role, including its runtime grants. It adds tables, not customer mutations.
4. Privately reconcile month-to-date application provider usage and uncertain
   historical requests. Set `ai_budget_configuration` with the London start
   month, conservative opening micro-GBP and a private evidence reference. If
   unknown, reserve the full GBP30 rather than start from zero; new paid calls
   then remain unavailable until properly reconciled. Runtime cannot reset this
   opening balance, erase audit rows or modify reserved maxima.
5. Confirm production model, pricing date and payload tests; verify all provider
   routes pass through admission. Deploy only after reviewing grant/route tests.
6. Verify unauthorised calls and new Founder claims refuse without provider work;
   verify owner/Founder/recurring entitlements and non-AI workspace access. No
   paid generation is a smoke test unless separately authorised.
7. Keep GBP49 checkout disabled until separate credit, terms, fulfillment and
   activation approval. Do not create a live Stripe price in this task.

Rollback: do not drop financial/audit tables or release uncertain reservations.
First suspend admission via the reviewed configuration while retaining workspace
access. A rollback to an older pre-ledger application would bypass the cap and
must NOT be promoted with paid-provider credentials enabled. Prefer a forward
fix or an owner-approved AI-disabled rollback. Preserve old configuration,
production deployment ID and all customer data; reverse no entitlements.

## Release boundary

Production cost safeguards and Lifetime sales remain unactivated. Required
owner decisions: final 12/4 allowance; recovery/refund and capacity terms;
operational warning/pricing-review ownership; conservative opening balance;
then the exact reviewed migration/deployment. Live GBP49 price creation and
checkout/webhook activation need separate approval and adapter validation.

No paid provider calls, real payments, new services, API keys or credit purchases
are part of this work. Codex monetary usage and the owner's overall GBP60 budget
cannot be accurately measured or enforced by this repository; no claim is made
that those charges are capped by the AI spending ledger.

## Executed verification

19 October 2026, application commit `b98d4b4def01275a93408ef7cf42d44c8debd16a`:

- `npm test`: 202 passed, zero failures.
- `npm run typecheck`, `npm run lint`, `npm run build -- --webpack`,
  `git diff --check`: passed. The protected Vercel build also passed.
- `npm audit --omit=dev --audit-level=high`: zero production vulnerabilities.
- `tests/commercial-ledger-isolated.mjs`: 14 scenarios passed on the existing
  isolated Neon branch, using only synthetic account records. Includes
  independent-instance concurrency, sublimits, global exhaustion, exactly-once
  replay and history, non-renewing credits, uncertain calls, DB rollback,
  London DST/month transfer, durable warnings, suspension on invalid provider
  usage, mocked one-time payment/refund/dispute processing, and least-privilege
  runtime grants. Both actual AI routes were executed with mocked providers.
- `tests/owner-entitlement-isolated.mjs`: concurrent billing events preserve the
  synthetic permanent owner entitlement and unrelated profile fields.
- `tests/commercial-preview-browser.mjs`: protected SSO, disabled purchase,
  Lifetime login/balances, admin-data refusal, real server-side cap exhaustion
  without a reservation, restored capacity, 14-format fixture delivery, replay,
  persisted history and responsive checks all passed.
- Existing `tests/premium-browser.mjs`: generation/refinement fixtures, edit,
  undo, text export, save, failure recovery, actual template-image rendering,
  independent-device retrieval and stale-account refusal all passed.
- Both browser suites used 1440px desktop, 768px tablet and 390px mobile widths;
  no horizontal overflow or JavaScript exceptions. Representative screenshots
  were visually inspected. Private reports/screenshots are outside Git.
- No real OpenAI calls, Stripe payments or customer communications were made.
  Mocked delivery is not evidence of a new live AI or payment test.

Protected review URL:
https://content-kktqrq2tk-nads1983-9570s-projects.vercel.app/pricing

Deployment `dpl_B6qC4NoBTv4aYeB8ge2rEv39FGWt`, READY, Vercel Authentication
enabled. Isolated database explicitly configured; OpenAI/Stripe/Resend
credentials blank. Draft PR: https://github.com/nads1983-coder/ContentOS/pull/5
Branch: `feat/lifetime-access-cost-controls`.

After these checks, a read-only deployment lookup confirmed production is still
`21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc`, deployment
`dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs`, READY. No commercial migration or commercial
code was deployed to production. Founder retirement and complimentary owner
Premium remain the only separately authorised production changes from this task.

Verdict: cost-control Preview is ready for review, **not ready to sell Lifetime**.
The material commercial blocker is a coherent capacity/recovery/refund policy
under the fixed GBP30 shared cap. The production payment adapter and signed
webhook connection also remain intentionally unwired while checkout is disabled;
they need focused implementation/validation against the subsequently approved
price, not merely a flag change. Do not describe this as a completed live £49
purchase journey. No further budget, paid benchmark or broad redesign is needed
to review the current proposal.
