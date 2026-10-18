# Full text release: focused closure and activation decision

## Decision

**Full public text release: NO-GO pending complete live delivery. Owner-only controlled activation: prepared, NOT deployed or approved.**

This supersedes the activation proposal in `restricted-launch-approval-2026-10-18.md`, not its historical evidence. PR #3 remains draft. The exact commit containing this report is recorded in the PR and completion message. No paid API calls, manually requested deployments, production writes, customer access, billing changes, Founder retirement or ledger reopening occurred in this work. Pushing application commit `745670180e7cc8ad3819de055fefb5f773435a05` triggered the existing Git integration's ordinary Preview `dpl_8D8E7PX3VfBwMWoDbbDidUzjHZx1`, verified READY at `content-oue6deijz-nads1983-9570s-projects.vercel.app`. This was not a temporary benchmark deployment or a production/pilot activation; no provider-backed Preview test was executed. This documentation follow-up does not change that application's code.

The minimum next owner decision is whether to approve deploying this exact application in authenticated owner-only pilot mode. This is not general text enablement or permission for another benchmark. No paid execution is initiated under the current instruction. Actual owner use would incur the ordinary provider costs and must be explicitly included in any subsequent activation approval; no amount, account or authorization is assumed here. Public expansion requires a completed, independently assessed live fact-checked delivery and a separate activation approval.

## Verified production, not assumed deployment

Read-only production inspection on 18 October 2026:

| Item | Evidence |
| --- | --- |
| Vercel project | `content-os` / `prj_aO6mDTNkCKe5jzepGPCvzOWy1eBS` |
| Production deployment | `dpl_HSnCfk4HP3V4iwsxKSfuDEnjiosH`, READY |
| Production commit | `6c75fab8e995e94c53bec400aed01991e1ee0642`, main |
| Deployment hostname | `content-cim94k0qq-nads1983-9570s-projects.vercel.app` |
| Restricted PR #3 rollout | **Not deployed** |
| Production pause setting | `CONTENTOS_TEXT_GENERATION_MODE` absent from production environment metadata |
| Founder retirement setting | `FOUNDER_RETIREMENT_RECEIPT` absent from production environment metadata |
| Public surfaces | `/login`, `/signup`, `/pricing`, `/founder` return 200; Founder claim link active, no retired notice |
| Upgraded cloud workspace endpoint | `/api/workspace` returns 404 on current production; this PR route is not deployed |

Environment inspection used names/targets only, not decrypted credentials. Database, Better Auth and Stripe configuration names are present. The retired `/api/auth/session` GET returns 405 because the old endpoint is POST-only; this is not evidence of broken Better Auth. The production generation source still implements the old direct generation route, not this PR's staged grounding system or pause/pilot gate. Setting a flag on that old artifact alone would not activate the reviewed implementation.

No authenticated customer login, cloud write, purchase, customer subscription inspection or production data reconciliation was performed. Healthy public pages do not prove those transactions. Existing isolated auth, cloud saving, multi-device/CAS, billing and image evidence is retained in `technical-readiness-2026-10-18.md`, `security-release-review.md` and `usability-release-checks.md`; relevant behavior also remains in the passing automated suite. Founder lifetime protections remain unchanged in code and tests, not asserted from a new customer-data inspection.

## Smallest confirmed corrections

1. **Physical product noun:** `cushion cover pattern/range/design` no longer becomes a teaching/curriculum verb. Actual teaching clauses and numerical, promise and capability checks remain enforced. This fixes captured creative unit `u124` without a blanket word exemption.
2. **Initial supported certificate disagreement:** a well-formed model decision that conflicts with local factual checks is not certified. Where it cites an exact, complete current-brief statement that itself passes strict guards, the server downgrades it to **unsupported** and proposes that statement through the existing single correction pass. No truncated quote, saved-brand fallback, absent/forged reference or final-pass rescue is allowed. Full fresh review remains compulsory.
3. **Unsafe proposed title repair:** only a title already selected for correction can fall back to its actual trusted format label when the proposed replacement still fails deterministic checks. Bodies and untouched titles are not rewritten this way. Captured `u121` tried to retain an ungrounded `25-40 seconds` duration; it becomes `Short Video Script`, then is freshly reviewed.

