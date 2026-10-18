# Contextual factual-review correction

## Verdict: NO-GO pending live delivery

This revision addresses captured classification defects in PR #3 on `feat/ai-first-studio`. It makes **zero paid API calls**, creates no benchmark deployment and changes no production data/configuration. Previous campaigns remain closed. Original captures, reviews, assessments and spending evidence are unchanged; their hashes are in [offline replay evidence](benchmarks/classification-2026-10-18/offline-replay.json).

Only two application modules change: `lib/factual-grounding.ts` and `lib/prompts.ts`. No timeout increase, new architecture, dependency, migration, usage limit, subscription rule, Founder rule, authentication change or image-generation change.

## Targeted fixes

| Captured disagreement | Contextual handling | Counterexamples still refused |
| --- | --- | --- |
| Universal modifier on an aesthetic impression | Recognize the bounded aesthetic predicate, retaining checks on every other clause. | Guaranteed results, product capabilities, numerical improvements, savings and adjoining promises. |
| Hypothetical cost/price field names | Server-derived local example/list context plus original-brief permission; noun-only field labels, no values. Scope ends at narrative or another asset. | Real prices, free offers, discounts, added delivery, no-example instructions and forged context. |
| Caption title ending `(3 options)` | Verify three populated sequential body captions. Keep topic text available for review; structural comparisons require supplied topics. | Wrong/missing/duplicate captions, business counts, unsupported topics and guarantees after a label. |
| Abstract separation reducing friction | Narrow relational/abstract predicate without measurable targets or business subject. | Product reducing friction, cost/error/time reductions, quantitative modifiers and second claims. |

The original first 48-decision response parses **unchanged**, including all four formerly rejected decisions and all seven original unsupported decisions. Unsupported decisions do not become approvals. Malformed, counterfeit, missing or duplicate certificates still fail closed.

New guards cover unsupported operational accuracy/data stability, error likelihood, concrete prevalence and categorical storage/capability limitations. All **nine independently identified material assertions** are mandatory negative regressions against all four approval classes. Actual source-backed cases remain possible; a citation must also contain the relevant relationship, not just an unrelated definition. These guards do not prove entailment or replace model review.

Further captured format shapes receive bounded annotations: actual-position email subject options and sequential beats with an optional-example cue. Labels cannot hide claims. Publisher-facing `Title idea:` and `Subject line options are below` are flagged for repair; useful script directions remain.

Two legitimate No-CTA cases retain context: a quoted conditional question with a grammatical continuation, and a tightly bounded negative explanation inside an empty CTA section. Direct questions, appended engagement commands, unrelated-field copies and forged context remain refused. No broad exemption applies to quoted questions or CTA vocabulary.

Generation/review guidance distinguishes subjective impressions, hypothetical fields, educational distinctions and objective claims. Source-grounded angle variety replaces repeated slogans; repairs must avoid repetitive fallback sentences and new facts. These prompt improvements are **not yet live quality measured**.

## Offline replay

| Capture | Initial units | Fresh final units | Mock calls | Local route | Isolated DB plus mock |
| --- | ---: | ---: | ---: | ---: | ---: |
| H1 | 228 | 228 | 11 | 143 ms | 2.774 s |
| H2 | 267 | 267 | 13 | 183 ms | 3.158 s |
| H3 | 224 | 224 | 11 | 159 ms | 2.631 s |
| Shelf Notes | 280 | 280 | 13 | 192 ms | 3.838 s |
| Total | **999** | **999** | 48 | Not live latency | Not model latency |

Each pack completes initial review, one bounded correction, complete fresh revalidation and exactly one history/usage write. Final replay makes no provider call. Draft and entitlement fields survive. The latest fixture contains 19 explicit unit repairs: seven captured reviewer repairs plus scripted regression/editorial corrections. The four originally legitimate phrases remain unchanged. Older publisher preambles receive a repair, not silent approval.

**Interpretation:** only the latest first 48 decisions are an actual captured live response. Other certificates and corrections are scripted/mechanical TEST fixtures. The [offline corrected pack](benchmarks/classification-2026-10-18/offline-corrected-pack.json) is diagnostic, **not independently certified live output**. The original independent assessment supplies nine negative cases, not an endorsement of this final pack. Earlier 70 regression fixtures are unchanged and exercised by the full suite.

