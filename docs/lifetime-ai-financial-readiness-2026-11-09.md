# Lifetime AI configuration and approved prepaid-credit policies

9 November 2026. Starting commit `4289380652def55a40ba892767c3440cb72e0b57`, PR #22, branch `feat/paid-creator-lifetime-2026`.

**NO-GO for sales or a production model switch.** The approved credit policies are implemented and locally verified. A financially sustainable **production** configuration has not been established: the cheapest candidate is inaccessible, the accessible candidate fails quality acceptance, existing subscriber capacity is not quantified, and real Stripe/Preview validation remains blocked. Lifetime and top-up Checkout/fulfillment switches remain false, the shared ceiling remains £30, the optional account monetary cap remains unset, and production routing and entitlements are unchanged. No merge, deployment, production migration or live Stripe change was performed.

This report supplements the Agent 6 recovery report, prepaid implementation report and earlier audit/handover/readiness reports. It supersedes their statements that purchased-credit expiry and reversal policy await approval. It does **not** supersede the unresolved financial, real-payment, environment-isolation or scheduling blockers.

## Approved policy implementation

- Lifetime remains £99 for the first 25 eligible customers, £149 thereafter, one-time payment, 50 monthly text generations and zero included images. Existing subscriptions and retired Founding 100 are untouched.
- Optional top-ups remain £5/25, £9/50 and £15/100, one-time payments, disabled until profitability and real test-mode validation pass and activation is approved.
- Purchased credits have no expiry field, age-based filter or monthly deletion. The account page now explicitly states non-expiry while the account remains active. Usage still requires an eligible paid membership and funded capacity. Subscription cancellation pauses eligibility without deleting purchased credits; reactivation can use retained units. Account deletion/closure is not newly implemented by this change.
- Full refunds now put the affected package in terminal `revoked` status and make all unused units unavailable. Partial refunds and disputes use existing `reversed` storage status, now explicitly labelled **frozen for administrator review**. Full-refund evidence always takes precedence, including when a dispute is also present. Consumed units remain recorded; no automatic debt collection, deduction from other purchases or recurring charge is introduced.
- In-flight credit holds are voided atomically with reversal under the same advisory lock as credit spending. Prior consumed credits are never replenished. A provider request already dispatched cannot be unspent; late webhook delivery remains an eventual-consistency window.
- `POST /api/admin/topups/review` accepts `purchaseId`, `decision` (`reinstate` or `retain_freeze`) and a 10–500 character reason. Session identity and `ADMIN_EMAILS`, not request-body identity, authorize it. Same-origin and bounded-JSON protections apply. The service also verifies administrator authorization. `GET /api/admin/topups/reconciliation` exposes frozen/revoked purchases and decision history to administrators, alongside jobs, alerts and stale holds. This is an operator API, not a new review UI.
- Review fetches the stored test-mode Session, expanded PaymentIntent and complete dispute list. It verifies purchase/account/amount/currency/session/payment binding and paid status. Reinstatement refuses full refunds, open/lost disputes, missing or legacy ambiguous evidence, incomplete provider lists and mismatched identities. A won dispute alone never reinstates credits. All disputes must be won before explicit approval. A historical `charge.disputed` flag may remain true after winning; the verified complete dispute list determines the outcome.
- Immutable `ai_topup_adjudications` rows record administrator ID/email, reason, decision, timestamp, purchase, payment, charge, refund amount, dispute IDs and reviewed evidence. The runtime role cannot update/delete decisions. A pre-existing credit grant remains unique; pre-activation refunds can receive their first grant only through approved review. Existing voided request IDs stay void.
- Approval compares the exact event set, purchase status and decision revision again inside the transaction. New reversal evidence during review aborts approval. Reconciliation/webhook activation capture revision **before** network reads so a stale snapshot cannot undo a concurrent decision. Replayed approved snapshots remain covered; increased refunds or new disputes freeze again. Reversal identity includes the evidence fingerprint: redelivery of an old event that now retrieves a full refund cannot hide the stronger evidence behind the old event's deduplication key.
- Registered migration `0010_topup_adjudications.sql` is additive except for expanding the status check constraint. It leaves all old frozen rows frozen. Ambiguous legacy reversal rows require separate evidence remediation, not automatic approval. Tests execute the actual Drizzle runner over 0009, force a 0010 failure and verify rollback, rerun safely, preserve old rows and verify runtime grants.

