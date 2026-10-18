# AI-first Studio Release Gates

Date: 2026-10-18. Repository `nads1983-coder/ContentOS`, existing branch `feat/ai-first-studio`, PR #3. Last verified production baseline: `6c75fab8e995e94c53bec400aed01991e1ee0642`.

## Verdict: NO-GO

Keep PR #3 in draft. The feasible implementation and isolated correctness gates pass, but the requested live baseline/candidate AI evaluation cannot run through the currently available secure credential path. No claim of improved writing quality, originality, latency, reliability or measured generation cost is supported. Actual benchmark calls: **0**. Actual API spend: **GBP 0 of GBP 5 authorized**.

The existing Vercel OpenAI Secret is configured. Connector access is denied and the supported CLI runtime-injection command fails locally. The owner declined making the key available in a local environment. No key was printed, committed, newly created or copied into source. The guarded runner can execute once a supported existing-secret runtime path is available, without changing production credentials. No further manual key-copy request is required for this release report.

## Completed Corrections

- Durable atomic image admission, monthly holds, per-account concurrency and attempt limits, stable UUID/fingerprint deduplication, successful accounting before response and bounded replay. Real row locks coordinate separate application instances; provider calls never hold a database transaction.
- Failed work releases only its application hold, not its attempt budget or provider spend. Uncertain completion never releases/re-dispatches; same-ID replay recovers a committed result. Expired IDs become terminal and require an explicit new attempt. Free template fallback is clearly disclosed and consumes no successful image credit.
- Bounded image request, provider response and result sizes; deadlines; no automatic provider/model retries; no URL-only image fetch. Client retains the request ID on network/uncertain failures, protects account changes, and keeps the original content while sending a bounded image excerpt.
- Read-only SQL projection removes text/image replay bodies and terminal IDs before transfer. Every write still re-reads the complete locked profile, preserving history, usage, billing and deduplication metadata.
- Text admission now persists 20 attempts/minute and 100/day per account, independent of success credits. Image admission permits six attempts/ten minutes, 100/day and two active requests. Retry-After is explicit; no automatic paid retry follows it.
- Auth hooks use the active adapter transaction instead of requesting a second pool connection. Password-reset pre-revocation participates in atomic token consumption, before credential mutation; failure rolls back consumption. Post-reset revocation remains defense in depth.
- Stripe signatures require freshness and support rotated v1 signatures. A delayed subscription deletion cannot replace a newer subscription under the row lock. Verified Founder/manual lifetime guards remain intact. Billing logs no longer print customer/session/account identifiers or raw errors.
- Passive device hydration no longer increments workspace revisions. Workspace uploads have a body deadline. Formatter navigation, filter selection semantics, zoom metadata, mobile menu Escape and native image-dialog keyboard behavior were corrected from observed usability failures.
- All 14 text formats, AI refinements, manual editing, undo, exports, image controls and existing plan entitlements remain. No runtime dependency, paid service, database schema or migration was added.

## Executed Validation

| Gate / command | Result and scope |
| --- | --- |
| `npm test` | PASS, 229/229, no skipped tests. Real route/helper logic with isolated mocks, including provider failures, replay, billing/lifetime, auth/reset faults, benchmark guard and read projection. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run build` | PASS, Next.js 16.3.8, 51 generated pages. |
| `git diff --check` | PASS. |
| `npm audit --omit=dev --json` | PASS, zero findings. |
| `npm audit --json` | Exit 1, seven high development-only findings; intentionally not reported as a pass. |
| `node scripts/benchmark-content.mjs --dry-run` | PASS, no network/provider calls; fixed default-tier gpt-5.2, six-request maximum GBP 3.413760 conservative reservation. 19 guard tests pass. |
| `tests/auth-isolated.mjs --browser --reset-faults` | PASS against existing isolated Neon and local production build, real Better Auth and PostgreSQL. See below. |
| `tests/image-isolated.mjs` | PASS, nine real-Neon checks; eight synthetic profiles cleaned up. |
| `npm run test:browser` with localhost:3212 | PASS, four mocked responses; manual edits, undo, targeted refinement, source retention, TXT export, injected failure/new-attempt recovery and local draft reload; 1440/768/390 widths; zero unexpected errors. |

The Neon launcher retrieves the existing isolated connection through the supported CLI into a private child-process pipe, validates the exact temporary branch endpoint/database and strips provider credentials. No connection string is in the repository, output or command arguments. Opt-in scripts themselves reject production/unknown endpoints and provider credentials. Existing temporary branch retained.

### Auth, Cloud and Recovery

Three concurrent signups completed with pool size three. Unverified login is refused; in-memory captured email callbacks preserve Founder intent. No email is sent. Independent authenticated sessions share the same cloud draft; stale compare-and-swap writes fail and another account stays unaffected. Password reset revokes both devices, rejects token reuse and preserves content. Injected revocation failure returns 500 before changing the password; the same token can retry. Concurrent retries produce one success and one rejection. Expired tokens do not revoke sessions. Logout is session/account scoped. Synthetic auth/profile fixtures are removed afterward.

The browser additionally used real login and account switching, selected/rendered all 14 formats with one mocked text response, generated/downloaded a real free image template, and checked 1440/768/390 layouts plus the four REA accessibility corrections. No unexpected console errors or page exceptions; the deliberately induced 409 network diagnostic is explicitly excluded. Email deliverability and a live provider success were not tested.

### Image Transactions

Actual Neon tests cover concurrent admission of the last credit, exactly-once successful accounting, same-ID and same-payload deduplication, concurrent attempt caps, idempotent failure release, forced SQL rollback, lost-acknowledgement replay, account isolation and terminal expiry. Projected reads retain usage/history/entitlements while subsequent locked writes preserve both ledgers and replay.

A synthetic one-million-character SVG produced a full serialized JSON document of 1,002,064 bytes versus 662 bytes for each projected read. Single observations were 175.15 ms full and 17.08-19.50 ms projected. These are one synthetic fixture's JSON bytes and timings, not a general latency benchmark, wire-byte measurement or Neon cost claim. Full-row mutations still have storage/write amplification.

### Existing Billing

Automated fixtures retain exact FOUNDING100 promotion enforcement, paid/already-Founder refusal, persistent claim coordination, permanent-versus-retryable webhook responses, repeated activation convergence and lifetime preservation after cancellation. New tests cover rotated/stale signatures and reordered recurring deletion. No live checkout, redemption, payment, cancellation, webhook replay or customer entitlement write was used as validation.

## AI Benchmark Findings and Blocker

Three paired synthetic briefs are prepared, each requesting all 14 formats from baseline and candidate. Maximum six attempts, including errors; no AI judge, image call or retry. Fixed model/default service tier, token/byte limits, conservative currency/pricing allowance, durable pre-call reservations and exclusive ledger locking bound spend below GBP 5. The live ledger has not been initialized and no paid calls ran.

All formats have **not measured** live quality, originality, brand consistency, latency, failure rate and actual cost. Strict structural fixtures are not a substitute. Shared all-format-pack cost/time will be reported per pack rather than invented per-format allocations. See [quality evaluation](ai-quality-evaluation.md) for the rubric, source hashes and operational caveats. Minimum unblock: a functioning supported runtime path to the existing authorized project key, without pasting it in chat or creating a replacement secret.

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
