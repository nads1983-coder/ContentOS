# Final staged-delivery live validation

## Verdict: NO-GO

The separately authorized GBP4 validation ran once and stopped safely at its first factual-review batch. **The first batch no longer timed out, but no validated pack completed.** The immediate delivery blocker is reviewer/deterministic-validator disagreement and overly broad claim classification, not an observed provider deadline in this run. Independent assessment also identified nine material unsupported assertions across eight raw formats, so this is not only a false-positive problem. PR #3 remains draft. No extra paid retry, budget increase, merge or production deployment is requested.

Candidate: `c32110aa3711a14bc59a8e7b1da7e8d5f0e38e4c`. One newly authored synthetic brief, Folio Finch / Shelf Notes, requested all 14 formats, No CTA, correct 35-minute event duration and precedence over an obsolete saved-brand offer. It was sealed before dispatch; the previous benchmark briefs were not reused. Raw outputs were not used to tune the candidate before this run.

## Measured execution

| Measure | Actual result |
| --- | --- |
| Paid calls | 2 of maximum 23; both completed, no retries or uncertain calls |
| Draft generation | 50.446 seconds; all 14 formats, 280 content units; structural contract passed |
| First review | 10.641 seconds; 48 assigned units and 48 returned decisions |
| Accepted review coverage | 0/280: the entire first batch was refused atomically; 232 units never reached a review call |
| Run duration until blocked outcome | 64.378 seconds including isolated persistence/orchestration; not successful delivery time |
| Correction / final revalidation | Not reached; no further paid call |
| Validated final save / successful usage | 0 history entries, 0 successful usage events |
| Draft checkpoint | Preserved in the isolated synthetic profile; not delivered to a user |
| Input / output tokens | 11,129 input / 5,424 output; zero cached input and reasoning tokens reported |
| Serialized request bytes | Draft 17,178 B; review 36,536 B |
| Token-priced API cost | USD0.09541175, approximately GBP0.071548 at the checked reference exchange rate |
| Permanent worst-case reservation | GBP0.639420; no refund or reuse of the unused GBP4 ceiling |

