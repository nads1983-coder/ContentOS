# PR #22 access resolution and verification — NO-GO

9 November 2026. Starting commit: `b4bde1322295514627cb3631321e796ce17d1692`. This report supersedes the **access findings** in `pr22-final-ai-stripe-verification-2026-11-09.md`; its unfulfilled release criteria remain applicable.

No production routing, budget, offer, allowance, subscription, Stripe configuration or database was changed. Lifetime and top-up Checkout/fulfillment flags remain false. No production deployment or remote migration was performed. The only repository changes are evaluation tooling and evidence/documentation.

## What was resolved

1. **OpenAI 403 root cause identified and corrected with explicit founder approval.** The authenticated `GetContentOS PR7 QA` project's allow-only policy contained GPT-4.1, GPT-5.6 Luna and an image model, excluding GPT-6 Luna and GPT-5.2. Added only the two approved evaluation models, retaining existing permissions and budgets. The existing separately funded local evaluation credential then completed 32 actual Responses API generations. No replacement key, subscription or credit purchase was needed. The dashboard's active Codex key expires on 10 November; re-evaluation after expiry may require normal credential renewal.
2. **Stripe test-key access recovered.** Located the exact named restricted key in PIERNEXA's authenticated test dashboard. After explicit approval, exported it into a temporary user-only file. Added only the approved Events Read, Payment Disputes Write and Webhook Endpoints Write permissions. Six real provider GET probes subsequently returned HTTP 200, with returned objects reporting `livemode=false`: Checkout Sessions, Events, Disputes, Webhook Endpoints, PaymentIntents and Charges. Existing Checkout, Customers and Charges/Refunds Write permissions were preserved. Account retrieval returned 403 before this change; account-wide access was not added because it is unnecessary for payment processing. Dashboard identity was confirmed. These are **access probes, not new payment transactions**.
3. **Vercel UI access recovered and an isolated database prepared.** The existing browser login can inspect `content-os` and its PR #22 Preview, despite connector/CLI API denials. Created a child branch and a new empty database in an existing, separate free-plan QA project. Saved five Secret variables scoped **only** to `feat/paid-creator-lifetime-2026` Preview. Production and general Preview scopes were explicitly excluded before saving.

| Prepared resource | Identity |
| --- | --- |
| QA Neon project | `quiet-fog-56852665` (`getcontentos-visual-director-qa-temporary`) |
| QA branch | `br-hidden-recipe-b9yqeimn` (`pr22-payment-qa-20261109`) |
| New empty database | `pr22_payments_qa` |
| QA endpoint | `ep-bold-scene-b9by9k7z` in EU Central 1 |
| Separate production project | `long-hat-93822871`, production branch `br-broad-sea-b29qogmq` |
| Saved PR-only variables | `DATABASE_URL`, `STRIPE_SECRET_KEY`, `CONTENTOS_PREVIEW_FIXTURES=1`, `CONTENTOS_PREVIEW_STRIPE_TEST=1`, `CONTENTOS_ISOLATED_BRANCH=br-hidden-recipe-b9yqeimn` |

A read-only SQL query against the explicitly selected new QA database returned its name and **zero user tables**. It contains no imported production data. No migrations have been applied to it. The branch is retained for continued testing, uses 0.25 CU with the plan's idle suspension, and currently has no expiry; remove it after the QA work is complete. The staged database connection uses its QA owner; provision a restricted runtime role after schema setup rather than treating that owner as a production runtime credential.

## Actual model comparison

Eight synthetic briefs, two independent repetitions each, unchanged production prompt builders, strict output schema and application parser, standard tier, reasoning `none`, no tools, no SDK retries. Cases include incomplete giveaway details, LinkedIn/X planning advice, tentative repair-cafe claims, all 14 formats, repurposing, newsletter/threads/hashtags, accented text and a long brief. Input was counted through the provider before each call, capped at 8,192; output was capped at 4,096. The evaluation reserved at most £2 separately from the application's £30 ceiling.

