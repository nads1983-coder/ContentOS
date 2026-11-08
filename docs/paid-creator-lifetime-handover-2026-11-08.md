# PR #22 — Agent 2 implementation and Agent 3 handover

8 November 2026. Branch: `feat/paid-creator-lifetime-2026`. Implementation starts at audited commit `eda02487200fd64c96a20afb61b8056ef6dbd070`; production comparison is `f7229ae4231158fd859ecd54d0aa0fcc05f890aa`.

**Not production-ready. Do not merge, apply production migrations, change live Stripe settings or enable payments.** Both commercial flags remain false. The monthly budget and customer-facing entitlements are unchanged. No live Stripe or paid AI requests were made. All database writes for verification used a disposable local PostgreSQL database.

Read the [original audit](paid-creator-lifetime-audit-2026-11-08.md) and [verification summary](pr22-lifetime-agent2-2026-11-08/verification-summary.json). This implementation closes the reproduced code defects in C1–C3 and adds tests, but C4 is **not resolved as a sellable offer**. Real Stripe integration and independent review remain outstanding.

## Critical blockers: implementation and evidence

| Finding | Change | Evidence / remaining boundary |
| --- | --- | --- |
| C1 refund/activation race | Immutable reversal inbox keyed by Stripe event ID; unmatched events retained. Activation binds PI before consulting the inbox. Reversal and activation share advisory lock 1949019031 and update purchase/profile transactionally. Refunded > disputed > review; success never clears risk. | Real PostgreSQL concurrent submissions in both orders, duplicate refund, stale success, partial → dispute → full refund. No access remains after both handlers finish. This is eventual webhook reconciliation, not an assertion that Stripe and PostgreSQL share a transaction. |
| C2 migration skipped | Journal registers 0004. Runner has 5-second lock and 30-second statement timeouts. Lifetime tables have restricted runtime grants. Raw-SQL ownership documented below. | Actual runner from 0000–0002 journal plus existing 0003 tables; intentionally induced DDL failure rolls back table and journal; successful application twice records only four journal entries. Founder profile and budget opening remain identical. Runtime cannot delete purchases/events or change prices. |
| C3 abandoned slots | Signed expiry handling, authenticated reconciliation endpoint, daily cron declaration and pre-checkout reconciliation. Fresh Stripe reads are required; lost session-save responses are recovered by paginated metadata matching. Immutable POST parameters are stored before the external request. | Real database tests for expiry, replay, lost response, no-POST expiry, uncertain POST retention and slot reuse. Exactly 25 concurrent £99 holds; when all are pending, customer 26 waits. £149 starts only after 25 paid historical early-bird customers. Scheduler and Stripe pagination/expiry must still be verified in sandbox. |
| C4 AI capacity | Added an independent, fail-closed funded-sales check under the allocation lock, protecting the entire incumbent £30 budget. It currently admits **zero new lifetime commitments**, even if someone flips the Checkout flag. | Cost test establishes £34.030100 for one 50-generation maximum-size GPT-5.2 allowance, exceeding the entire £30 shared monthly budget. This prevents an unfunded launch; it does not solve ongoing funding. |

### Capacity decision still required

Approved offer remains £99 for the first 25 customers, £149 thereafter, 50 AI text generations per UTC calendar month, no lifetime AI images, and a one-time payment. Existing higher-tier subscriptions retain their benefits. London calendar months continue to govern monetary spending.

The current 128,000-byte input envelope plus 4,096-token safety margin and 24,000 output tokens reserves at most £0.680602 per call. Fifty successful maximum-size calls cost £34.030100; 25 accounts cost £850.752500/month **before incumbents, images, failed calls or uncertainty holds**. Keeping all £30 of incumbent capacity protected means at least £880.752500 would be required for that successful-call scenario. This is a conservative bound, not a forecast or approved budget increase.

At illustrative 2,000 input + 1,000 output tokens, 25 × 50 would instead account for £26.25/month, leaving only £3.75 for every other obligation. Actual average use is not a guarantee. One-time receipts are not assumed to provide perpetual recurring funding. Unlimited £149 sales cannot be admitted against a fixed finite recurring capacity pool.

