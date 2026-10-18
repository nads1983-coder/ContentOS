# Targeted offline classification closure

**READY FOR FINAL LIVE CONTINUATION - OWNER APPROVAL REQUIRED.** Production remains NO-GO pending complete live acceptance and separate launch authorization. Based on PR #3 commit `1aa8f6093dfad15a1c31d75d6c6ee7dd8cc532ef`.

## Two fixes

The only application change is in `lib/factual-grounding.ts`:

1. **Hashtag-set ordinals:** an Instagram/TikTok set label is annotated only when the actual three items contain correctly ordered, nonempty hashtag sets numbered 1, 2 and 3. Only the prefix is structural; every hashtag and any prose/number/offer after it still receives review. Wrong/duplicate/decimal/fractional numbering, missing sets, wrong formats and forged annotations receive no exemption. The complete hashtag item cannot be certified as structural.
2. **Physical cover noun:** narrowly identified physical-product noun phrases in nominal contexts no longer trigger the curriculum category. Only that occurrence is excluded from that one category check. The teaching verb, other curricular clauses, prices, quantities, guarantees, qualifications and capabilities retain their checks. This is not a whitelist for the word cover or automatic factual approval; an explicit valid review decision remains mandatory.

`Choosing a cushion cover starts with care, not colour` now accepts the captured subjective decision. `Our course covers cushion care` and mixed copy containing invented curriculum still refuse creative/subjective approval. Supporting source statements s6 and s12 also lose their erroneous curriculum metadata; their text, IDs and provenance do not change. The original source, draft and model responses are untouched.

## Exact evidence replay

Both original review responses parse unchanged: **48 + 48 = 96 valid certificates**. u49 remains creative and u68 remains subjective. The same six decisions remain **unsupported**: u32, u44, u50, u51, u58 and u87. Their original proposed replacements enter the bounded correction stage, not a silent approval path.

The initial full-suite run caught an outdated assertion expecting all historical source category metadata to match. The assertion now permits only the two identified curriculum-to-empty changes, while still checking every source statement/ID/provenance and the complete original source and pack. No captured evidence was edited to make this pass.

## Complete offline delivery

| Check | Actual result |
| --- | --- |
| Original draft | 14 formats, 307 units; no regeneration |
| Initial review | All 307 distinct units across seven batches |
| Original responses | Two replayed byte-for-byte, 96 certificates |
| Additional responses | Twelve explicitly mocked: five remaining initial, seven fresh |
| Bounded correction | One local pass |
| Fresh revalidation | All 307 distinct final units across seven batches |
| Final history / successful usage | One entry / one event |
| Repeated delivery | Same saved result, no extra review/save/usage |
| Unresolved fresh-review claim | Refused; draft preserved, no save or successful usage |
| Paid calls / new spend | Zero / GBP0 |

The existing offline fixture also supplies source-grounded repairs for five conservative guard rejections outside the captured reviews: u117, u121, u128, u200 and u256. These are **mock decisions**, not new model findings. They remain distinctly listed in [offline replay evidence](offline-replay.json). The original six unsupported certificates and their replacements are not altered.

Measured local route replay: **20.73 seconds**. Complete mock review payloads: **50,061-55,278 bytes**. These measurements include local fixture work and are not live-model latency, quality or cost estimates. A successful mechanical mock can establish orchestration, but cannot establish whether a model will make sound semantic decisions or provide valid replacements.

## Real isolated database checks

Eight checks passed using the existing temporary Neon branch and synthetic fixtures, with provider calls forbidden:

- One concurrent stage admission; duplicate/lost-ack checkpoint idempotency.
- Independently durable stages beyond the old shared deadline.
- Final-save rollback retains the validated checkpoint without charging.
- Concurrent final saves converge on one history entry and usage event, preserving retained history and Founder entitlement.
- Cross-account checkpoint rejection.
- Uncertain provider state retains reservations and prevents lease takeover/retry.
- This preserved pack completes both captured reviews, mocked remaining review/correction/fresh review and real final persistence. A repeated final request adds no entry or charge.

The pack's isolated database/mock execution took **21.21 seconds**, not a production performance result. Test fixtures were removed afterward; no historical campaign rows were targeted. See [isolated evidence](isolated-delivery.json). The existing driver emitted its forward-compatibility SSL alias warning; no connection-security setting was weakened.

## Commands and regressions

- Focused classification/captured-response tests: **7 passed**.
- Full-delivery and unresolved-fresh-review tests: **2 passed**.
- Final `npm test`: **607 passed, 0 failed, 1 opt-in historical-ledger SQL test skipped (608 total)**. Historical duration, pricing, No-CTA, source-scope, account, image, billing and Founder regressions remain passing.
- `node tests/final-classification-offline-report.mjs`: PASS.
- `node /tmp/contentos-isolated-run.cjs node tests/generation-stages-isolated.mjs --only-final-classification --report=/tmp/contentos-final-classification-isolated.json`: PASS, eight checks.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build -- --webpack`: PASS, 48 static pages plus dynamic routes. The known local default Turbopack port restriction was not repeatedly investigated. Exact-commit hosted default-build evidence, if available, is recorded in the PR.
- `git diff --check`: PASS.

No UI/auth/billing/image code changed; existing browser evidence was reused rather than rerun. Negative tests cover malformed structural labels, forged annotations, numeric business claims after valid labels, claim-bearing/CTA hashtags, actual teaching verbs, mixed noun/curriculum clauses, invented price/guarantee claims, and refusal of an unresolved fresh certificate.

## Preservation and remaining live boundary

Historical capture files are unchanged from the parent commit. Their hashes are recorded in the new offline evidence. The saved draft hash remains `9b4037c2e06bf366c29814dc602ef96de599f47c45ce0baa5bbfc22824f7da08` under the existing fixture serialization. All three private audits/checkpoints remain readable and closed. Historical cumulative reservations remain **GBP0.792508 across three completed paid calls**; this work adds none. No old ledger/operator was reopened.

Minimum remaining live work, **only after explicit approval**, is to revalidate/reuse both original responses locally against a manifest-bound corrected release, preserving all source text and recording the known classifier-metadata changes. Continue the remaining **211 initial units in five batches**, apply one bounded correction, then obtain a full fresh review of all final units, currently seven batches. This means **at most twelve new review calls**, no draft generation and no repetition of the three completed paid calls, provided corrected payload/unit bounds still fit preflight.

A fresh restricted continuation ledger must link all three immutable records and retain their cumulative spend. Recheck exact payload bounds, pricing/currency, key isolation and owner-approved limits before dispatch. Any uncertainty, invalid evidence, over-limit payload or unresolved final claim must stop without retry or unchecked delivery. Final success also requires independent factual/editorial assessment of all 14 assets, exactly-once live persistence/accounting and cleanup verification. No new budget or campaign is initiated by this report.

Finite lexical/structural tests and mocked semantic decisions are **not proof of live AI accuracy**. Other live reviewer disagreements remain possible. These two confirmed deterministic defects are fixed; a complete live validated pack is still a release gate.

PR #3 stays draft. No paid APIs, benchmark deployment, content regeneration, production write, merge, new service or Founder retirement. Founder remains ACTIVE. Production launch still requires explicit owner authorization; retirement may occur only after that authorized launch succeeds and is verified.
