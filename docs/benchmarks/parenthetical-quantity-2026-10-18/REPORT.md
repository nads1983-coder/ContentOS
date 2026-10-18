# Parenthetical quantity closure: offline evidence

**READY FOR CONTROLLED ACCEPTANCE CONTINUATION. Production remains NO-GO pending live acceptance and explicit launch approval.**

Based on PR #3 head `3093ce95d849ac21694b7ed1d6121f075afd2c79`. This is a targeted parser correction, not a new benchmark campaign or architectural change.

## Fix and original response

`lib/claim-scope.ts` previously stopped at the comma inside `(4 Arc, 8 Bond)` and assigned the main count of 12 to Arc instead of catalogue patterns. The main noun phrase now ignores parenthetical delimiters while retaining a separately validated quantity partition. Coordination outside parentheses remains separate, including UTF-16-safe offsets.

Each explicit partition must match a single source relationship: same subject/object, exact total, component sum, complete component set and individual quantities. Short labels must identify exactly one source component. Swapped quantities, missing/repeated components, incorrect product associations, unsupported totals, malformed partitions and label-first evasions are refused. Parentheses do not certify content or exempt it from semantic review.

The **unchanged original provider response passes all 48 certificate checks**. The original source, draft and response were not rewritten. The source supports `12 catalogue patterns (4 Arc, 8 Bond)`. Decisions u32 and u44 remain **unsupported**, with their original proposed replacements; acceptance of their certificate shape does not mean approval of their claims. No independent certificate defect remains in those 48 decisions.

## Complete offline delivery

The exact preserved draft was seeded into a new synthetic test reservation, with its original completed-generation metric. No generation request was made. Reservation age was rebased only in the synthetic fixture; no historical checkpoint or spending ledger was reopened.

| Check | Result |
| --- | --- |
| Formats / initial units | 14 / 307 |
| Initial review | 7 batches; 307 distinct units |
| Original response replay | 1 batch, unchanged 48 decisions |
| Explicit mock review responses | 13 batches across remaining initial review and fresh review |
| Bounded correction | 1 local pass |
| Fresh revalidation | 7 batches; all 307 distinct final units |
| Final persistence / successful usage | 1 history entry / 1 usage event |
| Repeated final request | No extra provider work, history entry or usage event |
| Incomplete fresh review | Refused; draft retained, no successful usage |
| Swapped-quantity replacement | Refused during correction before fresh review or save |
| New paid calls / spend | 0 / GBP0 |

The mock scenario also corrects six conservative guard rejections outside the captured batch: u51 (hashtag-set label), u117 (compressed sample-envelope wording), u121 (script-duration title), u128/u256 (inferred two-range summary), and u200 (repurpose-pack presentation count). Corrections remove presentation counts or use explicit source wording. These are **offline fixture decisions**, not new live reviewer findings or production substitutions. A compound sample statement uses explicit s20/s21 references; the generic mechanical fixture's limited source groups could not supply both. None of these cases prompted an exemption or production-validator weakening.

This demonstrates that the existing correction/revalidation path can resolve those conservative rejections. It does not prove that a live reviewer will choose valid replacements, approve legitimate language, or reject every unsupported claim.

Measured offline route execution: 16.67s, including local fixture processing; serialized review payloads: 50,077-55,275 bytes. These are not model latency or future spending estimates. See [offline evidence](offline-replay.json).

## Isolated database validation

Eight checks passed on the existing allowlisted temporary Neon branch, with provider credentials absent and network provider calls forbidden:

- Concurrent admission permits one stage; duplicate/lost-ack checkpoints are idempotent.
- Independent durable stages survive more than the former shared deadline.
- Final-save rollback retains the validated checkpoint without a successful usage charge.
- Concurrent saves converge on one history entry and one charge, preserving existing history and Founder entitlement.
- Cross-account checkpoint access is refused.
- Uncertain provider outcomes retain reservations and prohibit lease takeover/retry.
- This preserved 14-format pack completes correction, seven fresh-review batches and one real database save.

The pack's isolated database/mock execution took 11.55s. All synthetic fixtures were removed afterward. Existing audit records were not targeted. See [isolated results](isolated-delivery.json). The database driver emitted its existing forward-compatibility SSL-mode warning; the installed version treats `require` as `verify-full`. No connection-security setting was weakened.

## Commands executed

- Focused parser/captured-response/scope tests: 45 passed before adding the full-delivery cases.
- Final `npm test`: **593 passed, 0 failed, 1 opt-in historical-ledger SQL test skipped (594 total)**. Historical duration, layout, curriculum, pricing, No-CTA, structural, account, image, billing and Founder regressions remain passing.
- Isolated command: `node /tmp/contentos-isolated-run.cjs node tests/generation-stages-isolated.mjs --only-parenthetical --report=/tmp/contentos-parenthetical-isolated.json`: PASS, eight checks.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: blocked by the existing local Turbopack CSS-worker port-bind restriction, including elevated retry; not an application diagnostic.
- `npm run build -- --webpack`: PASS, TypeScript and all 51 pages.
- `git diff --check`: PASS.

No browser rerun: no UI or recovery-client code changed; existing browser evidence is retained, not claimed as rerun.

## Recovery and launch boundary

The public capture files are byte-for-byte unchanged from the parent commit. File hashes are recorded in the new offline evidence. The draft canonical SHA-256 is `9b4037c2e06bf366c29814dc602ef96de599f47c45ce0baa5bbfc22824f7da08` and matches the original private checkpoint's draft. Both private campaign audit exports remain readable and recoverable. Historical combined records still report **2 paid calls / GBP0.605550 retained reservation**; this work incurred no new API spend. No historical ledger, operator access or campaign was re-enabled.

The minimum next step, **only after separate approval**, is a manifest-bound continuation using this fixed candidate and the preserved draft. The unchanged first 48 decisions can be reprocessed locally, not purchased again. At most six remaining initial-review batches plus seven fresh-review batches would need new provider responses, subject to a new exact-payload/pricing/budget preflight and linked immutable prior accounting. No budget is requested or spent here.

Remaining release risk: live semantic accuracy, correction quality and end-to-end delivery remain unverified. Mechanical mock certificates do not establish final editorial or factual acceptance. The default build must also be confirmed in an unrestricted build environment for the new commit.

PR #3 stays draft. No paid APIs, benchmark deployment, production change, customer/Stripe change, merge or Founder retirement. The public Founder offer was not altered and remains governed by its existing active configuration. Production launch still requires the owner's explicit authorization.
