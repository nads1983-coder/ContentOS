# Final acceptance and launch decision

Application candidate: `31ff29b8afa4aeccf76c737018372b6472f2ae55`, PR #3, `feat/ai-first-studio`. This update is a read-only calculator and release documentation, not an application change or live execution authorization.

## Decision

**NO-GO for the upgraded public AI-first launch today.** No known reproducible critical security, billing or cross-account defect remains in the reused local evidence. The actual blocker is essential AI delivery: no complete live, independently assessed, fact-checked pack has yet been delivered. The two last deterministic classifier errors are fixed; they are not being treated as permanent safety defects or reasons for a redesign. Offline success does not close the outstanding live gate.

| Category | Current decision |
| --- | --- |
| GO | Not established: complete live delivery, fresh model revalidation and independent final assessment remain outstanding. |
| CONDITIONAL GO | Not asserted for this unmodified public candidate. Fail-closed review prevents unchecked delivery, but a service that may deliver no AI packs is not commercially ready merely because it refuses unsafe output. A manual-only restriction requires explicit server-side admission controls and truthful product messaging, not just hiding a button. |
| NO-GO | Applies to public release of the upgraded AI generation pipeline until the single bounded acceptance continuation succeeds. No new general development cycle is proposed. |

Narrowest fallback if the owner declines live acceptance: keep the current production release and Founder offer unchanged. The independently tested upgraded manual editing/undo/export, account-scoped saving and history can be considered for a **manual-only restricted release**, with new staged text generation blocked at the server before admission/provider work and clearly unavailable in the UI. Keep established billing/Founder entitlements and existing customer content intact. Such a release needs a focused direct-route/no-charge isolation check and separate explicit approval; that restriction is **not implemented or claimed verified by this report**. Do not remove shared credentials or disable the existing image service as a shortcut. This fallback would not be a successful launch of the requested AI-first product, and is not recommended over completing the one acceptance gate.

## Verified cost envelope

Reproducible command, local only:

```sh
node scripts/acceptance-final/preflight-closure.mjs
```

The calculator rejects network use, verifies the three immutable private evidence file hashes and linked manifests, verifies provider outcomes/payload and response hashes, reuses both original responses unchanged, checks current source against the candidate, and emits only synthetic/sanitized evidence. No credential is loaded, no database is accessed, no ledger is opened and no provider request is made. Initial fixture comparison detected the deliberately rebased synthetic request ID; only that identity is excluded from source-content comparison. All content instructions, brand details, source text and 14 selected formats match exactly.

| Historical call | Retained reservation | Cumulative reservation |
| --- | ---: | ---: |
| Original generation | GBP0.419173 | GBP0.419173 |
| First review | GBP0.186377 | GBP0.605550 |
| Second review | GBP0.186958 | GBP0.792508 |

All three outcomes are complete and priced, not uncertain; all audits remain closed and hash-identical after calculation. Historical usage-priced total is USD0.13628790. Cumulative snapshots are **not** added together. The historical live database records must still be reconciled read-only against these files before a future authorized dispatch; this task deliberately performs no new database or infrastructure operation.