## Actual model evaluation

Used the existing separately funded evaluation key with the founder's prior approval. No credential value was printed or committed. `scripts/evals/lifetime-model-comparison.mjs` imports the unchanged production prompt builders, strict JSON schema and application parser. Synthetic briefs cover milestones with missing details, practical posts, qualified claims, all 14 formats, repurposing, newsletter/thread/hooks/CTAs, Unicode, and a long source. Two independent runs per case assess repeatability. No customer content was sent.

Before **each** generation, the harness uses the provider's [input-token counting endpoint](https://developers.openai.com/api/docs/guides/token-counting) on the exact instructions/input/schema, refuses missing/invalid/counts over 8,192, and sets `max_output_tokens: 4096`, reasoning `none`, no tools/history, disabled truncation, standard service and zero SDK retries. A £2 reservation guard caps this manual evaluation run. These controls are evaluation-only and are **not** imported into production routes.

| Model | Actual result | Quality conclusion |
| --- | --- | --- |
| GPT-5.2 code default | Token counting works; generation returns HTTP 403 `PermissionDeniedError` | No live baseline comparison possible |
| GPT-6 Luna | Token counting works; generation returns HTTP 403 `PermissionDeniedError` | Cheapest candidate here; quality/access unverified |
| GPT-5.6 Luna | 16/16 responses completed; 9/16 passed the existing parser/grounding checks | Rejected for adoption on current evidence |
| GPT-4.1 mini | Token counting works; generation returns HTTP 403 `PermissionDeniedError` | Inaccessible; lifecycle and quality unresolved |

The 16 completed calls used provider-reported **62,852 input + 11,901 output tokens**. Preflight counts matched actual input usage on all 16; maximum output was 2,463 tokens, so no sample was truncated by the 4,096 cap. Measured count-plus-generation latency was 3.2–16.6 seconds. Conservative token-based cost was **£0.035993**, not an invoice. An earlier partial evaluation stopped on an invalid synthetic fixture; its seven completed calls and £0.016410 estimate are preserved separately, not silently discarded or included in the final sample denominator. The current run's total reported-usage estimate is therefore £0.052403, excluding any provider billing not represented in usage responses. No actual provider invoice was obtained.

Manual inspection found unsupported niche tags such as paper-goods/creative-business claims in the milestone output, inferred freshness in the café example, and format weaknesses such as TikTok hook options presented as a single caption. Some practical and repurposing outputs were useful. The all-format responses **completed** but were rejected by grounding checks; they were not token-truncated. A parser pass is not editorial acceptance, and some rejection behaviour may reflect the ten pre-existing content/hashtag test failures. Those failures were not changed. Raw outputs and validation results remain in `docs/pr22-financial-evaluation-*.json` for independent review.

**Recommendation:** evaluate GPT-6 Luna first once access is granted, but do not adopt it yet. Do not substitute GPT-5.6 Luna on cost alone. Require a blinded comparison against the actual current deployment model (whose environment override remains unverified), covering all formats and refinements, multilingual/near-limit inputs and repeated runs; agree acceptance criteria such as ≥95% application acceptance, no invented business facts, complete requested formats, and no material quality decline. This small failing sample cannot certify reliability or justify a model change.

## Bounded financial scenarios—not approved routing