The third original 48-decision response now processes in full. `u117` (sample/postage relationship and missing geographical qualifier) and `u128` (two ranges inferred as a company-wide count) are **not newly approved**: they are downgraded to source-grounded correction. The original model's unsupported `u98` and `u121` remain unsupported. The earlier six unsupported decisions are retained. The 144 captured decisions are evidence of model responses, not 144 supported claims. Original files, response text, source and draft hashes are unchanged; all spending ledgers stay closed and recoverable.

Malformed certificates still fail. Creative/subjective/structural misclassifications still fail where guards disagree. A final-review disagreement still fails; no second correction loop or automatic paid retry has been introduced. Current-brief copying can reduce editorial variety and cannot independently establish semantic publication quality. Fresh semantic review and independent live assessment remain required.

## Executed evidence

Machine-readable results: [offline replay](benchmarks/text-release-offline-2026-10-18/offline.json), [isolated PostgreSQL](benchmarks/text-release-offline-2026-10-18/isolated.json), [local browser](benchmarks/text-release-offline-2026-10-18/browser.json).

| Check | Actual result |
| --- | --- |
| `npm test` | 620 passed, 0 failed, 1 opt-in ledger-database test skipped |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `CONTENTOS_TEXT_GENERATION_MODE=pilot npm run build -- --webpack` | PASS, local production build |
| `git diff --check` | PASS |
| `node tests/review-disagreement-offline-report.mjs` | 3 unchanged captured reviews + 11 explicit mock reviews; 307 initial / 307 fresh units; all 14 formats; one correction pass; one save and usage charge; duplicate no-op |
| `tests/generation-stages-isolated.mjs --only-disagreement` via secure isolated helper | 8 real Neon transaction checks passed; synthetic fixtures removed; no production connection |
| `tests/restricted-release-browser.mjs`, pilot mode | PASS at 1440/768/390px; zero page exceptions, overflow or generation HTTP calls for restricted users |

The isolated replay exercises real row locks, concurrent admission, repeated/lost-ack checkpoints, rollback before final save, concurrent final saves, preserved history/Founder entitlement, cross-account refusal and terminal uncertain-provider recovery. The preserved 14-format pack persists exactly once with one usage event; duplicate save adds neither. Reported 12.73 seconds is database/local/mock time, **not model latency**. Offline replay takes 6.69 seconds and serializes review requests of 50,061-55,337 bytes; it does not measure live reliability or cost.

New route tests also exercise owner admission, empty/other-account allowlists, account switching, targeted refinement using the same factual pipeline, final-review rejection, no successful charge on rejected content and preserved drafts. Browser checks cover manual edit/undo, text export, draft reload, public disclosure, active Founder claim links and anonymous API refusal. The browser is credential-free; authenticated pilot behavior is route-tested with mocks, not represented as a live sign-in test.

During verification, existing tests expecting every initial disagreement to be terminal were updated to require explicit unsupported correction plus strict final rejection. A fixture expected two source sentences where the correction intentionally uses one complete cited source statement; that assertion was corrected. Final runs pass. No prior semantic expectation was changed to approve the disputed claim.

No schema or dependency changes. `git diff origin/main -- drizzle lib/db/schema.ts` is empty. Prior production dependency audit was clean; seven development-tool advisories and their isolated/trusted-build restrictions remain documented in `dependency-security.md`. No redundant audit campaign was run. The isolated pg8 driver emitted its existing future-pg9 SSL semantics warning; no driver change or weakened TLS configuration was made.

## What is not yet verified