[OpenAI GPT-5.2 pricing](https://developers.openai.com/api/docs/models/gpt-5.2) was rechecked on 18 October 2026: default-tier text input USD1.75/million, output USD14/million; no caching discount assumed. No tools, priority tier, paid correction generation or automatic retries. [ECB GBP](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-gbp.en.html) and [ECB USD](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html) references for 16 October are 0.84385 and 1.1253 per EUR (approximately GBP0.74989/USD). The reservation conversion remains the much larger **GBP1.10/USD**.

Per-call micro-GBP reservation is `ceil(((serializedBytes + 4096) * 175 + 4800 * 1400) * 11 / 1000)`. UTF-8 serialized bytes plus 4,096 overhead are used as the conservative input-token bound; 4,800 is the hard output-token cap. The 56,000-byte ceiling gives at most 60,096 input tokens and **GBP0.189605 per call**, far below the model context limit. Runtime must refuse any different model/tier, tools, token cap or payload shape. Pricing, effective conversion and applicable billing surcharges must fit this bound at execution time; this is a conservative API-usage reservation, not a promise about an uninspected tax/card invoice. Stop before dispatch if that condition cannot be verified.

| Remaining initial batch (zero-based) | Units | Serialized bytes | Reservation GBP |
| --- | ---: | ---: | ---: |
| 2 | 48 | 54,421 | 0.186566 |
| 3 | 48 | 54,611 | 0.186931 |
| 4 | 48 | 54,592 | 0.186895 |
| 5 | 48 | 55,247 | 0.188156 |
| 6 | 19 | 50,061 | 0.178173 |
| Total | 211 | | **0.926721** |

Full body hashes and bounds are retained in [the machine-readable worksheet](benchmarks/final-approval-2026-10-18.json). The first 96 certificates already exist and are locally accepted, including six unsupported decisions that require correction. Do not purchase either review again or regenerate the draft.

| Bound | GBP |
| --- | ---: |
| Five exact initial payloads | 0.926721 |
| Seven possible fresh reviews at maximum size | 1.327235 |
| Hash-bound new / combined maximum | **2.253956 / 3.046464** |
| Uniform maximum for all 12 new calls | **2.275260** |
| Uniform maximum including all historical reservations | **3.067768** |
| Single proposed approval: new / combined hard ceiling | **2.28 / 3.08** |

Fresh reviewer replacements are unknown, so no exact future payload or guaranteed successful completion is claimed. The mock correction scenario fits all seven payloads: 54,308 / 54,716 / 54,392 / 54,645 / 54,587 / 55,278 / 50,095 bytes. Every actual fresh payload must independently fit 56,000 bytes, and final coverage must remain within seven batches (maximum 336 units), without truncation or removal of context. An oversized correction stops safely; it does not authorize more spend or incomplete delivery.

## Single fixed-cost approval request

**Approve one continuation with at most GBP2.28 NEW conservative reservations, GBP3.08 combined including GBP0.792508 already retained, and 12 new calls / 15 total calls.** Include one temporary protected Preview in the existing `content-os` project, the existing key accessed only server-side, and a fresh restricted atomic ledger on the existing isolated Neon infrastructure. No generation, repeat of completed calls, automatic paid retry, new paid service or production access.

Before dispatch, bind a fresh expiring manifest to this unchanged application candidate, original draft/request hashes, both accepted response hashes and all three immutable prior spending records. Rebase only the synthetic execution identity/deadline and record the approved classifier metadata differences; never alter source evidence or reopen a historical campaign. Reserve before dispatch, retain failed/uncertain reservations, and verify duplicate/concurrent admission, role isolation, authentication and cleanup with local/isolated checks. Existing operators are deliberately closed and cannot be reused unchanged. That bounded operator rebinding is execution preparation, not a product redesign.

Perform five initial batches, one bounded local correction pass and exhaustive fresh review across all final units. Stop on invalid evidence, uncertainty, unresolved material facts, safety-control failure or budget/coverage overflow. No retry campaign. Independently assess all 14 final assets; harmless editorial preferences are not launch blockers, but fabricated facts, incorrect source relationships, No-CTA violations and unusable delivery are. Verify one save, one successful-usage charge, duplicate replay and account isolation. Revoke temporary access/delete temporary deployment afterward, retaining audit evidence. Successful acceptance prepares a separate production approval request; it never authorizes merging, production deployment or retirement.

## Offline evidence reused and executed

- New calculator/exact-payload checks: PASS; 96 original certificates, all six unsupported preserved; all three historical records hash-verified and still closed.
- New complete application-route replay: **307/307 initial + 307/307 fresh units, 14 formats, one bounded correction, one history entry, one usage event, zero duplicate charge**. Two original responses and twelve explicitly mocked responses; not a live semantic-quality result.
- Existing same-application evidence reused: **607 passed / 0 failed / one opt-in skipped**, eight real isolated-Neon checks, typecheck, lint and webpack production build. No unrelated test campaign repeated. Existing browser/auth/image/Founder evidence remains as linked in the prior closure report.
- Exact candidate GitHub Vercel status: **SUCCESS**, ordinary build completed 2026-10-18 14:31:47 UTC. No benchmark deployment requested or created. This is build evidence, not customer-flow or live-generation evidence.
- This documentation/calculator change requires syntax and diff checks only; no application source or database schema changed.

Finite offline semantic fixtures do not establish live accuracy. Fail-closed recovery and atomic persistence are supported by the executable evidence; successful live delivery remains a separate requirement.

## Exact production procedure (not authorized or executed)

This section supersedes the old cost/approval proposal in [the earlier closure package](final-release-closure-2026-10-18.md); its detailed environment and retirement schema remain applicable.

1. **Acceptance gate:** record complete live outcome, final output assessment, coverage, spending, cleanup and exactly-once evidence. If any material condition fails, do not merge/promote or retire Founder. No further paid attempt without fresh approval.
2. **Owner gate:** obtain explicit approval for the exact final PR/release SHA and intended production change. Keep PR draft until acceptance passes. Do not infer approval from this worksheet or a successful build.
3. **Pre-release snapshot:** re-read the domain's current deployment/SHA, build status and project identity; record the verified rollback artifact and configuration privately. Previous production reference `6c75fab8e995e94c53bec400aed01991e1ee0642` / `dpl_HSnCfk4HP3V4iwsxKSfuDEnjiosH` is historical, not presumed current. Verify a recoverable Neon restore point and export only approved scoped backup material securely. Never print secrets or customer data.
4. **Configuration/schema gate:** verify the existing production database/Better Auth/Stripe targets, canonical URLs, ingress trust, runtime grants and Founder claim constraints read-only. This change needs **no migration**. Confirm all temporary runner routes/roles/access are removed or disabled. Stop for drift rather than applying unrelated repairs. Keep `FOUNDER_RETIREMENT_RECEIPT` unset and Founder ACTIVE.
5. **Release:** under explicit owner approval only, merge the reviewed PR and deploy/promote the corresponding reviewed code into the existing project. If merge changes the tree, rebuild and verify that exact artifact before promotion; do not promote a synthetic benchmark environment or its configuration. Preserve all production credentials, pricing, subscriptions, accounts and storage.
6. **Production verification:** verify READY, correct SHA/domain, public routes, Founder active surfaces, login/signup navigation, canonical URLs and sanitized auth/database/generation/billing logs. Use authorized isolated evidence for write flows. Do not consume a Founder place, purchase API work, send email or mutate customers as an unapproved smoke test. Record precise verification scope; confirm first real generation/transactions read-only as available.
7. **Hold or rollback:** any cross-account result, lost content, duplicate charge, changed entitlement or unchecked delivery blocks rollout completion. Follow rollback below. Do not call the launch verified while a required check is failing or unexecuted.
8. **Founder retirement gate:** only after separately authorized launch succeeds and verification passes, obtain/confirm explicit retirement approval. Populate the existing trusted operator receipt with matching approved/verified SHA, actual production deployment ID and ordered verification/retirement timestamps. Redeploy the same reviewed code with that receipt only. Verify closed surfaces/new-claim 410, standard prices unchanged and existing qualifying claims/lifetime access preserved. Do not modify Stripe capacity or cancel subscriptions. No retirement receipt is created here.

## Rollback procedure

1. Record incident, exact artifact, stage/checkpoint and sanitized failure category. Suspend promotion/retirement. No automatic provider retries or customer data repair.
2. Before retirement, restore the **verified pre-launch application artifact/configuration**, after checking compatibility with new persisted checkpoints. Do not restore an old database snapshot over newer accounts/content/usage. Preserve interrupted drafts/reservations; a prior app may not resume staged jobs, which must remain recoverable for a corrected staged release.
3. Confirm restored domain/deployment, auth, history, entitlements and Founder ACTIVE; inspect logs. Do not reset counters, replay webhooks or retry uncertain generation merely to make the smoke test pass.
4. After retirement, do **not** blindly promote a legacy/pre-receipt artifact: it can reopen Founder. Use a reviewed retirement-aware rollback artifact retaining the verified receipt, or a narrow forward fix. If neither exists, obtain explicit approval for an emergency admission-control plan; no silent Stripe changes.
5. Reconcile incident and first genuine post-release activity read-only; make any data repair only under separate evidence-backed authorization. No background automation or customer communication is initiated by this plan.

## Minimum owner decision

Approve or decline the **single GBP2.28-new / GBP3.08-combined, 12-new-call continuation** above. No launch approval is sought yet. No new product feature, broad redesign, additional historical benchmark or speculative improvement is required. PR #3 remains draft; production unchanged; Founder ACTIVE.
