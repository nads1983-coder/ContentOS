# Commercial release candidate: 21 October 2026

> SUPERSEDED: the owner cancelled the proposed GBP49 Lifetime product on
> 21 October 2026. Its code, purchase route, credits and proposed tables have
> been removed from PR #5. This document is historical evidence, NOT an active
> offer, deployment instruction or approval request. Use
> [Subscription-only release](subscription-only-release-2026-10-21.md) instead.

## Verdict

**BLOCKED — opening provider spend and customer commitments are not reconciled.**
The focused implementation is complete and testable; public Lifetime sales must
remain closed. This is not approval to merge PR #5, migrate production, change
prices, or deploy. No paid AI call, live payment, refund, customer communication,
production write or Founder inventory change was performed.

Implementation commit: `346fd4db1d9e711f1873d67a3eefd9c02bfe98a2`.
The later commit changes only test wiring and this release evidence.

Final protected Preview: https://content-8d3ak8abe-nads1983-9570s-projects.vercel.app/pricing
(`dpl_6qzmnRiBM3urPFvLyZr7yq6gLDTF`, READY, Vercel Authentication).
Production, Stripe, email and OpenAI credentials are not used by this Preview;
it uses the existing isolated Neon branch and synthetic fixtures only.

## Implemented

- Existing Stripe REST transport/API version retained; authoritative GBP49,
  one-time price, one item, quantity one, GBP, payment/customer/account/attempt
  binding. No promotion codes, coupons or recurring subscription creation.
- Durable per-account Checkout attempts, stable Stripe idempotency and open
  session reuse. Unknown creates beyond 23 hours require reconciliation.
  Stripe customer/subscription checks prevent purchasing over active billing;
  ambiguous customer records fail closed rather than attaching by email.
- Actual checkout route wired behind two closed controls: checkout disabled,
  initial sales limit zero. Origin/authentication/account-header checks precede
  checkout creation. Client-supplied prices and account IDs are not authoritative.
- New attempts run capacity admission inside the existing global database lock.
  Initial sales count, current month use, pending/full remaining Lifetime
  commitments and a proposed GBP10 existing-customer reserve are checked before
  allocating an attempt. Existing open attempts reuse their commitment.
- Signed webhook handles completed/async-success, expiration/failed async,
  refund and dispute events. Unpaid delayed payments remain pending. Expiration
  uses fresh Stripe state; a stale event cannot expire a paid purchase. A failed
  async session that is not definitively expired stays blocked for reconciliation,
  never automatically retried or turned into a second charge.
- Invalid payment evidence: acknowledge HTTP200 without entitlement. Database,
  Stripe, configuration and inconsistent async-success evidence: HTTP500, retry.
  Invalid/missing/stale signatures: HTTP400 before transport/database work.
  Five-minute signing timestamp tolerance and multiple rotation signatures.
- Payment entitlement, credits and purchase status commit atomically. An injected
  failure after the profile update rolls the whole transaction back. Duplicate
  delivery does not allocate new credits. No network inside a database transaction.
- Current refund/dispute evidence is bound to the actual account, attempt,
  Checkout and PaymentIntent. Partial/full refunds suspend only the new Lifetime
  membership; partial refunds need operator settlement review. Won/closed-warning
  disputes restore it without resetting balances. Refund records prevent automatic
  restoration. Optimistic purchase-version checking rejects stale in-flight
  reconciliation with a retryable failure. Existing billing fields are untouched.
- Draft customer-facing `/lifetime-terms` and a disabled Preview pricing card.
  No reintroduction of the experimental PR #3 validation system.

## Credits and costs

Owner-approved implementation: GBP49 once; 12 text and 4 image credits issued
once, never renewed; GBP10 provider allowance split GBP8 text / GBP2 images.
One text credit covers a successful pack, refinement or regeneration request.

| Bound | Conservative GBP |
| --- | ---: |
| Maximum text request | 0.547431 |
| Maximum image request | 0.360576 |
| 12 successful text requests | 6.569172 |
| 4 successful image requests | 1.442304 |
| Complete 12+4 allowance | 8.011476 |
| Allowance plus two failed text and one failed image call | 9.466914 |

Each sublimit also fits: 14 text calls cost at most GBP7.664034; five images
GBP1.802880. Repeated additional failures can exhaust the monetary allowance
before delivery of all credits. Terms disclose review/delivery/refund remedies;
no silent credit forfeiture, unlimited failure promise or automatic top-up.

