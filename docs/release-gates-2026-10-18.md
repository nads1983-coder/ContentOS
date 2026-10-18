# AI-first Studio Release Gates

Date: 2026-10-18. Repository `nads1983-coder/ContentOS`, existing branch `feat/ai-first-studio`, PR #3. Last verified production baseline: `6c75fab8e995e94c53bec400aed01991e1ee0642`.

## Verdict: NO-GO

**Latest local correction:** [contextual classification and full replay](classification-correction-2026-10-18.md) resolves all four unchanged disagreements, guards nine independent material cases, and replays 999 initial plus 999 fresh final units across four packs. Full suite: 479 passes, zero failures, one skip; 11 real isolated SQL checks and final-build desktop/tablet/mobile recovery pass. No new paid call or benchmark deployment. Complete live delivery remains unverified; a single-pack GBP2.70/13-call proposal is documented, not authorized. Historical counts below describe their original revisions.

**Latest live result:** the separately approved [GBP4 staged-delivery validation](staged-live-validation-2026-10-18.md) ran once and is closed. Draft 50.446s, first review 10.641s, no timeout. However, the parser rejected four certificates in the 48-unit batch; zero of 280 units received accepted batch coverage and no validated pack was saved. Independent assessment found nine material unsupported assertions across eight raw formats; event duration and No CTA were preserved. Two paid calls cost USD0.09541175 (approximately GBP0.07155); GBP0.639420 remains reserved. Cleanup is verified. Both delivery and raw factual-quality gates remain failed; the minimum next work is local contextual validation and safe correction, not another paid run.

Keep PR #3 in draft. **The delivery architecture passes local gates, but no live validated pack has yet completed.** The [durable staged delivery report](staged-grounding-delivery-2026-10-18.md) supersedes the monolithic runtime: one bounded provider call per request, complete 48-unit review batches, atomic checkpoints, bounded correction and full revalidation, explicit same-attempt recovery. All 719 captured units complete with mocked reviews; real isolated Neon and desktop/tablet/mobile recovery checks pass. Those checks did not establish live model speed, accuracy or reliability. The subsequent authorized live check is reported above, separately from the original no-spend implementation work.

Historical evidence: **the authorized GBP9 held-out grounding benchmark failed the release gate.** Six draft calls produced 84 assets; the first candidate review ended uncertain at the shared deadline, immediately stopping further calls. No candidate pack completed grounding. Both independent blind reviewers found zero material failures in the 42 candidate raw drafts versus 13 critical baseline asset rows; mean scores were 18.29 versus 15.62, with slightly lower candidate originality. These are not delivered-quality results. Seven paid calls were admitted, no retry; GBP4.262720 remains permanently reserved, including GBP0.848960 for the uncertain call. Confirmed usage subtotal is USD0.37024225 (about GBP0.27764), not a fully reconciled total. See [controlled benchmark evidence](controlled-grounding-benchmark-2026-10-18.md) for blind assessment, exact timings, cost limits and cleanup. The Preview was deleted, temporary database access revoked, and audit retained. No production or customer-data changes occurred.

The older, separate GBP5 campaign (six paired requests plus three corrected-candidate requests) remains closed at GBP4.804294 reserved and USD0.50587425 usage-priced cost. Its two Preview deployments were already removed and all nine audit rows preserved. The fresh campaign did not reset or reuse that authorization. No new OpenAI key/account, service or Vercel project was created.

## Completed Corrections

- Replaced the shared-deadline generation route with durable, account-scoped provider stages. Full source and cross-format context accompanies every compact review batch; all units are re-reviewed after correction. Stage leases are never stolen, unknown work is never automatically retried, successful final persistence is atomic, and exact-payload spending reservations fail closed. No schema migration or new dependency. Details, measured payloads, recovery limitations and live proposal: [staged delivery](staged-grounding-delivery-2026-10-18.md).

- Added server-side source provenance, exhaustive unit review across all 14 formats, deterministic claim guards, one bounded correction/revalidation pass and fail-closed delivery. Ten new route tests, 106 grounding tests/subtests, 70 synthetic fixtures, and browser error recovery cover actual behavior. Details and semantic limitations: [factual grounding](factual-grounding-2026-10-18.md). The subsequently approved [held-out evaluation](controlled-grounding-benchmark-2026-10-18.md) ran and failed; no candidate delivery or semantic accuracy pass is claimed.