Costs use the reported default-tier `gpt-5.2-2025-12-11` token usage, [OpenAI's published rates](https://developers.openai.com/api/docs/models/gpt-5.2) checked on 18 October 2026 and [ECB reference rates](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml) dated 16 October (USD1.1253 and GBP0.84385 per EUR). This is reconciled token-priced usage, not an invoice/tax statement. Reservations use the more conservative GBP1.25 per USD1, capped output and exact request bytes. The atomic ledger never approached its GBP4 cap.

Machine-readable [execution, coverage and cleanup](benchmarks/staged-delivery-2026-10-18/execution.json), [brief](benchmarks/staged-delivery-2026-10-18/brief.json) and [raw unvalidated pack](benchmarks/staged-delivery-2026-10-18/raw-draft.json) are retained. No validated-result file exists because delivery failed.

## Exact failure

The response was complete JSON with exactly 48 decisions and correct unit IDs. Its batch input matches the frozen candidate's expected payload. Offline per-unit replay identifies four rejected certificates:

| Unit | Text / reviewer classification | Why the current parser rejects it |
| --- | --- | --- |
| u4 | "something will always feel slightly off"; subjective | Broad hard-claim detection treats the subjective "always" wording as a factual guarantee. |
| u17 | "Unit cost and retail price"; creative | Price-category keywords occur in a labelled hypothetical record-field list, without a quoted price or offer. |
| u31 | Instagram title ending "(3 options)"; structural | The format count lacks a server-certified annotation for this title/body-caption structure, even though three captions are present. It is treated as an unsupported business number. |
| u46 | "Keeping them separate reduces friction"; subjective | The broad hard-claim verb heuristic rejects "reduces" even in this abstract benefit statement. |

The first and fourth require contextual judgment, not blanket exemptions for "always" or "reduces". The second and third demonstrate why literal keyword/number detection alone cannot distinguish an invented price from a field name or count the supplied assets. The earlier 24 format-number fixes remain in place; this is a newly observed shape, not proof that those tests failed.

Separately, the model itself marked **seven other units unsupported**, mostly general educational descriptions of stock records/display notes and non-measured benefits. Those decisions were not accepted or applied because the whole batch failed first. They must not be reported as seven proven material fabrications: independent content assessment is separate from the reviewer's labels. The campaign's conservative stop policy would also have prevented further paid work after an accepted unsupported decision.

No unchecked content was returned and no successful generation credit was charged. The captured failure reproduces through the actual application route with mocked transport, returning `grounding_failed`, retaining the draft and refusing same-ID paid replay.

## Independent assessment

An independent assessor read only the sealed brief and raw draft, without execution logs, reviewer decisions, code or other assessments. All 14 sections, title/summary, 47 top-level items and nested repurposed assets were inspected. [JSON assessment](benchmarks/staged-delivery-2026-10-18/independent-assessment.json) and [readable findings](benchmarks/staged-delivery-2026-10-18/independent-assessment.md) retain exact quotations, source rationales, scores and input hashes.

- **Nine material source-grounding findings across eight formats:** operational data-stability/accuracy assurances, increased error-risk claims, undocumented claims that museum shops commonly merge these records, and a categorical assertion that a stock file cannot hold signage/placement decisions. These are unsupported by the brief, not externally proven false.
- **Editorial score: 15/20**, assessed separately from factual safety. Repetition, limited angle variety and publisher-facing email/YouTube text need editing. This is one qualitative raw-pack assessment, not a statistical quality estimate.
- **Preserved:** correct event/presenter/scope, 35 minutes as duration only, current-brief precedence over the older offer, no invented event prices/logistics/qualifications/testimonials/results, no explicit added event curriculum and no engagement CTA.
- **Legitimate copy incorrectly blocked:** the assessor treated subjective "feel slightly off" / "reduces friction" phrasing as editorial rhetoric rather than critical facts, and the labelled hypothetical cost/price fields as permitted examples, not an invented event price. The title's three options match the three captions. None justifies a blanket numeric/guarantee exemption.

No final validated asset exists to assess. The above is diagnostic raw-content evidence only. Seven model-reported unsupported units and nine independently identified findings are different sets; no whole-pack semantic precision/recall or live false-positive rate is inferred from this partial review.

## Recovery, isolation and cleanup

The exact candidate's pure stage/reservation/validation/final-save functions ran in a signed one-shot protected Preview build, against real locked Neon transactions. A restricted security-definer adapter exposes only the single synthetic profile; it does not expose auth/customer tables. This validates stage logic and actual checkpoint persistence, not the full browser/HTTP/auth path. Local route/browser evidence is separate.

After the draft checkpoint, a repeated old stage token returned the saved next stage without repeating generation; the second paid call could only proceed after that recovery check. No actual network fault was injected during a chargeable call. Recovery after final-save acknowledgement loss, live correction and final-save persistence were not reached; their isolated mocked tests remain passing but are not represented as live successes.

Temporary deployment `dpl_GGc41yKvaj7uGcPzRPPXGKaArqJH` reached READY with an inert page; unauthenticated access returned 302 to Vercel SSO. It was deleted and API GET404 verified. Campaign disabled, temporary role NOLOGIN, function/schema grants revoked, sessions terminated, local staging and temporary connection credential removed. Cleanup completed at 2026-10-18 10:40:09 UTC, with no errors. The synthetic draft and immutable spending audit remain on the existing isolated branch. Earlier campaigns remain closed and unchanged.

No production database, credentials, billing, Stripe capacity, customer content/account or production deployment changed. No customer communications. The application code is unchanged by this validation task.

## Tests and next correction

Before paid dispatch: nine new behavioral tests and ten real isolated-Neon checks passed, including exact/cumulative reservations, 23-call exhaustion, concurrency, expiry, restricted grants, account binding, unknown outcomes, recovery and successful synthetic final-save replay. The full suite passed 465 tests, zero failures, one opt-in skip; lint and typecheck passed. A pg-only temporary dependency lock audited clean with install scripts disabled.

After stopping: closed-entry-point protection and captured-failure regressions were added. **Final full suite: 468 passed, zero failures, one opt-in skip (469 total).** All 12 staged-validation behavior tests pass, including reproducing the real rejected batch through the actual route. Lint, typecheck, production build (Next.js 16.3.8, 51 pages) and `git diff --check` pass. No app implementation was changed; no live performance/quality pass is claimed from deterministic checks.

Minimum corrective work is **local, not another purchased benchmark**:

1. Certify title counts against actual caption/item structure, including this three-caption form, while rejecting wrong counts and real business numbers.
2. Carry surrounding hypothetical-example context into deterministic decisions; distinguish field names from actual price/offer assertions without a global price-keyword exemption.
3. Align subjective/educational versus concrete-business-claim classification between reviewer and validator. Preserve explicit pricing, guarantee, duration, No-CTA and source-provenance protections, and retain negative counterexamples. The nine independently identified accuracy/risk/prevalence/limitation assertions must remain rejected or receive a source-safe correction; do not normalize them as harmless marketing.
4. Replay these captured decisions and all earlier captures without changing their text, then test the existing bounded correction/full-revalidation path offline, including the newly found assertions and publisher-facing leakage. Do not turn a reviewer rejection into silent acceptance.

Any later live validation would require a new explicit authorization. The remaining budget is not permission to retry this campaign. Production remains NO-GO until complete validated delivery succeeds and release is separately approved.