Rechecked official model pages on 21 October: GPT-4.1 USD2/M input, USD8/M output;
GPT Image 1.5 text input USD5/M, image output USD32/M. Exact full-payload bounds
remain 128000/16000 UTF-8 bytes plus 4096 input tokens, 24000/6250 output tokens.
Accounting uses USD1=GBP1 plus 20%, rounded up in integer micro-GBP. This is a
conservative application estimate, NOT the final invoice, VAT or actual FX.
Calls outside the ledger/project, taxes and exchange movements are not controlled
by the GBP30 application cap. Pricing fails closed after 19 November 2026.
The official model pages now mark both existing models deprecated; provider
availability/retirement timing needs operational review before activation. No model
was replaced and no paid availability probe was made.

Sources: [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1),
[GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5),
[Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment),
[Stripe webhooks](https://docs.stripe.com/webhooks).

## Opening budget and initial sales

Read-only production query confirms the new cost ledger does NOT exist yet.
Previous benchmark reservations and successful-generation history are not a
complete October provider invoice: they omit/overlap actual costs and may not
capture failed requests. Available connectors do not provide authenticated
OpenAI organization Costs/Usage data. No new key was requested or created.

**Verified additional sale capacity today: zero.** Unknown opening spend is not
zero. Do not initialize production with the isolated fixture's zero opening.

Obtain the existing OpenAI project's itemized cost/usage export from
`2026-09-30T23:00:00Z` (1 October 00:00 Europe/London) through the release cutover,
plus unmatched/uncertain requests and activity after the export. Reconcile
against prior immutable audits without counting a reservation and its settled
cost twice. Include all activity sharing the approved GBP30 budget. If costs
cannot be fully reconciled, do not activate commercial generation or sales.

Capacity formula (integer micro-GBP, tested):

`floor(max(0, 30 - opening - current holds/costs - outstanding Lifetime promises - protected existing-customer reserve) / 10)`

Current holds include uncertain calls. Outstanding promises are remaining GBP10
allocations for creating/open/paid/disputed purchases, net of prior accounted
Lifetime costs. Avoid double-counting those settled amounts as future promises.
Propose **one initial sale**, only if the reconciled formula permits it and the
owner approves the GBP10 reserve for existing customers. The reserve is a
conservative proposal, not a verified demand forecast. If existing customers
need more, increase their reserve and sell zero. Never assume three sales are safe.
The limit counts paid/revoked/disputed commitments and does not reset monthly.
Sales admission reserves capacity conceptually; it does not guarantee immediate
generation priority over existing accounts. The global generation cap still
applies; monitor service delays and honor refund remedies.

## Customer terms awaiting approval

`/lifetime-terms` is noindex and explicitly draft/not for sale. It covers credit
consumption, nonrenewal, global availability, saved work access, known failed
costs, uncertainty holds, exhausted allowance, and no uninterrupted-service promise.
Proposed voluntary policy: full GBP49 refund on cancellation within 14 days;
afterward, inability to supply unused credits within reasonable time gives at
least a proportional refund by undelivered credits out of 16, without limiting
greater statutory remedies. Core-service failure can require a greater/full
refund. Partial refunds require support review; dispute recovery preserves usage.

Before sales: owner must approve this policy and final seller identity/business
address, tax-inclusive GBP49 treatment, support details and a durable contract
confirmation/cancellation process. Stripe terms-consent setting is included in
prepared checkout; its account terms URL must point to the approved terms.
This technical draft is not legal sign-off. Sources reviewed:
[UK distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses),
[refund obligations](https://www.gov.uk/accepting-returns-and-giving-refunds).

## Production protections verified read-only

- Production remains `21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc`, READY deployment
  `dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs`.
- `/founder` returns200 with closed-offer copy. Stripe FOUNDING100 inactive;
  14 redemptions/max100 unchanged. No checkout was created for inspection.
- 14 Founder profiles remain; one matching registered owner profile has active
  complimentary Pro Studio and `owner_complimentary_lifetime`. No identity data
  is included here. Separate isolated concurrent billing tests preserve the
  owner's whole profile/history. Founder regressions are included in unit tests.
- Standard recurring price configuration, generation engine, image implementation,
  studio editing, cloud persistence and saved content code are unchanged this turn.

## Validation

- `npm test`: **213 passed** after adapting the disabled-route test's mocks to
  the newly wired imports; its no-auth/no-payment assertions were strengthened.
- Focused Lifetime unit group:14 passed.
- Isolated `commercial-ledger-isolated.mjs`:14 scenarios passed (GBP10/30 and
  sublimits, concurrent global admission, uncertainty, idempotency, London month
  rollover, warning deduplication, 14-format mock generation/persistence, images,
  role permissions and payment/refund regressions).
- Isolated `lifetime-webhook-isolated.mjs`: actual HTTP signature handling,
  adapter and real Neon transaction tested with mocked Stripe; same-account
  concurrency, second-account sales-limit refusal, pending payment, rollback/500,
  retry, once-only credits, partial refund, current dispute recovery, stale
  snapshot rejection and account/history isolation passed. A SQL alias error
  found during this test was corrected and rerun successfully.
- Isolated owner test: six concurrent billing updates preserve full profile.
- Typecheck, lint, production webpack build, `git diff --check`: passed.
- Production dependency audit: zero vulnerabilities. Full audit: seven high
  development findings through `braces` nesting DoS in ESLint/Tailwind tooling.
  No production dependency path. Build only trusted source/glob configuration;
  do not run untrusted PR build scripts with secrets. npm suggests incompatible
  Tailwind4 or Next ESLint downgrade, so no forced major change was made.
- Local dependency manifests became truncated inside synced Documents, causing
  a failed run and stalled build. Preserved/moved checkout, reinstalled unchanged
  lockfile outside Documents; full suite/build then passed. No source reset.
- Protected Preview checks: SSO denies anonymous users, purchase returns409,
  terms and synthetic Lifetime login/Studio work at1440/768/390 without overflow
  or JS page errors. Existing broader editing/undo/export/account-switch and
  multi-device evidence from19 October is reused for unchanged Studio code.
- Final Preview additionally reran `commercial-preview-browser.mjs`: a full
  shared budget refuses before reservation, restored isolated capacity delivers
  all14 fixture formats once, duplicate request replays the same pack, one
  durable zero-cost delivery exists, account-scoped cloud history persists, and
  an ordinary member is denied the private financial dashboard. Both final
  browser reports have zero page errors and zero real AI/Stripe calls.
- No claim of live Stripe checkout/refund execution or new real-provider quality
  evidence. All new payment/provider test responses are synthetic.

## Exact release and rollback sequence (NOT EXECUTED)

1. Resolve opening spend and customer terms. Reverify current production identity,
   provider model availability, Stripe recurring prices, retired Founder code and
   owner/Founder protections. Approve initial sales allocation separately.
2. Obtain explicit approval for the candidate, production migration, reconciled
   opening record and protected rollout. Back up affected schemas/profiles and
   retain a Neon recovery point under existing infrastructure policy.
3. Apply only `drizzle/0003_commercial_spending.sql` once; verify constraints,
   runtime grants and no duplicate pre-existing tables. No extra migration is
   introduced by this follow-up. Insert the approved nonzero/zero opening amount
   only from reconciled evidence, with London month, approval time and private
   evidence reference. Never copy fixture configuration or reset existing spend.
4. Stage a PRODUCTION-target deployment without alias promotion, using production
   connections and fixture mode off. Keep checkout false and sales limit0.
   Test non-chargeable authentication/access, pricing, balances and webhook
   signature rejection. Do not promote this Preview with its isolated credentials.
5. Promote only the separately authorised staged build, verify live deployment,
   account boundaries and existing entitlements. Monitor admin budget/uncertainty
   states and Stripe delivery failures. Preserve logs; no paid smoke calls.
6. Only with separate final commercial activation approval: configure the exact
   inactive/reviewed GBP49 one-time Price, mode, terms URL and required existing
   webhook event subscriptions. Verify tax treatment and customer communications
   process. Make an explicit reviewed activation change enabling checkout and
   at most one approved initial sale; do not alter recurring prices. Do not enable
   sales if terms, funding or operational evidence remains incomplete.
7. Rollback before any new Lifetime purchase: the existing21ff2b8 deployment is
   a candidate only with owner approval, acknowledging it lacks these cost guards.
   After any Lifetime purchase, roll back only to the tested commercial build with
   checkout closed: it must retain new entitlement/ledger support. Do not roll back
   to an application that ignores paid Lifetime access. If needed, suspend new
   provider admissions via the audited budget configuration while keeping saved
   content accessible. Never drop ledger/purchase/event tables, replay payments,
   reset opening spend or reactivate Founder as rollback actions.

The minimum owner inputs are the existing-project provider spend export and final
business/terms/tax decisions. Production and price activation remain separate
explicit approvals, not implied by this implementation request.