Before sales, agree a funded sales ceiling and recurring funding source, or independently validate a lower-cost model/payload envelope with acceptable output quality and enough protected incumbent capacity. Then review the capacity constants and monetary policy together. **Do not simply remove the capacity assertion, reduce 50, change customer terms, reset usage or raise £30.** The global ledger, uncertainty holds, automatic-retry prohibition and £20/£25 alerts remain intact.

Pricing policy still expires at `2026-11-19T00:00:00Z`. No unsupported extension was made. Agent 3 must verify the intended OpenAI model per environment and obtain a fresh, versioned cost review before expiry; the audit observed GPT-4.1 in historical production spend while source defaults to GPT-5.2. Production environment override was not verified.

## High-priority fixes and retained behaviour

- **H1:** Recurring Creator/Lite Checkout is refused for a paid lifetime holder; an explicitly chosen Studio subscription remains allowed. Existing active/trialing/past-due/incomplete subscribers cannot buy lifetime through this route; cancel/resolve billing first. A durable recurring-checkout guard is committed before Stripe POST, using the same global lock as lifetime allocation. Activation quarantines a newly discovered active subscription conflict rather than canceling billing or granting overlapping lifetime access. Old customer-linked open/unpaid subscription sessions are checked as well. This does not automatically refund or cancel an already charged conflicting subscription. Unknown historical/unlinked sessions and lost recurring-create responses need operator reconciliation and sandbox tests in both payment orders.
- **H2:** Lifetime-primary text admission and Dashboard/Studio usage ignore historical images. Text already used during Studio in the same UTC month still counts toward 50; images do not. Existing subscription accounting stays unchanged. Test covers 49 → pending 50 → refusal of 51 and next-month reset.
- **H3:** Studio and server billing refresh Stripe before deciding the lifetime fallback, so delayed renewal webhooks do not hide a paid Studio tier. Outages fall back to the stored/lifetime entitlement. Renewal, cancellation and lifetime image refusal are tested.
- **H4:** Full refunds revoke only paid Creator lifetime fields. Partial refunds enter `review`; dispute created/updated/closed events are durably recorded and quarantine the paid entitlement. Duplicates are idempotent; full refund can supersede dispute. Async failure releases only after a matching fresh terminal unpaid PI check. A won dispute does **not** automatically restore access: a commercial/support reinstatement and repurchase policy is still required. No automatic deletion of reversal evidence or repurchase is provided.
- **H5:** Lifetime success messages require authenticated account/session/purchase binding and persisted entitlement. Pending, active and reversed states use one-time wording. A query flag cannot prove payment. Dashboard shows active Creator lifetime separately from Studio renewal/cancellation; legacy Founder/owner wording and benefits are retained.

Retired Founding 100 remains separate and closed. No coupon, old entitlement source, Founder claim, owner/manual entitlement, workspace, history, subscription ID or existing budget balance is migrated away. Existing subscription cancellations do not remove the new paid lifetime fields. No new AI image entitlement is created.

## Migration ownership and safe upgrade procedure

`lib/db/app-schema.ts` is intentionally a **partial model**. Commercial tables in 0003 and lifetime tables in 0004 are reviewed raw SQL, including conditional unique indexes, grants and constraints. Do not run `drizzle-kit push` or accept generated drops against these externally managed tables. The journal-driven SQL migrator is authoritative for 0004; no generated snapshot is claimed to describe these tables.

0003 was manually applied before this PR and is not in the journal. **Do not add it to the journal and replay it over production, and do not reseed/reset its ledger.** New isolated databases need 0000–0002 first and an explicit separately reviewed 0003 bootstrap before commercial tests. The local test harness reproduces that shape. It does not prove that every production migration-ledger entry/hash is correct; a release operator must compare them before a future authorized migration.

For Agent 3's isolated database only:

1. Inspect the migration journal and `drizzle.__drizzle_migrations`; confirm applied 0000–0002, existing 0003 tables, role `contentos_runtime`, and absence of all three new 0004 tables. If any already exist, stop and compare definitions instead of masking drift with `IF NOT EXISTS`.
2. Snapshot Founder records, profile count and commercial budget/ledger aggregates. Execute the existing `scripts/migrations/migrate-postgres.mjs` with an owner URL supplied via a protected local file. The runner wraps the migration transaction; timeouts cause failure rather than unbounded lock waiting.
3. Verify constraints and runtime grants; rerun the runner and confirm no new journal entry or data changes. Never run the owner migration with runtime credentials.
4. Application rollback should close Checkout, preserve all payment tables/evidence and keep fulfillment/reversal processing on after any sale. Do not roll back by dropping purchase records.

