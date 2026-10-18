# Controlled live grounding benchmark

## Verdict: NO-GO

The authorized fresh GBP9 campaign ran on 18 October 2026. Six paired draft calls completed (84 assets across all 14 formats). The first candidate factual-review call ended without a confirmed response at the shared provider deadline. The campaign stopped immediately after seven paid requests, with no retry. No candidate pack completed grounding or qualified for delivery. The other two candidate review pipelines were not executed; their unreviewed drafts are not substitutes for validated results.

Production, customer records, billing settings, subscriptions, image generation and Founder protections were unchanged. PR #3 remains draft. No additional budget or deployment is requested.

## Frozen design and provenance

- Production baseline: `6c75fab8e995e94c53bec400aed01991e1ee0642`.
- Candidate: `6daddcc4149932e0d1bc59e331ecba7ce99f78ad`, verified against the existing PR head before execution. No application changes affected the live run. A separately documented local format-annotation fix was started only after the run and is not live-validated.
- Campaign plan SHA-256: `9eb39f8c7fe704362e9cba681feda352433fa27cbf3176a9eb56a25d7dae824f`.
- Independent sealed brief artifact SHA-256: `882551de16ba114b2d748bbcf11acf6de8e31d72a5974f64cf5a4c65b53fc8b2`.
- Three genuinely unseen synthetic briefs H1/H2/H3; none is a reused pilot/launch/sparse case. H3's overlong content goal was moved verbatim into its source field by its author. The sealed original is unchanged; both variants use the same adapted instructions. Adapted input SHA-256: `9185c65703bd5ad825bcf2f6997836c55ce6e1576c478eaf24a084fcbf6a35ac`.
- Same model (`gpt-5.2`), default tier, `store:false`, no tools/images, no paid judge, no automatic retry. Baseline uses its actual prompt/schema/normalizer/output parser with explicit transport safety bounds. Candidate uses its actual strict parser and `groundGeneration()` helpers from the frozen commit.
- All six drafts were collected before reviews. Review queue time is excluded; completed draft/review latency is deducted from the same 90-second candidate provider budget. These are provider-stage measurements, not browser/request Core Web Vitals or database-save latency.

## Measured execution

Window: **09:06:08-09:11:37 UTC**. Cleanup completed at **09:11:44 UTC**.

| Brief | Baseline draft | Candidate draft | Baseline USD | Candidate draft USD | Candidate grounding |
| --- | ---: | ---: | ---: | ---: | --- |
| H1 | 39.179 s | 45.151 s | 0.05530700 | 0.05904150 | First review uncertain after 44.852 s; no validated delivery |
| H2 | 40.173 s | 55.449 s | 0.05895575 | 0.07152250 | Not executed after campaign stop |
| H3 | 49.509 s | 52.906 s | 0.06016500 | 0.06525050 | Not executed after campaign stop |

Draft medians: **40.173 s baseline**, **52.906 s candidate**. Aggregate draft costs: **USD0.17442775 baseline**, **USD0.19581450 candidate**. These exclude the unknown review charge, so candidate full-pipeline cost and successful latency cannot be reported.

All six drafts contain 14 formats. All three candidate drafts pass their strict structural contract. The baseline passes its original parser; failing the newer candidate contract is not a baseline runtime failure. Provider draft completion was 6/6. There were zero completed candidate reviews, zero repairs, zero final revalidations and zero validated candidate deliveries. The first pipeline used 90.003 seconds across the draft and uncertain review. Timing is consistent with the configured 44.849-second remaining timeout; the captured evidence does not retain a provider error body or definitive remote completion status, so no claim of an OpenAI outage or a free request is made.

## Spending audit

The fresh isolated ledger permanently records **GBP4.262720** reserved: six draft reservations of GBP0.568960 and one review reservation of GBP0.848960. Five unused review slots remain unadmitted. The campaign is disabled with reason `unknown`; no refund or replay is permitted. The earlier GBP5 campaign and its GBP4.804294 reservation were not reopened or reset.

Confirmed six-call usage: **16,287 input / 24,410 output tokens**, zero cached tokens. Token-priced cost: **USD0.37024225**, approximately **GBP0.27764056** at the reference rate. The uncertain review retains its full **GBP0.848960** reservation; its actual billed usage is unknown. Therefore the exact total charged is **not fully reconciled**, and the known subtotal is not presented as total spend.

