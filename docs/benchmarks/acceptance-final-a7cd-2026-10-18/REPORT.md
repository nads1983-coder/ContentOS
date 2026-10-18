# Final live acceptance continuation: NO-GO

Approved application candidate: **`a7cd2c6ce6d62d78f4cc1670f0992afdf4f123cb`**, draft PR #3. The application source was not changed. This report records the one authorized continuation, not another benchmark proposal.

## Result

**NO-GO: two deterministic false-positive classifications reject the next complete reviewer response before bounded correction.** The provider completed normally in 15.304 seconds. This was not a timeout, missing response or budget failure. Execution stopped after one new call; no paid retry, correction, fresh review or final delivery occurred.

| Stage | Actual result |
| --- | --- |
| Original draft | Exact preserved 307-unit / 14-format draft, no regeneration |
| Original first review | 48/48 certificates reprocessed locally under the approved parser; original two unsupported decisions retained |
| Next initial-review batch | 48 decisions returned; 46 individually parse, two refuse; entire batch atomically rejected |
| Committed initial coverage | 48/307; receiving 96 decisions across the two calls is not 96 accepted units |
| Bounded correction | Not reached; four additional proposed replacements captured but not applied |
| Fresh final revalidation | Not reached, 0 units |
| Validated delivery | 0 packs |
| Final history / successful usage | 0 entries / 0 events |
| Draft/recovery state | Retained; failed attempt cannot repeat paid work automatically |
| Provider uncertainty / automatic retries | None / zero |

There are **no final validated assets to independently assess**. Final factual accuracy, publication readiness, full persistence, successful-usage exactly-once behavior and complete live recovery are not established by this run. Existing isolated evidence for those mechanisms is not relabeled as a live pass.

## Precise blocker and minimum correction

The unchanged response is in [execution.json](execution.json), with complete payload, source references, usage, response hash and per-unit diagnostics. The rejected decisions are:

1. **u49, Instagram hashtag item:** `Hashtags set 1: #cushioncover #textiledesign #homedecorstyle #fabriclove #slowhome #interiordetails #softfurnishings`. The reviewer returned `creative` with relevant source IDs. The server does not annotate the `Hashtags set 1:` ordinal from the actual Instagram item structure, so the residual digit triggers `hardClaim` and rejects the creative certificate. This is formatting, not a business quantity. Diagnostic-only removal of the prefix makes the same decision pass; the captured draft is untouched.
2. **u68, X/Twitter body:** `Choosing a cushion cover starts with care, not colour.` The reviewer returned `subjective`. `claimCategories()` treats the noun `cover` followed by `starts` as curriculum because its `covers?` pattern does not distinguish this product noun from the teaching verb. The same sentence with the diagnostic noun `textile` passes. This is a care-first editorial viewpoint, not a claim about course curriculum.

Both units have **no published deterministic findings**, yet the downstream creative/subjective certificate guard rejects them. Consequently the reviewer-facing classification guidance and the parser's final admissibility rules disagree. The failure prevents the four genuinely flagged/proposed repairs in this batch, and the two earlier unsupported decisions, from reaching the bounded correction stage.

Minimum safe next work is **offline only**: certify the hashtag-set prefix from real item positions/structure while continuing to review every tag, and distinguish physical-product noun usage of cover from curricular verb usage. Add adversarial cases for wrong ordinals, substantive numeric promises beside labels and genuine curriculum claims. Replay these exact responses without editing them and exercise correction/full fresh revalidation with explicitly mocked remaining responses. Do not globally exempt digits, hashtag contents, the word cover or subjective labels. No application fix was made during this acceptance run, and the other 259 units are not certified merely because these two defects are identified.

These characterization tests establish the two refusal mechanisms, not universal semantic correctness or an independently approved final pack. No additional live campaign should start automatically.

## Spending and timings

| Accounting | New continuation | Combined with both closed records |
| --- | --- | --- |
| Provider calls | **1** of maximum 13 | **3** of maximum 15 |
| Retained conservative reservation | **GBP0.186958** | **GBP0.792508** |
| Approved reservation ceiling | GBP2.47 | GBP3.08 |
| Usage-priced API cost | **USD0.02708265** | **USD0.13628790** |
| Reference-converted cost | approximately **GBP0.020309** | approximately **GBP0.102201** |

New response usage: **11,703 input tokens (7,808 cached), 1,350 output tokens, 13,053 total**. Serialized input body: **54,625 bytes**. Provider latency: **15.304s**; execution-to-stop: **17.522s**, excluding deployment/preparation/cleanup. All usage is known; failed validation does not refund the conservative reservation.