- Latest successful live generation produced the preserved 307-unit draft. Three historical live review responses cover the first 144 initial units. Four initial batches and all seven fresh-review batches have **not** completed live under the corrected application.
- Consequently no complete live fact-checked pack, independent final publication assessment or current hosted application end-to-end delivery is claimed. Offline mocks establish orchestration and transaction correctness, not live semantic quality.
- The old acceptance campaigns remain closed. New spend this work: **GBP0, zero provider calls**. Last retained historical conservative reservations remain **GBP0.979074**; no accounting reset/refund was made. No further budget request accompanies this report.
- A local build is not a verified hosted production release. Production identity, private backup/read-only connection checks, exact release build and real account workflows must be verified under deployment approval. No known captured deterministic bypass was accepted to obtain a passing result.

## Exact controlled activation proposal, awaiting owner approval

This is the narrow path toward full text delivery, not a permanently disabled product or a full commercial launch claim:

1. Approve the exact reviewed PR commit and **owner-only pilot** scope. Recheck production identity and PR drift. Establish a recoverable database restore point/private backup without restoring old snapshots over current data. Verify existing Neon/Better Auth/Stripe bindings and grants read-only; no schema migration or historical repair is proposed.
2. Before any production build/merge, set **`CONTENTOS_TEXT_GENERATION_MODE=pilot` at both build and runtime** and **`CONTENTOS_TEXT_GENERATION_PILOT_ACCOUNTS=<exact existing owner auth ID>`**, supplied privately in the existing Vercel project. No IDs, credentials or customer data belong in Git. Empty allowlist denies everyone; no email/domain/wildcard admission. Keep `FOUNDER_RETIREMENT_RECEIPT` unset. Never use absent/`enabled` mode for this stage.
3. Deploy only the approved application artifact, never the old temporary benchmark runner. `/api/generate` authenticates and checks origin/account binding before admission; non-allowlisted accounts receive 503 before body/provider/storage work. The allowed account still encounters normal subscription entitlement, usage, durable stage and exhaustive factual checks. Generation, targeted refinement and resume share the gate; request-supplied account IDs cannot grant admission.
4. Verify READY/SHA/domain and the visible public limitation on pricing and Studio. Non-pilot accounts must not be told their text allowances are usable. Check anonymous/non-pilot refusal, owner login, save/reload/export and unchanged subscriptions/Founder protections only using approved owner activity; do not contact customers, initiate purchases or issue provider calls as implicit smoke tests. Owner text use is subject to its explicit subsequent authorization and normal spending guards.
5. Monitor actual owner delivery for complete coverage/correction/revalidation, exactly-once history and successful usage, account isolation, latency, uncertain failures and sanitized provider/DB/auth/billing logs. A failed or uncertain stage retains the draft, does not deliver unchecked output or charge a successful-use event, and must not be automatically retried. Do not broaden the allowlist or silently replay an uncertain call.
6. After a complete live pack and independent assessment pass, present measured evidence for **separate public enablement approval**. Only then switch to `enabled` through a reviewed build/runtime rollout and verify real workflows. This report does not authorize that transition.

## Rollback and Founder boundary

For a pilot incident, set `paused` at build/runtime and redeploy the same reviewed application; retain drafts, checkpoints, accounts and all financial records. This keeps the new server guard and current storage intact. The old live artifact has no pause gate: blindly promoting it must not be described as a safe way to pause AI. Preserve the prior deployment as a reference, but require a reviewed rollback plan if restoring old code with different text behavior. No destructive database rollback, uncertain-call replay or automatic usage refund.

The public Founder offer remains **ACTIVE** throughout preparation and any pilot. A pilot is not the separately authorized, successfully verified full launch that triggers retirement. The prepared retirement implementation and lifetime benefits remain unchanged; do not write a receipt, retire promotion, alter Stripe limits or cancel subscriptions now. Following separately approved and verified public launch, use the recorded retirement procedure and preserve existing lifetime benefits. A later rollback must also preserve any then-valid retirement receipt.

**Minimum owner decision: approve or decline this exact owner-only controlled rollout, with its publicly disclosed limitation and separate authorization for any real provider-backed owner use. Full public text generation remains gated on actual complete live delivery. No new service, credit purchase, benchmark campaign or general development cycle is requested.**