Maximum serialized requests: H1 35,422 B; H2 37,796 B; H3 37,491 B; latest 39,311 B. Latest total: 475,364 B across 13 mocked calls. Its conservative application reservation is USD2.584345, **not incurred cost**. Actual new API cost is zero. These timings do not establish live review speed, token usage, false-positive rate or reliability.

Reproduce without provider credentials:

```sh
node --test tests/grounding-classification.test.mjs tests/classification-delivery.test.mjs tests/grounding-pipeline.test.mjs
node scripts/grounding-benchmark/offline-classification.mjs
```

## Executed checks

- `npm test`: **479 passed, 0 failed, 1 opt-in skip**, 480 total. Includes 11 new classification/delivery tests plus existing auth, image, billing, Founder, usage, isolation and recovery coverage.
- Typecheck, lint, production build and `git diff --check`: PASS. Next.js 16.3.8, 51 pages.
- `tests/generation-stages-isolated.mjs --include-classification`: **11 checks passed** on existing isolated Neon. Actual row locks, concurrent admission, rollback, lost acknowledgements, exactly-once persistence, isolation and retained uncertainty reservations. Four packs saved once with mock reviews. [Separate SQL evidence](benchmarks/classification-2026-10-18/isolated-delivery.json); historical evidence not overwritten.
- `tests/auth-isolated.mjs --staged-browser`: PASS on final local production build. Real isolated signup/verification/login/reset/cloud isolation/logout, no email. Seven mocked staged HTTP responses exercise draft preservation, lost acknowledgement, reload, same-ID recovery and all 14 corrected-fixture cards. Widths 1440/768/390, no overflow or unexpected browser errors. Not a live-provider browser test.
- Synthetic SQL/auth fixtures removed; existing audit and temporary Neon branch retained. Local test server stopped after checks. No production/customer writes or communications.

The pinned pg driver emitted its forward-looking SSL-mode alias warning; current semantics are verify-full. Local production-mode Better Auth also warned that localhost lacked the trusted `x-vercel-forwarded-for` header and used its shared per-path rate-limit bucket. The isolated HTTP harness supplies synthetic trusted headers; browser localhost does not emulate Vercel's forwarding. No rate-limit weakening, TLS downgrade or production config change. Historical seven development-only advisories are unchanged; manifests were not modified or re-audited here.

## Smallest live proposal

**Proposal only, not authorization/execution:** one new sealed synthetic brief, all 14 formats at short length, no baseline or historical rerun. One protected operator-only temporary Preview in the existing project, existing credential, fresh isolated atomic ledger, automatic cleanup and retained audit. Independently assess every final asset and verify full unit coverage.

Maximum **GBP2.70**, at most **13 paid calls**: one draft, six initial review batches and six final batches. Correction remains the existing local span repair, not paid regeneration. Limit initial and corrected packs to **288 units**, serialized payloads to **20,000 B draft / 40,000 B review**. Any excess stops without retry or unchecked delivery. Fixed default-tier model, no tools/automatic retries, 24,000/4,800 output-token caps; conservative input bound UTF-8 bytes + 4,096.

At the previously verified USD1.75/M input and USD14/M output rates, using the existing conservative GBP1.25/USD reservation conversion: **GBP0.472710 + 12 x GBP0.180460 = GBP2.638230** worst-case reservation. GBP2.70 rounds upward. Reverify pricing/FX and payload bounds before exercising any future approval; stop if this ceiling cannot be guaranteed. Failed/uncertain calls keep their entire reservation. This is a prospective upper bound, not actual spend or promised success.

The proposed run must allow unsupported *initial* units into bounded correction/full revalidation, unlike the prior campaign's stop-on-any-unsupported-decision policy. The purpose is to verify safe repair, never to publish raw defects. Stop on uncertainty, failed spending/access control, invalid evidence, unresolved final review or a material failure in independent assessment. No partial/unchecked delivery.

No budget, benchmark deployment or API execution was enabled here. PR #3 remains draft; production remains **NO-GO** until complete live fact-checked delivery succeeds and release is separately approved.