Published [GPT-5.2 pricing](https://developers.openai.com/api/docs/models/gpt-5.2) was rechecked before dispatch: USD1.75/M input, USD0.175/M cached input, USD14/M output. The [ECB reference](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.eu.html) dated 16 October 2026 was USD1.1253 and GBP0.84385 per EUR. Conversion is an estimate, not invoice/tax reconciliation. Worst-case reservations use GBP1/USD1 plus 25%, no caching, bounded serialized input and bounded output. All twelve permitted slots would reserve GBP8.507520, below GBP9; actual admissions remained GBP4.262720.

## Quality interpretation

Independent blind scoring covers all 84 captured assets. Baseline assets use the original parsed output. Candidate assets are **withheld raw drafts**, not approved or delivered content. A/B labels and variant/delivery mapping remain hidden from evaluators until their score files are frozen. A second independent assessor checks facts, misleading promises, business claims and No CTA against the sealed ground truth.

Both independent model assessors completed 84/84 asset rows, plus all six pack titles/summaries, before the A/B mapping was disclosed. They agreed on the same 13 critical asset rows, all in the baseline. **Candidate raw drafts: zero material fabricated facts, misleading promises or unsupported business claims observed across 42 assets.** Baseline: 12 material factual/offer failures and one incomplete repurposing asset. Neither assessor found a direct No-CTA solicitation in either H1 pack, adoption of the rejected prompt-injection text, a superseded H2 offer presented as current, or fabricated full-site Welsh/accessibility certification.

| Measure | Baseline (42 assets) | Candidate raw drafts (42 assets) |
| --- | ---: | ---: |
| Mean blind score / 20 | 15.62 | 18.29 |
| Source fidelity / 4 | 3.19 | 3.98 |
| Usefulness / platform fit / 4 | 3.14 | 3.69 |
| Originality / 4 | 2.93 | 2.83 |
| Brand voice / 4 | 3.55 | 3.95 |
| CTA compliance / 4 | 2.81 | 3.83 |
| Assets with critical findings | 13 | 0 |
| Missing top-level formats | 0 | 0 |
| Validated candidate delivery | Not applicable | 0 packs |

The baseline's critical examples were incorrect claims that the parts-needed category was the most common outcome (six items versus nine repaired), invented reply/comment/email channels and fulfillment promises, and nested repurposing copy replaced with instructions to write it. Candidate copy preserved the item denominator and measured limitations, current price/date/scope, and partial translation/accessibility coverage. Creative advice and nonmeasurable editorial views were allowed rather than treated as fabrications. Some publisher-facing or repetitive copy remained editorial improvement opportunities, not invented business facts. Candidate originality scored slightly lower (2.83 versus 2.93); the higher aggregate score must not conceal that tradeoff.

Frozen numeric scores SHA-256: `1988ba1c14d6c071d6e3af1297852206ed68cbbdef52e768f5e7bd1dfce20c59`. Independent factual audit SHA-256: `a48c5395cf3f58ebd187d746ded2631c301dcb46d83ce2320e5cab50fc3be574`. Their original labels and judgments remain unchanged. Where the blind assessors called the supplied copy a "final pack", they did not know its delivery state; the unblinded mapping establishes that every candidate pack was a withheld raw draft. Their copy-level "GO" is not a product release verdict.

This is encouraging draft-quality evidence from three synthetic cases, not statistical superiority, originality certification, a zero-hallucination guarantee or a successful grounding-pipeline gate. No live semantic false-positive rate can be inferred: the review never returned a usable decision. Correction quality and final factual accuracy remain unverified. All 42 independently acceptable candidate assets were withheld because the campaign stopped, not because completed semantic reviews declared them invalid.

## Offline findings and local correction

Frozen-candidate replay reconstructed 228/267/224 review units for H1/H2/H3, with serialized request sizes 45,618/51,377/45,895 bytes. Remaining review budgets were 44.849/34.551/37.094 seconds. H1's reconstructed request hash exactly matches the dispatched review; H2/H3 reviews were never sent. Size limits were not exceeded. These counts alone cannot identify the remote failure cause.

The deterministic precheck flagged 24 units as `missing_evidence` because it treated thread indices, nested slide/beat labels and format counts as business-fact numbers. The second independent assessor confirmed all 24 numeric flags were false positives, with no separate material semantic issues in those units (post-unblinding audit SHA-256 `c1d930f54651bc62aeeb960a75769af5f7eb8076e14b90a9cdb95df02fdbd8bd`). These are reproducible offline false-positive findings, not 24 observed live semantic rejections. A narrow path-aware local correction and regression tests address format annotations without globally ignoring numbers or weakening real price/statistic/duration checks. It is a **post-benchmark change, not live-validated**. The held-out cases are now regression evidence and must not be reused as unseen proof of a fix.

The post-fix offline replay reduced those 24 flags to zero, with no new flags. All 719 unit texts, paths and offsets were preserved and all three drafts still parsed. The [replay receipt](benchmarks/grounding-2026-10-18/post-fix-replay.json) records source and captured-output hashes. This is not a semantic-review pass, evidence of lower latency, or a live delivery result.

The complete [synthetic evidence archive](benchmarks/grounding-2026-10-18/) preserves inputs, frozen blind judgments, A/B mapping, all captured outputs, usage/spending records and cleanup receipts. It contains no customer data, connection string or API credential. The isolated database audit is also retained.

## Safety and cleanup

- One temporary build-only Preview in the existing `content-os` project, ID `dpl_4rGWTWW918WeewKyprB1u9Vmf4ae`. Existing project protection remained unchanged; unauthenticated GET returned 302 to Vercel sign-in.
- Existing OpenAI credential stayed in the Vercel build process. No local export, new key/account, billing change or public execution endpoint. Only frozen pure modules and reviewed pg dependencies were used; inherited application/customer/billing environment values were stripped.
- Fresh benchmark-only schema `contentos_grounding_benchmark_20261018` on the existing isolated Neon branch. No production migration, customer query or entitlement modification. Restricted SQL functions provide atomic admission, exact stage/payload/predecessor binding, one in-flight call, durable nonrefundable reservations, expiry and terminal refusal.
- The Preview finished in **ERROR**, deliberately not READY: the runner failed closed after uncertainty. It was then deleted; authenticated GET 404 confirmed removal.
- Runner NOLOGIN and revoked schema/function access were verified, active connections terminated, campaign disabled. Local staging and temporary credential file were removed. Audit rows, source hashes and synthetic evidence remain. Cleanup completed without errors.
- The operator's `prepare` and `execute` entry points now refuse before credential/database access. Tests prove the consumed authorization cannot dispatch again. Audit/cleanup paths remain available for recovery.

## Validation

- `npm test`: 437 passed, zero failed, one explicit isolated-SQL opt-in skipped in the offline suite. All 366 previous app/grounding tests remain included; new benchmark-only offline checks total 56 and format-label regressions total 15.
- Focused grounding/route checks: 148/148 passed after the local correction. One historical excerpt's fixture setup was corrected from an unrelated LinkedIn body to its actual sixth X-thread item, preserving the original text and acceptance assertions. No failing assertion was removed or inverted.
- Isolated PostgreSQL ledger suite: 18/18 passed, no skips, including ten real behavior checks for two-connection admission, crash/lost-ack refusal, exact dependency binding, cap/expiry, immutable completion and failure closure. Synthetic test schema/role removed afterward; campaign audit schema retained.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: PASS. Build: Next.js16.3.8, 51 pages.
- Temporary locked pg-only dependency audit: zero advisories. Existing seven development-only application advisories remain documented; no dependency changes were made in this campaign.
- Earlier authenticated account/cloud persistence, image, Founder and browser evidence is retained without claiming those remote workflows were rerun. No app code changed during the paid run; the subsequent local annotation correction is separately identified and requires affected checks.

## Remaining release gate

The current all-format grounding pipeline has not demonstrated successful completion within its bounded deadline, or zero material unsupported claims after correction. Fixes must preserve exhaustive coverage, spending limits and fail-closed delivery; simply bypassing review, returning raw drafts, adding retries, or claiming a pass from offline mocks is unacceptable. No additional paid requests, temporary deployment or budget increase are authorized by this report. Production release remains separately unapproved.