No production migration was performed in this task.

## Reconciliation operation and uncertainty

`GET /api/lifetime/reconcile` requires `Authorization: Bearer <CRON_SECRET>` and returns 401 without the configured secret. With fulfillment disabled it returns a skipped result without database access. `vercel.json` declares a daily 04:00 UTC invocation; no deployment or live secret configuration was performed. Agent 3 must verify authentication and invocation in the isolated environment. Vercel's cron delivery is not a payment ledger and failed invocations must be monitored; processing is idempotent and also runs before new lifetime Checkout. See [Vercel cron management](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs).

Each pass processes at most 50 oldest preparing/open/completed lifetime purchases and rotates their check timestamps. Completed purchases are rechecked so a missed refund webhook can still revoke access. Fresh expired/unpaid sessions without a PI can release a slot; a bound PI must be canceled with zero received and no paid charge. `preparing` older than 23 hours with NULL persisted request parameters proves no POST occurred and may expire atomically. Once request parameters exist, an absent session search result is **not proof of non-payment**: keep the hold. Never retry creation with a new key merely because the old idempotency window elapsed.

Lost-response recovery scans bounded Stripe pages for exact purchase/attempt metadata, then retrieves the expanded session. Multiple matches, unavailable Stripe, scan limits and ambiguous payment state retain the hold. These require operator investigation; they cannot safely be expired on a clock alone. Recurring checkout guards with unknown session IDs are similarly retained; known guards clear only on verified unpaid expiry or ended subscription. A stuck guard affects purchase availability, not existing entitlement access.

Monitor pending attempts older than 24 hours, `review`/`disputed` purchases, unmatched inbox rows, and cron `uncertain` counts. Use purchase/session/PI/event IDs to retrieve Stripe evidence in the correct account and mode. Keep events and purchase records; escalation is preferable to releasing uncertain money or automatically reinstating a disputed entitlement. This task adds durable evidence and reconciliation, not an external paging/alert service or operator reinstatement UI.

## Verification

Node v24.15.0 with the unchanged repository lockfile. Logs are in `docs/pr22-lifetime-agent2-2026-11-08/`.

| Check | Result |
| --- | --- |
| TypeScript | Pass |
| ESLint | Pass |
| Targeted lifetime, generation quota, subscription transition, cancellation and cost tests | 91 pass |
| Disposable PostgreSQL suite | 8 compound checks pass; actual runner, rollback/rerun, permissions, concurrency, recovery, and spending ledger |
| Full suite | 475 total: 463 pass, 10 fail, 2 skip |
| Baseline comparison | Same 10 failure names as production audit; affected hashtag implementation/tests remain unchanged |
| Real Stripe / paid AI / live migration | Not run |

The ten failures remain in `content-quality.test.mjs` (6), `post-format.test.mjs` (3) and `simple-creation.test.mjs` (1), as documented in the original audit. The two unrelated PostgreSQL auth/rate-limit opt-in suites remain skipped. This task adds 13 passing standard tests to the audited PR's 462-test total, plus the separate PostgreSQL suite. Do not suppress the baseline failures to obtain a green full-suite result.

Reproduce standard checks with `npm run typecheck`, `npm run lint`, and `npm test`. For real SQL checks, start a disposable local PostgreSQL server with a role allowed to create a database and run:

```sh
CONTENTOS_LOCAL_POSTGRES_URL=postgres://localhost:5432/postgres node tests/paid-lifetime-postgres-isolated.mjs
```

The script refuses remote hosts and production API-key environment variables, creates a randomly named database, and drops only that database on completion. It needs the installed repository dependencies. Allocator tests inject a capacity override **inside the test process only**; production capacity remains zero. The capacity test exercises the real refusal. PostgreSQL was provided locally for this run by an `embedded-postgres` installation outside the repository; no application dependency was added.