Current [OpenAI GPT-5.2 pricing](https://developers.openai.com/api/docs/models/gpt-5.2) was checked before execution: USD1.75/M input, USD0.175/M cached, USD14/M output. Reference GBP/USD is 0.84385/1.1253 from ECB 16 October ([GBP](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-gbp.en.html), [USD](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html)). GBP amounts are reference estimates, not a settled invoice/tax statement.

Preflight bounded every possible new call at 56,000 serialized UTF-8 bytes plus 4,096 input-token allowance, 4,800 output tokens, no cached-price discount and GBP1.10/USD. Thirteen worst-case new reservations total GBP2.464865; adding both retained records gives GBP3.070415. SQL enforces the new and cumulative ceilings, valid remaining stage keys and one reserved call at a time. No generation or first-review key is admissible. Failed/uncertain calls retain spend and close execution.

## Integrity, isolation and cleanup

- Exact candidate modules were frozen from Git and bound to a signed manifest. Both original private exports, published synthetic evidence and isolated Neon campaign/job/profile hashes matched before execution.
- Original source context, all 307 draft units and original response text were preserved. Reprocessing permits only the approved u47 diagnostic change from `missing_evidence` to empty; the actual source, unit text, instructions and response are unchanged. Original paid payload hashes/metrics remain recorded separately from the current revalidation-context hash.
- A **fresh** isolated ledger links both immutable records and starts at GBP0.605550. Neither closed campaign was reopened. A new synthetic attempt received a fresh 45-minute lifetime; this did not extend an expired customer job or rewrite the old checkpoint.
- Existing project protection was verified before deployment. The existing OpenAI credential stayed server-side, without export or replacement. The signed one-shot build exposes no execution HTTP endpoint. The temporary role had EXECUTE-only campaign functions and no direct access to auth/customer tables or either original ledger.
- Temporary Preview `dpl_8P7uKxxMGL5Nsgp1HiYaxDJWkfGU` completed its build; its unauthenticated URL returned protected HTTP 302. READY describes the deployment, **not acceptance success**.
- Cleanup disabled the campaign, set the runner NOLOGIN, revoked function/schema privileges, terminated sessions, exported evidence, deleted the plan-matched Preview and verified deletion. Local staging/temporary credential state was removed. The role remains revoked and the ledger/checkpoint remains retained as an audit, not executable access.
- A separate post-cleanup read-only check confirmed both historical campaign/job/profile hashes still match and runner login/schema access remain revoked.
- No production configuration, customer/account data, Stripe subscription/capacity, Founder entitlement or public offer state was modified. Founder remains ACTIVE. No PR merge or production deployment.

## Checks executed and evidence limits

- `node --test tests/acceptance-final-local.mjs`: three preflight tests passed before execution (signed authorization, payload/generation refusal, uncertainty/no redispatch).
- `node /tmp/contentos-isolated-run.cjs node tests/acceptance-final-isolated.mjs`: ten real isolated checks passed before execution, including both immutable records, restricted privileges, concurrent admission, cumulative budget refusal, reused-key rejection and retained uncertain spend. Test-only objects were cleaned up.
- `node --test tests/acceptance-final-evidence.test.mjs tests/acceptance-final-local.mjs`: six passed after capture. Three tests characterize the failed response, isolate the two lexical/structural causes and verify no delivery/usage plus successful cleanup. They intentionally document failures, not claim acceptance.
- Exported [execution evidence](execution.json), [unchanged synthetic brief](brief.json) and [preserved draft](raw-draft.json). Private full audits remain in `/tmp/contentos-final-a7cd`, `/tmp/contentos-live-acceptance-rc717` and `/tmp/contentos-continuation-rc717`; no temporary secret state remains in the new directory.
- Existing application build/typecheck/lint, 598-test suite, browser, auth/image/account-isolation and isolated persistence evidence from the approved candidate are reused, not rerun. Application code is unchanged. The prior default-build PASS remains applicable to the tested application source.

## Decision and next action

**NO-GO: the application cannot yet deliver this fully validated pack.** The narrow next action is authorization for the two targeted offline classification fixes and exact-evidence replay, with **no further API spend**. Do not expand scope, regenerate the draft, merge, launch or retire Founder. A further live continuation, if later justified, requires separate approval and reconciliation of all three retained records; unused allowance is not permission to repeat this failed run.