- Durable atomic image admission, monthly holds, per-account concurrency and attempt limits, stable UUID/fingerprint deduplication, successful accounting before response and bounded replay. Real row locks coordinate separate application instances; provider calls never hold a database transaction.
- Failed work releases only its application hold, not its attempt budget or provider spend. Uncertain completion never releases/re-dispatches; same-ID replay recovers a committed result. Expired IDs become terminal and require an explicit new attempt. Free template fallback is clearly disclosed and consumes no successful image credit.
- Bounded image request, provider response and result sizes; deadlines; no automatic provider/model retries; no URL-only image fetch. Client retains the request ID on network/uncertain failures, protects account changes, and keeps the original content while sending a bounded image excerpt.
- Read-only SQL projection removes text/image replay bodies and terminal IDs before transfer. Every write still re-reads the complete locked profile, preserving history, usage, billing and deduplication metadata.
- Text admission now persists 20 attempts/minute and 100/day per account, independent of success credits. Image admission permits six attempts/ten minutes, 100/day and two active requests. Retry-After is explicit; no automatic paid retry follows it.
- Auth hooks use the active adapter transaction instead of requesting a second pool connection. Password-reset pre-revocation participates in atomic token consumption, before credential mutation; failure rolls back consumption. Post-reset revocation remains defense in depth.
- Stripe signatures require freshness and support rotated v1 signatures. A delayed subscription deletion cannot replace a newer subscription under the row lock. Verified Founder/manual lifetime guards remain intact. Billing logs no longer print customer/session/account identifiers or raw errors.
- Passive device hydration no longer increments workspace revisions. Workspace uploads have a body deadline. Formatter navigation, filter selection semantics, zoom metadata, mobile menu Escape and native image-dialog keyboard behavior were corrected from observed usability failures.
- All 14 text formats, AI refinements, manual editing, undo, exports, image controls and existing plan entitlements remain. No runtime dependency, paid service, application/production schema or migration was added.
- Added isolated operator-only benchmark scripts and 18 additional unit tests, plus 18 real-Neon ledger checks. This creates only a dedicated benchmark schema on the existing temporary branch, not an application or production migration. Scripts expose no HTTP endpoint and are not part of the app build.
- Added prompt mitigations for source-number meaning, unsupported personal experience/offers/curriculum, publisher-facing commentary and No CTA precedence, with two instruction-delivery tests. These improved some live defects but did not fully resolve factual grounding; no successful final quality gate is claimed.

## Executed Validation