## Agent 3 Stripe sandbox acceptance

Use a separate Stripe sandbox, isolated database and authenticated synthetic users. Do not modify live Stripe or deploy this branch to production. Keep the committed commercial flags closed; any test-only enabled configuration and synthetic capacity override must remain isolated and must not be pushed as launch configuration.

1. Independently review C1–C3 code and rerun the PostgreSQL suite. Check both successful and failed migration paths using the isolated owner/runtime roles.
2. Create real sandbox £99 and £149 sessions; verify exact GBP totals, one-time quantity-one price, actual pinned API response shapes, fresh/existing Customer identity, discounts/tax/adaptive pricing and dynamic payment methods. Confirm £149 is unavailable while an early-bird place is merely awaiting payment.
3. Deliver signed success, async success/failure, expiry, full/partial refund and dispute events before/during/after activation, duplicated and out of order. Drop an acknowledgement and restart processing. Check persisted profile, purchase and inbox, not merely HTTP status. Test won/lost/closed disputes remain quarantined pending reviewed reinstatement policy.
4. Lose the session-creation and save responses. Retry with changed email/redirect configuration and verify the original request/key are reused. Cross 23/24-hour boundaries; verify an actual expired session releases its slot and processing/unknown payment never does. Exercise pagination, multiple matches and worker timeouts; verify the cron secret and a repeat invocation.
5. Exercise recurring Creator before/after lifetime, two open tabs, existing customer-linked and unlinked historical Checkouts, both payment completion orders and Studio upgrades. Verify no silent recurring cancellation or benefit removal; quarantine any paid conflict and document its refund/support resolution.
6. Verify Dashboard, Studio and success page with pending payment, active lifetime, refund, delayed Studio renewal, cancellation and outage. The 50th text works, 51st fails, old images do not reduce text, next UTC month resets, and lifetime-only image requests make zero provider calls.
7. Verify the real provider payload/model and pricing review. Exercise shared text/image monetary holds, alerts and uncertain settlement with mocked provider transport. Obtain the funding decision before considering any real sales. Independent sandbox passes do not resolve C4 by themselves.

## Exact implementation file inventory

| Area | Files |
| --- | --- |
| Payment state and admission | `lib/paid-lifetime-fulfillment.ts`, `lib/paid-lifetime-reservations.ts`, `lib/paid-lifetime-billing-guard.ts`, `lib/paid-lifetime-capacity.ts`, `lib/paid-lifetime-checkout-service.ts`, `lib/paid-lifetime-offer.ts`, `lib/stripe-rest.ts`, `types/saas.ts` |
| Routes / recovery | `app/api/billing/checkout/route.ts`, `app/api/billing/webhook/route.ts`, `app/api/lifetime/checkout/route.ts`, `app/api/lifetime/reconcile/route.ts`, `lib/paid-lifetime-reconciliation.ts`, `vercel.json` |
| Migration | `drizzle/0004_paid_creator_lifetime.sql`, `drizzle/meta/_journal.json`, `scripts/migrations/migrate-postgres.mjs`, `lib/db/app-schema.ts` |
| Entitlement / UI | `lib/generation-reservation.ts`, `lib/server-billing-state.ts`, `lib/paid-lifetime-success.ts`, `app/studio/page.tsx`, `app/dashboard/page.tsx`, `app/success/page.tsx` |
| Tests | `tests/paid-lifetime-postgres-isolated.mjs`, `tests/paid-lifetime-capacity.test.mjs`, `tests/paid-lifetime-routes.test.mjs`, `tests/paid-lifetime-transitions.test.mjs`, `tests/paid-lifetime-fulfillment.test.mjs`, `tests/paid-lifetime-async-webhook.test.mjs`, `tests/paid-lifetime-disabled-route.test.mjs`, `tests/generation-reservation.test.mjs`, `tests/cancellation-display.test.mjs` |
| Handover evidence | This document, original audit, `docs/pr22-lifetime-2026-11-08/`, `docs/pr22-lifetime-agent2-2026-11-08/` |

No changes were needed in the repository usage-count implementation: its existing `eventType` parameter already supports text-only counts, and the affected consumers now request it. No hashtag policy/test files, package dependencies, customer entitlements or live configurations were changed.