**Important baseline limitation:** Vercel has an actual `OPENAI_MODEL` override scoped to Production and Preview, stored as an unreadable Secret. Its value was not recovered. GPT-5.2 is the **repository-default comparison**, not a verified identification of the deployed production model. A comparison with the deployed baseline remains outstanding.

| Measurement | GPT-6 Luna | GPT-5.2 repository default |
| --- | ---: | ---: |
| Actual completed API calls | 16/16 | 16/16 |
| Application parser accepted | 9/16 (56.25%) | 9/16 (56.25%) |
| Input tokens | 62,852 | 62,852 |
| Output tokens | 11,034 | 14,221 |
| Cache-read / cache-write input tokens | 43,652 / 19,152 | 21,888 / 0 |
| Highest counted input / reported output | 4,757 / 1,996 | 4,757 / 3,007 |
| Mean count-plus-generation latency | 6.67 seconds | 14.41 seconds |
| Usage-based list-price estimate, USD | $0.00835232 | $0.27461140 |
| GBP estimate including contingency, all 16 calls | £0.010022784 | £0.329533680 |
| Mean GBP estimate per attempted generation | £0.000626424 | £0.020595855 |
| Total estimate divided by accepted outputs | £0.001113643 | £0.036614853 |

These are provider-reported token counts with **estimated** spending, not invoices or actual GBP debits. Cache effects and the small synthetic workload limit extrapolation. All 32 responses completed and parsed as JSON; all input counts matched usage exactly. Fourteen responses failed the unchanged application's grounding validator. That is a release problem even when text appears reasonable; JSON schema compliance alone is insufficient.

Both models failed both repetitions of the milestone, all-formats and Unicode cases. Luna passed both tentative-claim repetitions, while GPT-5.2 passed one. GPT-5.2 passed both newsletter repetitions, while Luna passed one. Both passed planning, repurposing and long-brief cases twice. Two independent samples are **not** an implemented repair/retry workflow, and three cases failing both samples shows that one retry cannot be assumed to solve delivery reliability.

Qualitative review of paired raw outputs: Luna retained the repair-cafe brief's provisional language and avoided invented giveaway dates/prizes. One GPT-5.2 repair-cafe output added a bring-an-item instruction and a promise to try repairs that were absent from the brief. Both produced readable platform-labelled copy and retained accented names/£ amounts. Hashtag allocation and grouping varied; GPT-5.2's café sample introduced `#BreakfastDeal` despite no discount being offered. Some apparently grounded Luna outputs still failed the parser. Do not weaken grounding checks to obtain a pass rate. Diagnose false positives separately from unsupported output, then rerun all formats and refinements. This was an engineer's review, not a blinded human quality panel.

**Recommendation:** GPT-6 Luna is the cheapest demonstrated accessible candidate in this comparison, with promising prose and cost. It is **not approved for production adoption**: 56.25% parser acceptance, incomplete refinement/limit-edge coverage, unknown deployed baseline and absent durable per-credit retry limits prevent sign-off. Earlier GPT-5.6 Luna evidence also had 9/16 parser passes. GPT-4.1 mini remains untested here; permission was not broadened to it.

## Cost and capacity conclusions

