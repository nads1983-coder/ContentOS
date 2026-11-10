# PR #22 — paid Creator lifetime technical audit

Audit date: 8 November 2026 (Europe/London). **Recommendation: do not merge, deploy, or enable payments.** This is an audit, not an implementation change.

Repository: nads1983-coder/ContentOS. [Draft PR #22](https://github.com/nads1983-coder/ContentOS/pull/22), branch `feat/paid-creator-lifetime-2026`.

Full audit also posted as a [PR conversation comment](https://github.com/nads1983-coder/ContentOS/pull/22#issuecomment-6726409138) for the next agent. Local evidence is documentation only and has not been committed or pushed.

- Reviewed head: `eda02487200fd64c96a20afb61b8056ef6dbd070`.
- Production/base: `f7229ae4231158fd859ecd54d0aa0fcc05f890aa` on `main`.
- All **28 changed files**, 1,118 additions and 17 deletions reviewed, together with the surrounding subscription, generation, image, migration and spending paths.
- Vercel read-only lookup of `getcontentos.co` confirmed production deployment `dpl_2pFutFE74y4wwza577juvxxCsEAA` uses that exact base commit. Head/base were rechecked before handoff.
- Both `checkoutEnabled` and `fulfillmentEnabled` remain false. No application code, existing tests, database data/schema, payment configuration, or deployment was changed by this audit. Only audit documents/evidence were created.

The approved offer remains **£99 for the first 25 customers, £149 thereafter, 50 AI text generations per month, zero AI images, and one payment with no recurring subscription**. Retired Founding 100 is separate. “First 25 reserved slots” in the PR description is not equivalent to the approved wording.

## Critical launch blockers

These are release blockers, not claims of an active public exploit while the new flow is disabled.

### C1 — Refund/activation race can leave refunded access active (P1; new)

**Files:** `app/api/billing/webhook/route.ts:99–104,219–237`; `lib/paid-lifetime-fulfillment.ts:23–29,37–75`; payment persistence in `drizzle/0004_paid_creator_lifetime.sql`.

The PaymentIntent ID is stored only when activation commits. The refund/dispute webhook first performs an unlocked lookup by that ID; no match returns HTTP 200. Meanwhile, activation relies on a Stripe payment snapshot fetched before its database transaction.

Reproduced using the actual webhook and fulfillment code with an in-memory database transport:

1. Completion handler retrieves a succeeded, unrefunded PaymentIntent.
2. A full refund occurs before activation commits.
3. Refund webhook finds no stored PaymentIntent and acknowledges 200.
4. Activation commits the earlier snapshot and grants active lifetime access.

The same ordering is possible for a dispute. The transaction lock protects database writes, but not the preliminary ownership lookup or the earlier provider snapshot. Stripe retries do not repair an event already acknowledged successfully. A later completion replay retrieves refunded state and returns 503; it does not revoke the active entitlement.

**Required correction:** persist/reconcile payment-to-purchase identity before activation; durably retain relevant unmatched reversal events; serialize activation and reversal decisions with terminal reversal state taking precedence; add reconciliation for ambiguous events. Do not merely move a Stripe read inside the existing transaction and assume event ordering is solved.

**Acceptance:** deterministic interleavings before/after the provider read, lookup, lock and commit must end without refunded/disputed paid access; delivery order, duplicate events and process restarts must not change the final result.

### C2 — Normal migrations skip the new table (P1; new, with inherited migration debt)

**Files:** `drizzle/0004_paid_creator_lifetime.sql`; `drizzle/meta/_journal.json`; `scripts/migrations/migrate-postgres.mjs`; `lib/db/app-schema.ts`.

The new SQL file is absent from the Drizzle journal and schema model. The repository migration script calls Drizzle's journal-driven migrator. Running its actual `readMigrationFiles` locally loads only **three migrations** and does not load the lifetime table. A read-only production query confirms `paid_creator_lifetime_purchases` does not exist.

The older `0003_commercial_spending.sql` is also absent from the journal, although its tables already exist in production. That is inherited drift: blindly registering and replaying 0003 could attempt to recreate existing tables and must not reset the £30 ledger.

**Required correction:** establish the authoritative migration/baselining procedure, register 0004 correctly, and keep the managed schema/snapshots aligned or explicitly document externally managed tables. Provide a reproducible upgrade path from the actual production schema. Test as migration owner and as `contentos_runtime`.

The SQL itself is additive: it does not modify Founder claims or backfill profiles. Its foreign key, price/slot checks, unique session/intent keys and column-scoped UPDATE grant are useful. The remaining safety gap is execution evidence: no real PostgreSQL application, rollback, grants or concurrent transaction test for this table was performed in this audit. Future migration execution should be transactional, bounded by lock/statement timeouts, and preserve purchase records on application rollback.

### C3 — Abandoned reservations can permanently consume the £99 allocation (P1; new)

**Files:** `lib/paid-lifetime-reservations.ts:81–123`; `lib/paid-lifetime-checkout-service.ts:24–51`; `app/api/billing/webhook/route.ts:78–106`; `lib/paid-lifetime-offer.ts:16–30`; `drizzle/0004_paid_creator_lifetime.sql:32–44`.

Allocation counts `preparing`, `open`, `completed`, `refunded` and `disputed` rows. It never checks other buyers' expired Stripe sessions. The only open-session expiry recovery is when the *same buyer* starts checkout again. There is no `checkout.session.expired` handler or reconciliation worker. A failed/uncertain creation can leave `preparing` indefinitely; after 23 hours the service only tells the buyer to reconcile.

Thus 25 abandoned sessions can leave the next actual paying customer quoted £149 even after those sessions expire, with zero completed sales. Authenticated users can also consume places without paying. Rate limiting alone would not fix the state leak.

**Required correction:** reconcile abandoned/expired attempts against Stripe, process expiry idempotently, and provide bounded recovery for unconfirmed POSTs without creating a second charge. Define truthful temporary-reservation semantics for simultaneous buyers; do not silently replace “first 25 customers” with permanent checkout-attempt allocation.

Refunded/disputed sales currently retain their slots and cannot repurchase. Retaining a place after an actual purchase can be consistent with “first 25 customers ever”; recycling it is a commercial policy decision. However, `lifetimePriceForCompletedSales` explicitly says “completed, non-reversed” and its tests exercise a function the checkout allocator does not use. Align the helper, actual allocator, refund policy and displayed availability.

### C4 — The 50/month promise has no capacity plan within the shared £30 cap (release decision; new obligation, inherited cap)

**Files:** `lib/paid-lifetime-offer.ts`; `lib/paid-lifetime-reservations.ts`; `lib/ai-cost.ts`; `lib/commercial-ledger.ts`; customer-facing lifetime offer/terms and release documentation (not yet implemented).

The cap correctly blocks provider spending when funds are unavailable, but checkout never considers outstanding monthly obligations or protects existing customers' capacity. It permits an unbounded number of £149 lifetime sales.

Illustratively, at 2,000 input + 1,000 output tokens per GPT-5.2 request, the application's conservative accounting is £0.021/request: 25 × 50 requests accounts for £26.25 before existing users, images, failures or uncertainty holds. At 2,000 + 3,000 tokens it is £68.25. These are arithmetic scenarios, not measured workload forecasts. The cap prevents excess admitted application spend; it cannot guarantee delivery of every sold allowance.

**Required correction before sales:** reconcile expected and worst-case demand, incumbent entitlements and the fixed budget with the approved offer. Document and implement the agreed capacity/sales policy. Do not silently raise £30, reduce 50 text generations, or consume protected existing benefits to make the offer fit.

## High-priority fixes

### H1 — Existing subscription checkout can charge lifetime holders again (P1; new integration gap)

**Files:** `app/api/billing/checkout/route.ts:88–97,194–202`; `app/api/lifetime/checkout/route.ts:27–44`; `lib/paid-lifetime-fulfillment.ts:64–72`; relevant checkout tests.

The recurring route rejects only legacy `hasLifetimeEntitlement`, not the new paid Creator lifetime entitlement. Directly posting `{plan:"pro_creator"}` for an active lifetime holder with no recurring subscription returns 200 and creates a recurring Checkout. An audit probe reproduced this using the actual route. Hiding the Creator button is insufficient.

The reverse direction checks subscription state only before creating lifetime Checkout. A recurring checkout in another tab, or an older unexpired subscription session, can still complete before the lifetime payment. Activation does not recheck this conflict. Existing Studio upgrades may be intentional; duplicate recurring Creator charges are not.

**Correction/tests:** block recurring plans already covered by lifetime on the server; preserve explicitly chosen Studio upgrades; coordinate overlapping purchase intents and reconcile conflicts without silently cancelling existing billing. Test direct requests, two tabs, old open sessions and both payment orders.

### H2 — Historical images can consume the promised lifetime text allowance (P1; inherited counter design, newly exposed)

**Files:** `lib/generation-reservation.ts:129–136,200–205`; `lib/postgres-repository.ts:117–133`; `app/studio/page.tsx`; `app/dashboard/page.tsx`.

Lifetime selects the existing Creator limit, but text admission compares `used.text + used.other + pending` to 50. “Other” includes image generations. A lifetime holder who temporarily upgrades to Studio, uses images, and returns to Creator in the same month can have fewer than 50 text generations available. A probe with zero text and 50 prior images is rejected with `quota_exceeded`. Dashboard usage similarly mixes image/text totals.

**Correction/tests:** enforce and display a text-only allowance when paid Creator lifetime is primary, with an explicit policy for text already used during a higher tier. Preserve existing subscription accounting unless separately approved. Test Studio-to-lifetime transitions with image history and month boundaries.

### H3 — Lifetime short-circuit bypasses Studio renewal reconciliation (P1; new)

**Files:** `app/studio/page.tsx:79–86`; `lib/server-billing-state.ts:56–58`; `lib/entitlements.ts:14–21`.

When a stored Studio period expires, `paidCreatorLifetimeIsPrimary` becomes true. The new early return happens before the existing Stripe refresh. If Studio actually renewed but its webhook is delayed, the user receives Creator state instead of a reconciled Studio plan. The server billing-state probe returned Creator with **zero Stripe reads**, despite a mocked renewed Studio subscription being available. Dashboard follows a different reconciliation order.

**Correction/tests:** reconcile possible higher-tier subscriptions before settling on lifetime fallback, while retaining lifetime as the safe fallback during provider outages. Verify delayed renewal, cancellation, payment failure, upgrade and outage across dashboard, Studio and server billing state.

### H4 — Refund/dispute state machine is incomplete (P1; new)

**Files:** `app/api/billing/webhook/route.ts:219–243`; `lib/paid-lifetime-fulfillment.ts:84–109`; `lib/paid-lifetime-stripe.ts:49–58`; `types/saas.ts`; migration state checks if policy needs additional states.

Full refunds after ordinary activation revoke only the paid lifetime fields, which is correct. But:

- A partial refund before activation fails verification indefinitely; the same partial refund after activation returns 200 and leaves access active. No explicit policy or reconciliation record explains the different outcomes.
- Only `charge.dispute.created` is handled. Winning/closing a dispute cannot restore access through this implementation.
- A purchase already marked `disputed` cannot subsequently become `refunded`; the service throws and the webhook retries with 503.
- A replay of an already-applied async failure calls the terminal updater again, throws and returns 503 instead of an idempotent acknowledgement.
- Refunded/disputed accounts retain a purchase ID and are permanently blocked from purchasing again. This needs an explicit recovery/repurchase policy, not accidental behaviour.

**Correction/tests:** implement the agreed full/partial refund and dispute lifecycle with durable reconciliation and idempotent terminal transitions. Never automatically reinstate access merely because a delayed success arrives.

### H5 — Payment completion UI misrepresents the one-time product (P1 before public sales; incomplete integration)

**Files:** `lib/stripe-rest.ts:756–758`; `app/success/page.tsx:8–12,85–119`; `app/dashboard/page.tsx:200–217,261–290`; future lifetime offer/terms and purchase UI.

Lifetime redirects to `/success?...&lifetime=1`, but the page ignores that flag and says “Subscription started” and “Your Pro subscription has been activated successfully.” It also claims activation without checking this account's fulfilled entitlement.

For a basic lifetime holder the dashboard derives status from the unchanged subscription status, so it can display Creator lifetime with “Status: none.” For lifetime plus Studio it suppresses scheduled-cancellation messaging because `hasLifetimeAccess` is true and labels the current plan “Lifetime / no expiry,” obscuring which tier is recurring.

**Correction/tests:** account-bound paid/pending/failed/reversed purchase status; clear one-time/no-renewal wording; separate Creator lifetime from recurring Studio renewal/cancellation. A query flag alone must never prove payment. No public CTA should be enabled during this stage.

### H6 — New payment and SQL paths lack decisive integration tests (P1 release validation)

**Files:** `tests/paid-lifetime-*.test.mjs`; new isolated database and Stripe sandbox suites; `tests/subscription-transitions.test.mjs`; `tests/generation-reservation.test.mjs`; `tests/image-generation-route.test.mjs`; `tests/commercial-ledger-isolated.mjs`.

Current coverage uses stubbed SQL or dependencies. The fulfillment harness ignores advisory-lock behaviour and does not exercise actual constraints or concurrent transactions. There is no enabled lifetime-route integration test, no actual reservation allocator test, no refund/dispute webhook test, no genuine 25th/26th buyer race, and no complete lifetime quota/image/subscription transition matrix.

Passing mock tests is useful, but does not establish database serialization, runtime grants, real Checkout parameters, webhook registration, or sandbox refund behaviour. See the acceptance matrix below.

### H7 — Cost review expires on 19 November; actual model setting remains unverified (P1 release prerequisite, mainly inherited)

**Files:** `lib/ai-cost.ts:3–6,32–40`; `app/api/generate/route.ts:85–90`; deployment configuration and cost-policy release evidence.

New requests fail closed at `2026-11-19T00:00:00Z`, eleven days after this audit. Adding GPT-5.2 rates did not extend that review window or change the policy version. The deployed source defaults to GPT-5.2, while the observed November production text ledger records GPT-4.1. Vercel environment-metadata retrieval returned 403; no Vercel CLI was installed for the documented fallback. Recent ledger usage is not proof of the current environment override.

**Correction/tests:** verify the intended model per environment, then renew/version the cost review with evidence and tests. Preserve fail-closed expiry and existing GPT-4.1 settlement. Do not change a production model as part of this audit.

## Medium-priority improvements

| ID | Improvement and exact files |
| --- | --- |
| M1 | **Make reconciliation operable.** `app/api/billing/webhook/route.ts`, `lib/paid-lifetime-checkout-service.ts`, `lib/paid-lifetime-fulfillment.ts`, `lib/paid-lifetime-reservations.ts`, plus an operator runbook. The code sends many ambiguous and permanently invalid cases to 503/logs without a durable work queue. Record event IDs, attempts, reasons and terminal outcomes; alert on stuck preparing/paid-unfulfilled/reversed states; distinguish retryable failures from already-terminal replays. |
| M2 | **Persist immutable creation inputs and bound retry behaviour.** `lib/paid-lifetime-reservations.ts`, `lib/paid-lifetime-checkout-service.ts`, `lib/stripe-rest.ts`, migration. The idempotency key is durable, but creation uses the current email/customer and redirect configuration on every retry. Changed parameters can make recovery fail. Store the creation fingerprint/inputs and provide safe recovery outside the 23-hour window; do not mint another key blindly. Add per-account/IP initiation limits without breaking session reuse. |
| M3 | **Expose the correct lifetime payment customer.** `lib/paid-lifetime-fulfillment.ts:66–74`, `lib/postgres-repository.ts`, `app/api/billing/portal/route.ts`, dashboard. The purchase stores `stripe_customer_id`, but activation does not link it into the account's billing view. Later email-based recovery is not a substitute for the known purchase identity. Preserve any existing subscription customer and resolve the appropriate customer explicitly. |
| M4 | **Align declarations and documentation with runtime.** `lib/paid-lifetime-offer.ts`, `lib/usage.ts`, entitlement tests, PR description and comments in reservation/fulfillment services. The 50/0 offer constants do not themselves enforce quotas. PR text says card-only, but current code deliberately uses dynamic methods and has async success/failure handlers. Some comments still say the webhook is unwired. Use one tested commercial contract and accurate operational documentation. |
| M5 | **Add environment and provider-contract validation.** `lib/paid-lifetime-stripe.ts`, `lib/stripe-rest.ts`, `app/api/billing/webhook/route.ts`, sandbox tests. Test the pinned Stripe API version, dynamic methods, expanded session/charge shapes, customer identity, account/mode isolation, promotion/tax/adaptive-pricing interactions and exact £99/£149 totals. The strict amount check is valuable; verify real configured sessions satisfy it. No evidence in this audit establishes a public signature bypass or client-controlled price exploit. |
| M6 | **Resolve inherited hashtag test debt separately.** `lib/hashtag-policy.ts`, `lib/hashtag-output.ts`, `lib/hashtag-context.ts`, `lib/hashtag-topic.ts`, and the three failing test files below. Determine which old expectations conflict with current editorial policy and which represent a lost supported behaviour. Do not weaken factual grounding just to make tests green. |

## Verified functionality and security properties to preserve

- Distinct `creator_lifetime_2026` identity, new purchase table and separate profile fields; no new use of Founding 100 coupons or free Founder claims.
- Retired Founder acquisition remains closed. Existing Founder, manual lifetime and owner complimentary access remain protected by their original paths.
- Server-side authenticated account identity and origin rejection on lifetime initiation. The browser cannot choose the price, slot, user ID, line item or amount.
- Hosted Checkout uses `mode=payment`, one quantity-one item, GBP and no recurring price/subscription data. New customers are explicitly created when needed.
- Raw webhook-body HMAC verification, timing-safe comparison and five-minute timestamp tolerance remain in place; existing signature tests cover stale/forged/malformed deliveries.
- Fulfillment retrieves Stripe Checkout and PaymentIntent/charge server-side; verifies stored session ID, purchase/user/attempt metadata, exact amount/currency, payment status, quantity and one-time price, and rejects discounts, refunded/disputed charges and partial received amounts.
- Same-account checkout reuse, durable idempotency key, unique session/PaymentIntent IDs, global allocation advisory lock and unique early-bird slot index. These protect duplicate admissions; real concurrency testing is still required.
- Activation/reversal update purchase and full profile together, preserving subscription IDs, unrelated profile fields, workspace/history and legacy benefits.
- Pure lifetime resolves to Creator; normal boundary probes allow the 50th text, reject the 51st, reset next calendar month and refuse new AI image generation. A legitimately paid Studio tier can still supply its own higher benefits. Those benefits must not be removed to implement “no lifetime images.”
- Monthly lifetime windows currently mean **UTC calendar months**, not a purchase anniversary or London-local month. Spending uses Europe/London months. Document this distinction and test daylight-saving boundaries.
- Existing successful-request accounting, request replay, pending quota reservations, per-account attempt limits, failed-generation handling and shared monetary holds remain active.
- Keep the £30 cap, conservative settlement, uncertainty holds, no blind provider retries and £20/£25 alert records. Do not reset historical budget or usage to accommodate the migration.

## GPT-5.2 and the existing £30 spending control

Official GPT-5.2 standard prices are **$1.75 input, $0.175 cached input and $14 output per million tokens**. The PR's integer formula correctly applies $1.75/$14; charging cached input at the uncached rate is conservative. GPT-5.2 reasoning tokens count as output tokens. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-5.2), [official reasoning guide](https://developers.openai.com/api/docs/guides/reasoning).

The implementation reserves a bounded 24,000 output tokens plus an input byte bound and uses £1 per US$1 plus 20% contingency. At the maximum 128,000-byte text payload the reserve is **£0.680602**. Settlement releases only the difference supported by usage; unknown usage retains the hold. Unknown models or invalid payload bounds are refused. The provider call has automatic retries disabled. GPT-4.1's previous pricing remains unchanged.

`commercial-ledger.ts` serializes admission/settlement using advisory lock `1949019030`, checks all accounted text/image spend plus applicable opening balance before reservation, and moves reservations across London month boundaries before dispatch. A bound violation suspends new admissions. These are application controls for traffic routed through this ledger, not a provider-wide limit on other keys/projects.

**Read-only production evidence:** project `long-hat-93822871`, confirmed `production` branch `br-broad-sea-b29qogmq`, database `contentos`, queried as `contentos_runtime`:

| Observation on 8 November | Result |
| --- | --- |
| Budget configuration and spending table | Present |
| New lifetime purchase table | Absent |
| Budget suspended | false |
| Starts month / historical opening | 2026-10 / £6.778302 |
| November accounted spend | £0.475409 across 17 requests |
| November text | 12 settled GPT-4.1 requests, £0.147053 |
| November images | 5 settled pinned Flare requests, £0.328356 |
| November nominal headroom at this snapshot | £29.524591; October opening is not charged again |
| Current OPENAI_MODEL environment setting | Not verified: Vercel metadata 403 |
| Provider invoice reconciliation / other traffic sharing credentials | Not performed; application ledger is not invoice proof |

Production values are point-in-time aggregate reads, not a promise that spending remains unchanged.

## Investigation of the 10 reported failures

Both commits ran the complete `tests/*.test.mjs` suite using Node **v24.15.0**, the same unchanged lockfile and installed dependencies, and a cleared environment. Providers were mocked. No paid AI requests or Stripe payments were made.

| Check | Production/base | PR head |
| --- | ---: | ---: |
| Total tests | 444 | 462 |
| Passed | 432 | 450 |
| Failed | 10 | 10 |
| Skipped | 2 | 2 |
| New passing tests | — | 18 |
| Typecheck / lint | Not rerun on base | Both passed |

The two skips are opt-in PostgreSQL auth lifecycle/rate-limit suites. The **same ten failure names, locations, expected values and actual values** occur on both commits. Their implementation and test files are unchanged by PR #22. Therefore these are existing production-branch failures, not regressions introduced by this PR. This does not prove that untested lifetime behaviour is correct.

| Test file and test declaration line | Failing test | Observed difference / cause |
| --- | --- | --- |
| `tests/content-quality.test.mjs:15` | exact captured retest keeps its factual hook, removes unsupported niche and two stock phrases | Missing #1000subscribers, #Subscribers and #Giveaway |
| `tests/content-quality.test.mjs:33` | brand name alone and newly generated prose do not establish a niche | Missing automatic #Subscribers and #Giveaway |
| `tests/content-quality.test.mjs:42` | explicit hashtag preferences and current overrides are respected | First assertion expects fallback tags; actual set is empty |
| `tests/content-quality.test.mjs:51` | Unicode, compound audience phrases, numbers and explicit tags remain usable | Numeric subscriber tag removed; automatic fallback tags absent |
| `tests/content-quality.test.mjs:62` | deduplication spans caption and tags but does not delete independent platform sets or plain labels | Existing supported tags/label survive; expected fallback tags absent |
| `tests/content-quality.test.mjs:93` | refinement remains grounded while allowing explicit style and hashtag instructions | #1000subscribers removed from prior suggestions |
| `tests/post-format.test.mjs:25` | server output, workspace round-trip, clipboard transport and export retain identical LF spacing | Expected #PlanningIdeas is not added; whitespace is not the failing difference |
| `tests/post-format.test.mjs:59` | all post platforms group tags; explicit separate-line request survives generation and cloud save | Expected third fallback #PlanningIdeas absent |
| `tests/post-format.test.mjs:70` | default hashtag limits do not add filler or drop meaningful text accompanying a tag | Numeric #Topic0… tags all filtered: 0 rather than 5 |
| `tests/simple-creation.test.mjs:17` | one sentence produces a single-platform contract; all 14 formats remain parseable | Empty provider hashtag items plus no inferred suggestions leave standalone platformHashtags empty |

Root causes are traceable to `lib/hashtag-policy.ts:85–98`: numeric tags are classified as fragments unless explicit/trusted; automatic suggestions come from recognized concepts/social themes/explicit tags rather than every allowed source phrase. `lib/hashtag-output.ts:32–52` uses only that candidate pool to fill missing tags. The request in the simple-creation test has no provider hashtag candidates and no matching fallback theme. Several test titles suggest formatting or parse failures but the actual assertion failures concern hashtag selection.

Next agent should agree the intended numeric-tag/fallback behaviour, then update policy or stale fixtures accordingly, retaining unsupported-claim rejection and no-filler rules. The PR description's mention of only one unrelated simple-creation failure understates the current full-suite baseline.

## Recommended acceptance tests

| Priority | Coverage required | Suggested location |
| --- | --- | --- |
| P1 | Actual PostgreSQL migration from production-shaped baseline; second-run behaviour; owner/runtime grants; FK/check/unique enforcement; rollback without Founder/profile/budget changes | new `tests/paid-lifetime-postgres-isolated.mjs`; migration runner |
| P1 | At least 26 parallel distinct buyers: exactly 25 distinct £99 reservations, remaining £149; simultaneous same-user requests share one attempt; process crash/commit acknowledgement loss | same isolated suite; `tests/paid-lifetime-checkout-service.test.mjs` |
| P1 | Abandonment, verified expiry, repeated expiry/failure, 23/24-hour uncertainty, no release of paid/settling sessions; refunded slots and repurchase policy | reservation/checkout/webhook suites |
| P1 | Real Stripe sandbox £99 and £149 sessions, existing/new Customer, exact expanded line items, dynamic/async methods, replayed idempotency keys and unchanged input | new sandbox integration suite; `tests/paid-lifetime-stripe.test.mjs` |
| P1 | Refund/dispute before, during and after activation; duplicate/reordered success; partial then full refund; dispute won/lost/closed; persistence failure; unmatched events retained | new `tests/paid-lifetime-webhook.test.mjs`; fulfillment and async tests |
| P1 | Enabled route: authentication, origin/CSRF, profile identity, forged price/user input, current subscribers, existing lifetime, missing DB/Stripe, timeout and retry | new `tests/paid-lifetime-checkout-route.test.mjs` |
| P1 | 49→50→51 text boundary with pending requests, cross-instance quota race, UTC rollover; no-image route and zero provider calls; old Studio images; Studio renewal/cancellation/refund fallback | generation reservation/route, image route and subscription transition tests |
| P1 | Recurring Creator POST from lifetime user rejected; Studio upgrade remains deliberate; overlapping subscription/lifetime Checkouts cannot silently double-charge | `tests/subscription-only.test.mjs`, lifetime route and sandbox suites |
| P1 | GPT-5.2 real production payload quoted and reserved; reasoning/cached usage; £30 final-budget race shared with images; £20/£25 alerts; timeout/unknown usage holds; month rollover; policy expiry | `tests/commercial-cost.test.mjs`, `tests/commercial-ledger-isolated.mjs`, generation route tests |
| P2 | Account-bound pending/success/refund UI; one-time wording; Studio renewal displayed separately; no Founder branding leakage | new browser/component coverage for success/dashboard/Studio |
| P2 | Same baseline ten failures tracked explicitly; full suite and typecheck/lint rerun after fixes | three existing failing suites plus full `npm test` |

Stripe documents repeated/concurrent fulfillment, delayed payments and asynchronous webhook delivery. These tests must exercise those conditions, not just happy-path calls with signature verification mocked true. [Fulfillment guidance](https://docs.stripe.com/checkout/fulfillment), [webhook delivery guidance](https://docs.stripe.com/webhooks), [dispute lifecycle](https://docs.stripe.com/disputes/how-disputes-work).

## Complete changed-file review inventory

All paths below are relative to the repository at the audited head. Findings may additionally require changes to surrounding files identified above.

| Changed file | Audit disposition |
| --- | --- |
| `app/api/billing/webhook/route.ts` | New dispatch/verification reviewed; C1/C3/H4/H6/M1/M5 |
| `app/api/lifetime/checkout/route.ts` | Gates/auth/subscription exclusion reviewed; H1/H6/M2 |
| `app/dashboard/page.tsx` | Effective tier/usage/display reviewed; H2/H5/M3 |
| `app/studio/page.tsx` | Lifetime tier/window/reconciliation reviewed; H2/H3 |
| `drizzle/0004_paid_creator_lifetime.sql` | Entire DDL, constraints/indexes/grants reviewed; C1/C2/C3/H6 |
| `lib/ai-cost.ts` | New rates and settlement reviewed; C4/H7 |
| `lib/entitlements.ts` | Separate lifetime identity and Studio precedence reviewed; H3 |
| `lib/generation-reservation.ts` | Effective tier/window changes reviewed; H2 |
| `lib/paid-lifetime-checkout-service.ts` | Full orchestration/retry/expiry reviewed; C3/M1/M2 |
| `lib/paid-lifetime-fulfillment.ts` | Full grant/replay/reversal transactions reviewed; C1/H1/H4/M3 |
| `lib/paid-lifetime-offer.ts` | Full contract/helpers/gates reviewed; C3/C4/M4 |
| `lib/paid-lifetime-reservations.ts` | Full reservation/write/termination queries reviewed; C1/C3/M2 |
| `lib/paid-lifetime-stripe.ts` | Full builder and three session/payment validators reviewed; H4/M5 |
| `lib/postgres-repository.ts` | New projection fields and surrounding mutations/usage reviewed; H2/M3 |
| `lib/server-billing-state.ts` | Lifetime shortcut and post-sync fallback reviewed; H3 |
| `lib/stripe-rest.ts` | Types, one-time session creation, customer creation, intent lookup reviewed; H5/M2/M5 |
| `tests/commercial-cost.test.mjs` | Added model-rate test passes; extend as H7/acceptance matrix |
| `tests/founder-offer-journey.test.mjs` | Added lifetime import stubs preserve old fixtures; passes |
| `tests/lite-subscription.test.mjs` | New webhook dependency stubs; passes |
| `tests/paid-lifetime-async-webhook.test.mjs` | Three async cases pass; real fulfillment is stubbed; H4/H6 |
| `tests/paid-lifetime-checkout-service.test.mjs` | Three mocked service cases pass; missing concurrency/recovery matrix |
| `tests/paid-lifetime-disabled-route.test.mjs` | Disabled route passes; enabled route not exercised |
| `tests/paid-lifetime-entitlement.test.mjs` | Two helper cases pass; actual quota/routes/transitions missing |
| `tests/paid-lifetime-fulfillment.test.mjs` | Two SQL-stub cases pass; C1/H4/H6 |
| `tests/paid-lifetime-offer.test.mjs` | Two pure-helper tests pass; do not test actual allocator |
| `tests/paid-lifetime-stripe.test.mjs` | Four validator/parameter tests pass; sandbox/transport still required |
| `tests/subscription-transitions.test.mjs` | Added dependency stubs preserve original cases; add paid lifetime coexistence |
| `types/saas.ts` | Two optional profile fields reviewed; H4 lifecycle may need extension |

## Evidence and handoff

Audit evidence is retained beside this report in `pr22-lifetime-2026-11-08/`:

- `test-comparison.json`: both counts, exact ten failure details, matching comparison, Node version, lockfile hash and commit IDs.
- `base-tests.tap`, `head-tests.tap`, `typecheck.log`, `lint.log`.
- `audit-probes.mjs`, `audit-probes.json`: reproducible offline probes for recurring Checkout, refund race, migration omission, quota/image behaviour and skipped Studio refresh. Run with `node audit-probes.mjs /absolute/path/to/the/audited/checkout` after installing its locked dependencies. These are diagnostic evidence, not proposed implementation tests.
- `production-observations.json`: sanitized aggregate read-only deployment/budget evidence.

No real Stripe sandbox payments/refunds, live AI calls, PostgreSQL migration/concurrency tests or browser purchase journeys were run. Those are outstanding acceptance work, not implied passes. No production secrets were retrieved. Environment metadata remains unavailable; no account reconfiguration was attempted.

Next agent should address C1–C3 and H1–H5 in an isolated implementation branch, resolve C4/H7 release prerequisites, then execute the acceptance matrix. Keep both commercial gates closed and retain this audited SHA as the comparison baseline until a separate launch decision.

