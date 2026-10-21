# Subscription-only release candidate: 21 October 2026

## Scope and current status

**BLOCKED - EXACT OWNER ACTION REQUIRED.** The application checks below remain
valid. The [financial closure update](financial-release-closure-2026-10-21.md)
resolves all three legacy reservations. The authorized configuration-only Preview
confirmed `gpt-image-1`, which this candidate currently rejects: a focused
cost-policy correction and bounded shared-project cutover exposure remain
outstanding. The temporary probe was deleted. No production approval
or deployment is implied by the earlier conditional technical readiness.

Application commit: `e60d8a1d442892a9dbee6f9f5b5efbc54fae7c50`.
Subsequent release-evidence commit changes only this report and a browser-test
selector, not deployed application code.

Protected Preview: https://content-d4mdh4vt4-nads1983-9570s-projects.vercel.app/pricing
(`dpl_UZbDtauhDsU4ych6VooG7mBktsCE`, READY, Vercel Authentication). It uses
only the existing isolated Neon branch and synthetic accounts/providers. Paid
AI, Stripe and email credentials are absent. It must not be promoted to production.

The owner cancelled the proposed GBP49 Lifetime Access membership. PR #5 now
contains shared AI spending controls, not a new commercial product. Existing
monthly/annual Stripe prices and billing intervals are unchanged. No new
Lifetime price, checkout, marketing, credit balance or activation flag remains.

Production was read-only verified at `21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc`,
deployment `dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs`, READY. Production has no proposed
Lifetime purchase table, no `lifetime_access` profile fields and no shared spend
ledger yet. Aggregate checks found 14 Founder profiles and one active
complimentary owner Premium profile. No customer identifiers are published.

## Changes

- Removed proposed Lifetime pricing card, terms, checkout route, Stripe adapter,
  fulfillment/reversal handlers, sales-capacity logic and 12/4 nonrenewing credits.
- Restored pricing, Studio/dashboard, account quotas and types to their existing
  production subscription implementation. Generation prompts and the working
  generation engine are unchanged; experimental PR #3 validation is not included.
- Removed Lifetime sub-budgets and balance queries from the financial ledger.
  All authenticated accounts retain their existing normal plan quotas, in
  addition to the shared GBP30 London-calendar-month provider-cost ceiling.
- The pending `0003_commercial_spending.sql` creates only budget configuration,
  spend requests and private warning records. No Lifetime purchase/event tables,
  Lifetime columns, profile updates, data deletion or schema drops.
- Historical Founder/owner entitlement handling and valid outstanding Founder
  commitments remain intact. New FOUNDING100 claims remain retired. Unknown
  historical profile fields survive full-document locked writes.
- Retained shared Stripe signature freshness/rotation checks and invalid-event
  parsing, with dedicated regressions. No recurring billing adapter changes.
- Historical commercial reports and audits remain intact, clearly superseded.
  Earlier isolated proposal tables/records were not dropped. Only the isolated
  ledger's legacy required column received a default to permit shared-only
  inserts; the new production migration has no such column. Fresh migration
  execution was separately verified in a transactionally rolled-back test schema.

## Retained safeguards

Atomic cross-instance advisory-lock admission and account row locks protect the
GBP30 cap and quotas. No provider network call is held inside a transaction.
Request/account/kind identity and payload fingerprint prevent duplicate dispatch.
Uncertain calls retain the full reservation; no automatic provider retries.
Known usage is reconciled conservatively. Pre-dispatch failures release money;
failed dispatched calls do not count as successful customer generations. Final
history/usage and financial delivery commit together. Bound violations suspend
further admission. London month rollover requires re-admission before dispatch.

GBP20/25 warnings are durable, deduplicated and private at `/admin/ai-budget`;
they are not customer communications or automated emails. Runtime grants cannot
reset the opening balance, delete audit rows or reprice reserved maxima.