Current official rates were rechecked: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-5.2](https://developers.openai.com/api/docs/models/gpt-5.2), [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). The measured-cost summary distinguishes normal input, cache reads and cache writes. Projections assume no cache discount, charge all Luna input at cache-write rates, use £1/USD plus 20% contingency, and reserve **two** full 8,192-input/4,096-output attempts per delivered credit. They exclude tools and other unbounded calls.

| Candidate under proposed bounds | 1 fully active lifetime member | 25 members | 50 members | 100 members |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna | £0.36864 | £9.216 | £18.432 | £36.864 |
| GPT-5.6 Luna | £0.835584 | £20.8896 | £41.7792 | £83.5584 |
| GPT-4.1 mini | £1.179648 | £29.4912 | £58.9824 | £117.9648 |
| GPT-5.2, proposed smaller bounds | £8.6016 | £215.04 | £430.08 | £860.16 |

The **£0.37** projection remains mathematically defensible for that proposed Luna envelope; it is not an enforceable production delivery promise. Current routes retain their existing limits/model configuration, and repeated user retries are not durably capped at two attempts per delivered credit. At the existing GPT-5.2 code-default maximum quote, one attempt is approximately £0.680602: **£34.03 for one member's 50 requests, £850.75 for 25 members**, before retries and existing demand. Do not substitute the small observed sample average for this liability.

Top-up stress scenario: prices include 20% VAT, card fees are 5.15% +20p rounded upward (international card plus FX), and a separate operating reserve is 10% of gross. This is a scenario, not a statement of the founder's VAT status. [Stripe's published fees](https://stripe.com/gb/pricing) support the card assumptions; dispute and other payment-method charges can exceed the reserve.

| Package | Bounded Luna API reserve | Card fee | Operating reserve | Contribution after VAT scenario and costs | Margin on VAT-exclusive revenue |
| --- | ---: | ---: | ---: | ---: | ---: |
| £5 / 25 | £0.18432 | £0.46 | £0.50 | £3.02235 | 72.54% |
| £9 / 50 | £0.36864 | £0.67 | £0.90 | £5.56136 | 74.15% |
| £15 / 100 | £0.73728 | £0.98 | £1.50 | £9.28272 | 74.26% |

All three are potentially sustainable under the proposed, quality-approved Luna configuration. They remain **not approved for activation**. Even GPT-5.2 with the proposed smaller bounds and one retry yields negative contributions of £1.09/£2.67/£7.18 for these prices. Non-expiring purchased credits are future delivery liabilities; ring-fence their delivery reserves and account for refunds, fraud, taxes and future price changes.

Prioritise incumbent obligations. Until actual subscriber/free/Founder/image usage and provider bills are reconciled, protect the full existing £30 and admit **zero newly funded lifetime/top-up capacity**. After measurement and approval, use `30 − incumbent reserve − uncertainty/operations reserve − prepaid delivery reserve` as the maximum lifetime pool. With Luna, 25 lifetime members require at least £9.216 monthly, leaving at most £20.784 for everything else. One hundred exceed £30 even with no incumbent demand. As a sensitivity example, 480 incumbent calls at the unchanged GPT-5.2 maximum quote cost £326.69; adding 25 Luna lifetime members totals £335.90. This is a maximum-demand illustration, not a customer census. It demonstrates why preserving existing routing cannot be ignored.

Do not activate a blanket per-account cap: it could curtail existing subscribers. A future approved design should reserve incumbent funding first, then atomic per-account lifetime allocations and cash-backed prepaid capacity, with shared retry/uncertainty accounting across endpoints. Credits remain intact when temporary capacity is unavailable. The minimum viable monthly funding for 25 on the candidate model is **£9.216 plus measured incumbent, prepaid and operating reserves**; retaining existing GPT-5.2 bounds is not viable within £30 for even one fully active lifetime member. No allowance reduction or budget increase is proposed as an implemented change.

## Preview and payment blockers — exact current state

The new database itself is demonstrably separate and empty. **The deployed Preview is not yet verified isolated.** Its last inspected ready deployment was `5bWZccbr8FST1GyuVNwhHrSpU2nx` for the starting commit. Vercel explicitly reported that the new branch variables require a new deployment. A later PR push may build a new Preview, but that alone does not prove runtime isolation.

The general Preview environment inherits an `OPENAI_API_KEY` secret also scoped to Production. Attempts to add empty PR-only OpenAI/Resend overrides were rejected by the normal UI with “Enter a value.” No empty override was saved. The Vercel connector denied environment creation with HTTP 403 (`projectEnvVars/create`); a read-only identity request using the normally configured CLI credential also returned 403. No credentials or permissions were bypassed. Provider-disable configuration is therefore unfinished; current strict fixture guards reject this setup before database access. In addition, `lib/preview-fixtures.ts` pins the **old** QA database/branch and would reject the newly prepared tuple. Do not weaken that check or silently point it at production.

**Immediate required access:** a normally authorised Vercel credential with environment-variable read/create/update permission for `content-os` Preview, plus Preview deployment inspection. It must support PR-specific empty provider-key overrides (or an independently reviewed configuration that removes inherited provider credentials without touching Production). The existing browser is sufficient for non-empty values, but the connector and local CLI credential are not. The actual production `OPENAI_MODEL` value also needs authorised, non-secret confirmation.

Next engineer sequence:

1. Complete PR-only provider isolation; retain the new database/test Stripe bindings. Review a narrow allowlist update for the new QA host/database/branch with negative isolation tests. Confirm the selected Preview commit and deployed configuration before any payment scenarios.
2. Apply the established bootstrap sequence and Drizzle migrations **only** to the empty test database after isolation proof, including the externally managed 0003 prerequisite. Create a restricted runtime role and synthetic identities. Do not modify production or copy production rows.
3. Prepare a separately reviewed test-only build that can exercise Checkout/fulfillment while the release branch's commercial gates remain closed. The current checked-in offer flags and funding gate deliberately prevent sales. Do not turn an environment variable into a live-launch bypass.
4. Configure the signed **test** webhook endpoint using the now-authorised restricted key and store its signing secret securely. Validate actual Checkout/payment/webhook/refund/dispute journeys for both lifetime amounts and all top-up packages, concurrency, duplicate/out-of-order events, credit freezes/revocation/review, monthly resets and unchanged subscriptions. Record provider IDs and database assertions. No new Checkout, payment, refund, dispute or webhook endpoint was created in this run.
5. Run the scheduler against the isolated deployment and an authorised test alert receiver. Verify delivery acknowledgement and retry state using the actual scheduler. Local integration evidence is not deployed evidence.
6. Reconcile measured costs/incumbent demand, complete quality and persistent retry controls, obtain founder approval of any production model/capacity change, and independently review launch criteria before enabling either offer.

## Operations, verification and evidence

Fresh local checks, separate from cloud preparation:

- TypeScript and lint passed.
- 56 targeted lifetime/top-up/financial/cost tests passed.
- Full suite: **496 tests; 484 passed, 10 existing content/hashtag failures, 2 skipped**. Failure names match the recorded baseline; application logic was not edited.
- **22 compound isolated PostgreSQL checks passed**, including actual migration execution/reruns/rollback, concurrency, reversal persistence, credit reservation, administrator review, retry limits, cohort reporting and optional account/global controls. Database was password-protected on localhost and stopped afterwards.
- The final compound check used a real **local** HTTPS receiver returning 503 then 204, persisted alert attempts/acknowledgement and checked authenticated cron dispatch. This is not external alert delivery or a Vercel scheduled execution.
- Independent assertions validated all 32 response JSON documents, actual input counts, output caps and cache-aware arithmetic. Offline boundary assertions reject zero, negative, noninteger, nonfinite and >8,192 input counts. A first strict floating-point equality assertion was corrected to a numerical tolerance; no financial configuration changed. Maximum-size live inputs, output truncation recovery, refinements and durable two-attempt retries remain unverified.
- `vercel.json` still invokes reconciliation daily at 04:00 UTC. Five-minute retry timestamps do not schedule invocations; launch needs an appropriately monitored cadence and demonstrated alert delivery. No schedule, limit or paid plan was changed.

Evidence: `pr22-access-resolved-model-evaluation-2026-11-09.json` contains raw synthetic outputs/token usage; `pr22-access-resolved-financial-summary-2026-11-09.json` contains reproducible accounting; `pr22-stripe-access-check-2026-11-09.json` contains sanitised real API access results. The evaluator accepts model/output selection so historical evidence is not overwritten, and the offline summary script reproduces costs without provider calls. Existing production baseline failures were not addressed.

Temporary Stripe and QA-owner connection files were removed after the checks. The pre-existing OpenAI evaluation key was preserved. The approved QA allowlist, Stripe test permissions, PR-scoped Vercel secrets and empty Neon database remain for follow-up. No secret values are in these reports or commits.

**Final assessment: NO-GO.** Access has materially improved and genuine model evaluation is complete for this bounded sample. Real payment verification, deployed environment isolation, operational delivery, production-grade quality/retries and sustainable incumbent-inclusive funding have **not** passed. Keep sales disabled.