| Gate / command | Result and scope |
| --- | --- |
| `npm test` | PASS, latest live-validation evidence revision: 468 passed / 0 failed / 1 opt-in isolated SQL test skipped (469 total). Prior app/grounding/benchmark/annotation tests remain included. Twelve new campaign/captured-failure checks pass. Mocked semantic decisions are not a live accuracy certification. Historical isolated ledger/delivery suites remain separately scoped; the new campaign SQL suite passed 10 checks. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run build` | PASS, Next.js 16.3.8, 51 generated pages. |
| `git diff --check` | PASS. |
| Final GBP4 staged live validation | FAIL delivery gate: 2 completed calls, draft 50.446s, review 10.641s, no timeout/uncertainty/retry. 48 returned decisions, 4 refused certificates, 0/280 accepted batch coverage, no validated history/usage. USD0.09541175 known usage; GBP0.639420 retained reservation. Temporary deployment/access removed; audit and draft retained. |
| Staged delivery focused tests | PASS, 46/46 route/pipeline/client cases. All 719 captured units, 24 corrected format-number false positives, complete correction/revalidation, quota, exact payload caps and failure recovery. |
| `tests/generation-stages-isolated.mjs` | PASS, 10 real-Neon checks; actual row-lock/rollback/isolation tests and three captured 14-format packs with mock reviews. Complete isolated execution 1.553/1.652/1.413 seconds, excluding model latency. Synthetic profiles cleaned up. |
| `tests/auth-isolated.mjs --staged-browser` | PASS, isolated auth checks plus lost-acknowledgement/reload/same-ID recovery through 7 mocked staged HTTP responses. All 14 cards at 1440/768/390, no unexpected browser errors or horizontal overflow. Hydration race fixed and rerun passed. |
| `npm audit --omit=dev --json` | PASS, zero findings. |
| `npm audit --json` | Exit 1, seven high development-only findings; intentionally not reported as a pass. |
| Historical benchmark tooling | Archived prompt-only candidate pinned; live/init/setup/deploy entry points disabled pending a new pipeline-specific authorization. 20 budget guard tests and 18 Preview tests pass. This tooling is not evidence of new pipeline quality. |
| `node --test tests/benchmark-preview.test.mjs tests/benchmark-budget.test.mjs` | PASS within full suite, 38/38, including 18 signed-manifest/runtime/atomic-dispatch/follow-up/failure tests and the new closed-entry-point test. |
| Isolated benchmark ledger test | PASS, 18 real PostgreSQL checks: restricted access, null-safe binding, rollback, concurrent admission, uncertainty, durability, idempotency, expiry, exact/cumulative caps, prior-row preservation, old-job refusal and automatic close. |
| Temporary benchmark dependencies | PASS, locked pg-only staging dependency audit, zero advisories; install scripts disabled. |
| Fresh GBP9 benchmark safety | PASS: 16 runtime/closed-entry tests, 33 cleanup/recovery checks, 7 SQL structural checks; separate isolated Neon run 18/18 including 10 behavioral subchecks. No paid requests in tests. |
| Post-benchmark annotation fix | Historical PASS: 15 new behavior tests; then 148/148 focused grounding/route tests. All annotation protections remain in the current full suite. Format labels are server-certified by field/sequence/count, not a numeric whitelist. Fractions, decimals, prices, guarantees, duration, No CTA and forged metadata remain guarded. Staged architecture is now locally tested; live delivery remains unverified. |
| Fresh held-out pipeline benchmark | FAIL: 6 drafts / 84 assets captured; first candidate review uncertain at shared deadline; 7 requests total, no retry, 0 validated candidate deliveries, 2 candidate review pipelines unattempted. Cleanup verified; see [full results](controlled-grounding-benchmark-2026-10-18.md). |
| Live paired benchmark and follow-up | 9/9 completed, 126 sections across all 14 formats. Original/corrected candidate contract acceptance 6/6. Factual-quality gate FAIL; see below. |
| `tests/auth-isolated.mjs --browser --reset-faults` | PASS against existing isolated Neon and local production build, real Better Auth and PostgreSQL. See below. |
| `tests/image-isolated.mjs` | PASS, nine real-Neon checks; eight synthetic profiles cleaned up. |
| `npm run test:browser` with localhost:3212 | PASS, four mocked responses; manual edits, undo, targeted refinement, source retention, TXT export, injected failure/new-attempt recovery and local draft reload; 1440/768/390 widths; zero unexpected errors. |
| Grounding recovery browser rerun, localhost:3213 | PASS, four mocked responses, real production-build UI, 1440/768/390 widths. `grounding_failed` retains copy and enables an explicit new request ID. No provider/database credentials; no paid calls. Screenshots in `/tmp/contentos-grounding-browser`. |

Rows unrelated to staged delivery retain their previously executed scope, not a claim of another rerun. Dependency manifests did not change, so audits were not repeated for this correction. The Neon launcher retrieves the existing isolated connection through the supported CLI into a private child-process pipe, validates the exact temporary branch endpoint/database and strips provider credentials. No connection string is in the repository, output or command arguments. Opt-in scripts themselves reject production/unknown endpoints and provider credentials. Existing temporary branch retained.

### Auth, Cloud and Recovery

Three concurrent signups completed with pool size three. Unverified login is refused; in-memory captured email callbacks preserve Founder intent. No email is sent. Independent authenticated sessions share the same cloud draft; stale compare-and-swap writes fail and another account stays unaffected. Password reset revokes both devices, rejects token reuse and preserves content. Injected revocation failure returns 500 before changing the password; the same token can retry. Concurrent retries produce one success and one rejection. Expired tokens do not revoke sessions. Logout is session/account scoped. Synthetic auth/profile fixtures are removed afterward.

The browser additionally used real login and account switching, selected/rendered all 14 formats with one mocked text response, generated/downloaded a real free image template, and checked 1440/768/390 layouts plus the four REA accessibility corrections. No unexpected console errors or page exceptions; the deliberately induced 409 network diagnostic is explicitly excluded. Email deliverability and a live provider success were not tested.

### Image Transactions

Actual Neon tests cover concurrent admission of the last credit, exactly-once successful accounting, same-ID and same-payload deduplication, concurrent attempt caps, idempotent failure release, forced SQL rollback, lost-acknowledgement replay, account isolation and terminal expiry. Projected reads retain usage/history/entitlements while subsequent locked writes preserve both ledgers and replay.

A synthetic one-million-character SVG produced a full serialized JSON document of 1,002,064 bytes versus 662 bytes for each projected read. Single observations were 175.15 ms full and 17.08-19.50 ms projected. These are one synthetic fixture's JSON bytes and timings, not a general latency benchmark, wire-byte measurement or Neon cost claim. Full-row mutations still have storage/write amplification.

### Existing Billing

Automated fixtures retain exact FOUNDING100 promotion enforcement, paid/already-Founder refusal, persistent claim coordination, permanent-versus-retryable webhook responses, repeated activation convergence and lifetime preservation after cancellation. New tests cover rotated/stale signatures and reordered recurring deletion. No live checkout, redemption, payment, cancellation, webhook replay or customer entitlement write was used as validation.

## Historical GBP5 Benchmark Evidence

Three paired synthetic briefs requested all 14 formats from actual baseline/candidate prompt and schema modules. Fixed gpt-5.2/default tier, 24,000 output-token cap, 90-second deadline, no tools/images, no automatic retry and no API judge calls. Execution window: 2026-10-18 07:47:02-07:51:04 UTC. All six calls completed, returning 42 baseline and 42 candidate sections. All three candidate outputs passed the current strict contract; baseline outputs did not pass the new contract, which is not evidence that their old parser would fail.

Candidate median pack latency was 43.474 seconds versus 37.797 baseline (15.0% slower in this small sample). Aggregate candidate cost USD 0.16436175 versus USD 0.16534175 baseline (0.59% lower). Total usage 14,386 input / 21,752 output tokens, zero cached input; estimated total GBP 0.2487943 at the documented reference rate. This is token-priced usage, not an invoice/tax reconciliation. No per-format latency/cost allocation is invented. Six successes do not certify a population reliability rate. See [quality evaluation](ai-quality-evaluation.md) for exact results, rubric and limitations.

The original blind review scored 84/84 rows: baseline mean 12.31/20, original candidate 13.60/20. Higher averages did not override critical factual/CTA defects. After prompt mitigation, the separately approved recheck completed 42 corrected sections: contract 3/3, median 49.024 seconds, aggregate USD 0.17617075. Across both runs: 23,927 input and 33,143 output tokens; zero cached input, retries or uncertainty. The follow-up is an unblinded failure recheck on known briefs, not a new blind or held-out score.

### Secure Execution and Cleanup

Earlier read-only investigation resolved the CLI launch issue but found that Vercel Secret values are withheld from local `env run`. The owner declined local key sharing. No secret export or replacement was used. After explicit Preview authorization:

- Reverified existing project and unchanged Vercel SSO protection. One seven-file, pg-only temporary build in `content-os` used the existing Preview OpenAI credential in memory, with no application imports or execution endpoint. Unauthenticated access returned 302 to `vercel.com/sso-api`.
- Exact signed payloads, project/environment/endpoint checks, role privilege checks and immutable campaign/job hashes precede dispatch. Atomic PostgreSQL admission permanently reserves each worst-case attempt before networking; SQL transactions end before the API call. Unknown outcomes cannot be refunded or retried. SQL NULL comparison defects found during review were fixed and tested before any paid call.
- The dedicated runner role cannot read auth/application schemas or directly manipulate ledger tables. Function access is limited to campaign inspection, admission, completion and disable; no reset/enable path is exposed. A three-hour expiry, automatic terminal disable and fail-closed state prevent restart/replay spend.
- After six completions, campaign `enabled=false`, reason `complete`, reservation GBP 3.413760. Cleanup disabled login, revoked function/schema access and terminated runner sessions. Audit rows and private synthetic evidence remain on the existing temporary branch; no customer tables were queried.
- Temporary deployment `dpl_2GMMCWAogi3bou5Mv5jCkqmnwcVC` reached READY, was removed, and returned 404 afterward. Local staging and revoked credential file were removed. No benchmark runtime endpoint or deployment remains. The existing application preview and production were untouched.
- Separately approved follow-up `dpl_FppXMhbcY1DMRwB4m6GaF41ApMo5` also reached READY, was removed and returned 404. Its exact-byte reservations append to the original six; cumulative GBP 4.804294 remains recorded. The continuation authorization retains original completion metadata. Cleanup again revoked/disabled the role and terminated sessions; staging/credential files were removed. All nine rows remain and the campaign is disabled.

The GBP 5 ceiling was not increased. Prompt corrections were made after the observed live defects, so full tests, typecheck, lint, build and production dependency audit were rerun. Earlier isolated auth/image/browser evidence remains scoped to those unchanged subsystems and is not represented as a new execution.

### Remaining Quality Blocker

Prompt mitigations explicitly preserve the meaning of source numbers; prohibit invented timings, personal success, extra offers and unlabeled curriculum; and make No CTA override platform engagement guidance. Mocked assertions verify instruction delivery, not model compliance. The live follow-up resolved earlier engagement questions, timing inventions and extra fulfillment promises in several places, but two reviewers independently confirmed remaining material failures:

- The fictional class's 45-minute duration becomes a promise to organize the workspace in 45 minutes in an email subject and CTA option.
- The model invents specific storage-zone assignments and presents them as curriculum, across thread, script, carousel and repurposed carousel.

Publisher-facing CTA instructions and categorical population claims also remained editorial risks in that historical run. Stronger prompts alone did not establish a pass. The newer grounding/claim-validation correction was subsequently evaluated under a separate explicit GBP9 authorization; that campaign's deadline/uncertainty failure is documented above. Exact quotations and deterministic checks do not guarantee semantic entailment; false positives and missed claims remain possible. The old GBP5 headroom was not reused. All benchmark authorizations are now closed. The latest staged implementation has only the separately stated, unexecuted live proposal linked above.

## Residual Risks and Boundaries

1. Seven development-only findings share the unpatched `braces` stack-exhaustion advisory. No compatible fixed release was available. npm's suggested Tailwind major/Next ESLint downgrade is not a safe patch. Run untrusted builds in isolated, secret-free environments; see [dependency assessment](dependency-security.md). No suppression was added.
2. Image replay is capped at 10 MB/eight results/24 hours per account but remains profile JSON. Locked writes fetch/rewrite it; 10,000 image identities fail closed pending maintenance. Text terminal hashes still grow over the long term. Do not delete identities as a shortcut because old IDs could spend again.
3. Ordinary subscription deliveries are entitlement-idempotent, not a durable event-ID journal. Remote reconciliation is not a universal ordering guarantee. The confirmed stale-deletion bug is fixed; broader event journaling remains hardening work.
4. Auth reset token consumption/revocation is atomic, not the entire multi-step password endpoint. Later failures can require another reset. Metadata failure cannot leave the old sessions usable. Real email delivery, ingress IP-header overwriting, sustained load, physical-device zoom, full screen-reader conformance and Core Web Vitals were not certified.
5. Per-account budgets limit abuse but are not a global provider monetary cap or Sybil defense. Existing email verification and database-backed auth/IP limits remain; do not equate the benchmark budget with a production spending limit.

## Deployment and Operations

PR remains draft and must not be merged or promoted. A push to its existing non-production branch may create a Vercel preview; final preview identity and smoke result are recorded in the PR description. Preview readiness alone does not close the live AI gate. Do not run authenticated preview tests against production-connected resources.

No production data, schema, credentials, Stripe capacity, customer communication or deployment promotion was changed. Only UUID-scoped synthetic records on the pre-existing validation branch were created/removed. During the failed Vercel runtime-injection attempt, the CLI created an unintended empty project; it was verified to have zero deployments, removed, and the local ignored project link restored to `content-os`. The production project was not modified.

Supporting reports: [security](security-release-review.md), [image reservations](image-generation-reservations.md), [usability/REA](usability-release-checks.md), [implementation](ai-first-implementation.md). Local screenshots are in `/tmp/contentos-auth-browser` and the REA report's evidence directory; they are not committed and are subject to temporary-file cleanup.