Official rates checked 9 November: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) $0.10 input/$0.50 output per million; [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) $0.20/$1.20; [GPT-5.2](https://developers.openai.com/api/docs/models/gpt-5.2) $1.75/$14; [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) $0.40/$1.60. Luna input is conservatively charged at 1.25× cache-write rates, without cache-hit savings. Snapshot availability and lifecycle must be reviewed before adoption; do not select deprecated models solely for price.

For 8,192 input + 4,096 output tokens, reserve **two full attempts per delivered credit**, £1 per USD and 20% contingency:

`cost per delivered credit = 2 × 1.2 × (8192 × input rate × cache-write multiplier + 4096 × output rate) / 1,000,000`

| Candidate envelope | Per delivered credit | 1 customer × 50/month | 25 customers | 50 customers | 100 customers |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | £0.007373 | £0.36864 | £9.216 | £18.432 | £36.864 |
| GPT-5.6 Luna | £0.016712 | £0.83558 | £20.890 | £41.779 | £83.558 |
| GPT-4.1 mini | £0.023593 | £1.17965 | £29.491 | £58.982 | £117.965 |
| GPT-5.2 | £0.172032 | £8.60160 | £215.040 | £430.080 | £860.160 |

The first two meet the **£1/customer/month AI-cost target mathematically** under the candidate envelope, not the access/quality/retry-production acceptance criteria. Current production still allows a conservative 132,096 input reserve and 24,000 output tokens: **£34.03/customer/month for 50 successful GPT-5.2 calls**, before failed attempts. One such account exceeds £30. No cap or route was changed.

The evaluation proves input counting can enforce this envelope for the sampled requests. Production adoption requires approval and implementation of: exact-payload token preflight, output cap, model/snapshot and price allowlist, atomic quote/reserve/settlement for all endpoints, no implicit SDK/fallback retries, and **durable per-credit retry-cost accounting**. Today a customer can retry a failed generation with a new request ID; the global monetary ceiling limits total spend, but there is no two-attempt bound per ultimately delivered credit. Therefore the table is **not proof of current production worst-case profitability**. Unknown usage must retain its maximum reservation; an unbounded “retry until success” promise is incompatible with a finite guarantee. Reject oversized input before generation rather than silently truncate it. Any customer-facing retry/capacity treatment needs approval before adoption.

### Proposed top-up margins

The following stress scenario uses two full attempts/credit, the bounds above, 20% VAT-inclusive pricing **as an assumption**, [Stripe's published international-card rate including conversion](https://stripe.com/gb/pricing) of 5.15% + £0.20 rounded up, and 10% of gross revenue reserved for operating/support/refund costs. Actual tax treatment and account/payment-method fees need founder/accountant confirmation. Standard UK cards are cheaper at 1.5% + £0.20.

| Package | Net revenue after VAT assumption | Stripe stress fee | GPT-6 API cost | Contribution after fee, API and 10% gross reserve | Margin on net revenue | GPT-5.6 contribution |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| £5 / 25 | £4.167 | £0.46 | £0.1843 | £3.0223 | 72.5% | £2.7889 |
| £9 / 50 | £7.50 | £0.67 | £0.3686 | £5.5614 | 74.2% | £5.0944 |
| £15 / 100 | £12.50 | £0.98 | £0.7373 | £9.2827 | 74.3% | £8.3488 |

All three **could** clear a 25% operating contribution target with an accepted, enforced Luna configuration. Current GPT-5.2 remains loss-making; even at the smaller candidate envelope with one retry, contributions are −£1.094/−£2.672/−£7.183. Do not activate these prices yet.

This fee scenario is not a universal fee maximum: other methods, taxes, chargeback losses and dispute fees differ. Stripe currently lists a £20 dispute-received fee and potentially another £20 for manual countering; a single disputed £5 package can be loss-making regardless of model efficiency. The 10% reserve is a planning allowance, not proof that observed dispute/hosting/support rates fit it. Non-expiring credits also create future redemption and provider-price exposure. Maintain a cash reserve for unspent credits and recurring lifetime liability; top-up receipts do not increase the £30 spending ceiling. One-time membership proceeds fund a finite runway, not an infinite liability.

### Existing subscribers and fair capacity

No current customer census, production token distribution or provider invoice was available. The illustrative incumbent mix is 10 Free, 5 Lite, 3 recurring Creator and 1 Studio: **480 monthly text requests**, before images, failures and uncertainty. Preserve incumbent models and allowances.

At the current GPT-5.2 maximum, those 480 requests alone reserve **£326.689**. Adding 25/50/100 lifetime customers on the hypothetical GPT-6 Luna configuration needs **£335.905 / £345.121 / £363.553** monthly before images and additional operational reserve. These are stress-case funding requirements, not an authorized budget increase. Under an entirely hypothetical migration of every customer to the candidate GPT-6 limits, the same totals would be £12.755/£21.971/£40.403. That latter table is **not a recommendation to silently change subscribers**. At 25 lifetime members on GPT-5.6 with every incumbent also migrated, £28.911 leaves almost nothing for images/uncertainty.

Recommended allocation design, pending founder approval:

1. Preserve the current protected incumbent budget; today that is the whole £30, so **new funded lifetime/top-up capacity is zero**. Obtain current entitlement counts, image obligations, holds and provider reconciliation before proposing a smaller ring-fence. New offers must not borrow the incumbent reservation.
2. Within a separately demonstrated residual pool, reserve the bounded included lifetime liability per sold account up front each month: candidate GPT-6 cost £0.36864, with a proposed **£1 planning allocation per lifetime account** to cover further uncertainty. This is a funding allocation, not an activated customer cap or reduced generation entitlement.
3. Allocate purchased-generation work only against separate cash-backed residual monthly headroom; use fair account scheduling and atomic reservations, not first-customer-wins spending. Do not sell unlimited non-expiring units against an unfunded queue. Purchased credits remain intact when capacity is unavailable.
4. Gate commitments using `N ≤ floor((£30 − protected incumbents − global operational reserve − prepaid delivery commitments) / £1)`. For illustration, a founder-approved/evidence-backed £15 incumbent + £5 operational ring-fence would allow **at most 10** £1 lifetime allocations and no additional prepaid monthly commitment. This is **not** the current configuration. Even the theoretical £0.36864 minimum permits at most 81 lifetime accounts with zero incumbents/overheads, so 100 active accounts cannot fit.

Do not activate the earlier blanket £7.50 account cap: it can block an existing subscriber's included use. An incumbent-safe allocation needs explicit founder approval, cohort-aware reservations and an independently tested admission policy. Existing code still protects all £30 and refuses unfunded lifetime sales.

## Reconciliation, alerts and real-payment preparation

Verified locally: persistent due times, leases, bounded backoff, eight-attempt limit, alerts, atomic credit races, duplicate/out-of-order events, safe migration/reruns and review decisions. The new PostgreSQL check uses **real localhost HTTPS** with a temporary trusted certificate: first delivery returns 503, second 204; attempts and acknowledgement persist. An unauthorized cron request gets 401 and two authorized local invocations reach the delivery worker. No external recipient was contacted. This verifies local transport and dispatch, **not** an installed Vercel scheduler or a monitored production alert receiver.

`vercel.json` remains `0 4 * * *` (daily). A five-minute due time is not a five-minute execution guarantee. Agree a scheduler/plan supporting sufficiently frequent execution, authenticated requests, backlog-age monitoring, lease-expiry recovery and monitored HTTPS alerts; test it in isolation. [Vercel's current cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) allow daily Hobby execution and more frequent Pro/Enterprise execution. No paid upgrade or production schedule change is authorized here. New dispute retrieval respects the reconciliation deadline signal.

Read-only access checks in this run:

- Stripe connector exposes **PIERNEXA Technologies LTD, live mode only**; no local `rk_test_`/`sk_test_` credential. No live Stripe object was read or mutated for payment testing.
- Authorized Vercel connector request for `content-os`, PR branch environment metadata returned **403**. Restrictions were not bypassed. Preview database isolation remains **unverified**.
- No real Stripe purchase, provider webhook delivery, refund or dispute test occurred. PostgreSQL tests use synthetic Stripe objects. Existing report evidence must not be relabelled as sandbox success.

Before real test-mode scenarios, an authorized operator must:

1. Give the selected evaluation project Responses-generation access to GPT-6 Luna and the actual production baseline model, with separate funding. Repeat quality comparison; provide model/snapshot/limit and retry-policy approval only after acceptance.
2. Grant legitimate read access to the Vercel project/Preview environment or perform a witnessed metadata-only isolation check. Compare Preview database host, database, Neon project/branch and runtime role against production; never print connection passwords. Code's current allowlist is branch `br-divine-term-b2rihbxv`, database `contentos`, host `ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech` (or pooler variant). Those strings alone do not prove isolation or a synthetic dataset. Verify branch provenance, credentials, grants, no production customer data, and that `VERCEL_ENV=preview`, fixture mode and test-Stripe opt-in are correct. A different branch needs an explicitly reviewed allowlist change.
3. Supply an authorized restricted **test-mode** Stripe credential for the intended sandbox and its webhook signing secret through the approved secret mechanism, never chat/commits. App testing needs Checkout session create/read/expire, PaymentIntent/charge/dispute read and customer permissions actually used by this integration; the separate operator running scenarios needs test refunds/dispute operations. Verify account identity and `livemode=false` with API evidence. A dashboard test-mode URL does not grant API access.
4. Apply migrations only to the proven isolated database with its migration role, then use the least-privilege runtime role. Create synthetic paid/lifetime test accounts and a separately reviewed test-only build/configuration; do not flip the checked-in closed flags or bypass the unfunded production gate. The current branch deliberately cannot sell, even with a test key. Any test-enabling configuration must be impossible to promote to live.
5. Configure and verify the signed test webhook endpoint `/api/billing/webhook`. Exercise all three packages via hosted Checkout, card success/failure/cancellation and asynchronous settlement. Record sanitized Session/PI/charge/event IDs, amount, currency, mode, account, response and exactly one grant. Test duplicate/redelivered events and reversed event order.
6. Exercise partial and full refunds before/after issuance and after partial consumption, dispute creation and won/lost outcomes, explicit admin review, new risk after approval, replay after full refund, concurrent reservations and monthly reset. Assert no cross-package deductions, no auto-reinstatement, correct customer balances and immutable history. Include £99/£149 lifetime allocations, final early-bird contention, existing subscriptions, Studio renewals and Founding 100 preservation.
7. Install an isolated scheduler and monitored alert receiver; induce provider outage, retry exhaustion, lost Checkout identity, process interruption and stale credit holds. Record actual delivered alerts and operator resolution. Keep test IDs and evidence in docs; redact secrets.

## Verification and founder decision

Evidence directory: `docs/pr22-commercial-policy-evidence/`. Targeted tests: **87 passed**. Isolated PostgreSQL: **22 compound checks passed**, including 0010 rollback/rerun and actual localhost HTTPS alert retry. TypeScript and lint passed. Full suite: **496 tests, 484 passed, 10 failed, 2 skipped**; failure names exactly match the recorded production baseline in `docs/pr22-lifetime-2026-11-08/test-comparison.json`. No unrelated baseline test or generation implementation was changed.

Key application changes: `lib/ai-topup-review.ts`, `lib/ai-topup-payments.ts`, `lib/ai-topup-reconciliation.ts`, `lib/stripe-rest.ts`, `app/api/billing/webhook/route.ts`, `app/api/admin/topups/{review,reconciliation}/route.ts`, `app/dashboard/page.tsx`, `drizzle/0010_topup_adjudications.sql` and journal. Evaluation scripts, synthetic outputs, projections and tests are committed alongside them. Full diff reviewed for secrets, unrelated edits and accidental offer/model/budget changes.

**Founder action:** provide model access and isolated Stripe/Vercel verification access; approve a model/limits/retry proposal only after quality succeeds; confirm fees/tax/operating reserve and an incumbent-safe funded sales cap; authorize an isolated scheduler/alert destination and operator process. Keep both offers disabled. The £1 target is plausible for Luna, but the **current implementation and business model are not demonstrated viable within £30/month**, and real sandbox verification has not passed. `COST_POLICY` still expires 19 November 2026 UTC and requires review before then. Re-run independent release acceptance after any approved routing/configuration change; this work is not launch approval.