Existing reviewed pricing/payload bounds are unchanged: maximum text reservation
GBP0.547431; image GBP0.360576. Accounting uses USD1=GBP1 plus20% and integer
rounding. This is an application estimate, not an invoice/FX/tax guarantee or a
limit on other applications sharing the provider project. The pricing policy
expires on 19 November 2026 and fails closed pending review. No paid availability
or quality probe was run. The global cap can temporarily stop generation for
subscribers, Founder and owner accounts alike; editing/saving/export remain usable.

## Validation

- `npm test`: 201 passed, including actual recurring checkout orchestration,
  forged Lifetime-plan rejection, Founder retirement and entitlement preservation,
  authenticated account isolation, generation/refinement, images and history.
- Isolated Neon spending suite: 12 scenarios passed, including fresh shared-only
  migration, concurrent final-budget admission, uncertainty, idempotency, rollback,
  GBP20/25 warnings, rollover, full14-format mocked text delivery and exactly-once
  persistence, mocked image success/failure, and restrictive runtime grants.
- Isolated owner entitlement: six concurrent cancellation/past-due writes leave
  the complete synthetic profile, historical identifiers, history and usage intact.
- Typecheck, lint, production webpack build and `git diff --check` passed.
  Initial typecheck found stale Next generated declarations for removed routes;
  rebuilding regenerated them and the standalone typecheck then passed.
- Production dependency audit: zero vulnerabilities. Dependencies are unchanged;
  previously documented development-only advisories are not silently waived.
- Protected Preview browser checks passed at1440/768/390: anonymous access
  blocked by SSO, removed Lifetime checkout404, recurring pricing and subscriber
  dashboard, private budget dashboard denied to ordinary accounts, capacity503
  before reservation, restored capacity14-format mock delivery, durable once-only
  spend row, duplicate replay and cloud history. Zero page errors or overflow.
  Initial browser locator expected a heading without its existing price suffix;
  the selector was corrected, with no application change, and the suite passed.
- Pricing, Studio/dashboard components, pricing definitions, quota functions and
  entitlement helpers now match production byte-for-byte. Existing broader
  editing/undo/export/multi-device evidence is retained for these unchanged paths.
- No real AI calls, Stripe payments, customer subscription changes or production
  writes. Mock provider results do not prove fresh live-provider performance.

## Exact production prerequisites and rollout (not executed)

1. Reconcile current London-month existing-project provider spend, including
   pending/uncertain requests before cutover. Obtain an approved conservative
   opening micro-GBP amount and private evidence reference. Never assume zero.
   If actual spend exceedsGBP30, start suspended rather than misstate spend.
2. Obtain explicit owner approval for this subscription-only commit, the shared
   migration, reconciled opening record and deployment. No Lifetime-product,
   one-time-price, credit allocation or new Stripe configuration approval remains.
3. Back up/recoverably snapshot the relevant schema. Apply migration0003 once,
   verify constraints/grants, then insert the approved opening configuration in
   an audited transaction. Preserve all existing records. Ensure no old in-flight
   production requests are omitted from cutover accounting.
4. Stage a production-target build with fixture mode off and existing production
   secrets; never promote the synthetic Preview or use its database. Verify auth,
   billing/access, removed routes and configuration without paid AI/payment calls.
   Promote only after explicit approval. Monitor private warnings, uncertain holds,
   generation503s and Stripe webhook responses. Existing prices remain unchanged.
5. Preferred emergency action: suspend provider admission through audited budget
   configuration while keeping workspaces available. Retain every ledger/audit row.
   Code rollback to the prior production build requires owner approval because it
   lacks the cap; reconcile all intervening spend before restoring guarded service.
   Never reset budgets, delete history, alter subscriptions or reactivate Founder.

Remaining production dependencies: correct and validate cost accounting for the
confirmed `gpt-image-1` override, and a finite cutover allowance for
unreported/shared-project activity,
then explicit migration/opening-balance/deployment approval. The three historical
reservations are financially reconciled and require no extra charge. PR #5 remains
unmerged. Raw financial evidence is stored privately outside Git.
