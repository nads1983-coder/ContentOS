# PR #7 final correction and release candidate

24 October 2026. Offline engineering closure on `feat/simple-creation`, starting at `49732e29ebfbd3160ca7b92080b7aeac81242b2a`. The commit containing this report is the local acceptance candidate. No push, merge or deployment is authorized or performed.

## Root causes and corrections

1. The milestone guard compared a restricted bag of words. It rejected a valid internal synopsis that combined a supplied achievement with the saved target audience. `lib/claim-evidence.ts` now matches complete subject/achievement/quantity/unit relationships and separates internal audience framing from factual eligibility. Changed subjects, amounts, units, scope, dates and negation are not discarded to obtain a match. Audience and style preferences are not evidence for business history or giveaway terms.
2. The recognizer did not model channel ownership/history. The presupposition "since the first newsletter" therefore passed as unverified expression. Channel existence and publication history now require source evidence; subscriber counts alone prove neither. Supplying a channel does not prove its first issue, frequency, dates or source of subscribers. Explicit current contradictions defeat saved-offer support.
3. The old seven-word caption fallback replaced legitimate short writing and could erase a confirmation placeholder. It now applies only to empty/hashtag-only captions. Short useful writing remains intact.

The guard remains bounded, deterministic source matching, not an independent semantic fact checker. It does not guarantee that every possible unsupported assertion will be recognized. Prompt instructions reinforce factual boundaries but are not treated as proof.

## Publication safety

- All output fields are inspected before cleanup and again before delivery, including refinement.
- A separable unsupported channel/history sentence may be omitted in full, without inventing replacement facts. A maximum of eight omissions per asset (and eight in pack metadata) is enforced. Other recognized unsupported material claims still refuse delivery; a channel sentence containing a recognized high-risk claim cannot escape this check.
- Notices remain associated with the content type through normalization. The per-asset bound allows all 14 formats to complete without an arbitrary pack-wide rejection.
- Each asset carries server-created `ready_to_review` or `needs_confirmation` metadata. Omissions and labelled missing details trigger visible notices outside copyable text. The UI explicitly says "Not independently fact-checked". Manual edits and legacy assets without review metadata are not displayed as checked.
- Review status survives account-scoped cloud storage. Copy/export exclude the removed sentence while preserving labelled confirmation placeholders. No new confirmation step or additional customer input is required.
- Existing provider accounting, terminal failures, no automatic retries, quotas and exactly-once persistence are unchanged. A useful accepted draft with clearly marked missing details counts as one successful generation; rejected output does not.

## Evidence and executed checks

The original synthetic request, preferences and captured provider JSON were not edited. The new regression fixture exactly matches the private raw response under canonical JSON serialization: SHA-256 `b88963b02e0858472b9f7da248c8008a27426ce5325663f4a49ced9d42ab032f`.

The captured milestone/audience summary is accepted. The newsletter-history sentence is omitted and disclosed. Supported milestone text and the essential giveaway-details placeholder survive. Earlier attic/history, timing, purpose, commitment, price and No-CTA failures remain covered. Positive tests preserve supplied stories, bounded milestone paraphrases, creative hooks and educational examples. Adversarial cases cover changed subjects/quantities/units/scope, conflicting saved facts, forged review metadata, excessive omissions and normalization.

| Verification | Result |
| --- | --- |
| Full `npm test` | 300 passed, zero failed/skipped; mocked providers only. Includes authentication, account isolation, subscriptions, Founder/owner protection, quotas, image contracts, spending, uncertainty, replay and storage. |
| Focused publication + actual generation-route tests | 30 passed; generation and refinement of the exact capture persist once, retain provider accounting, and replay without another provider call or usage charge. |
| Synthetic Neon database | 7 groups passed: least privilege, forced RLS, cross-account denial, unrelated/copied-database denial, real workspace save/restore including review metadata, CAS and rollback. |
| Synthetic Better Auth | 3 groups passed: credential-bound login, session isolation, scoped logout. Expected negative-login warnings only. |
| Synthetic campaign accounting | 11 groups passed: atomic concurrency, six-slot ceiling, budgets, restart/replay, retained failed/uncertain reservations, immutable audit and account isolation. New mock-only test audits; sealed live campaigns untouched. |
| Text browser workflow | Passed: one-sentence creation, optional advanced overrides, all 14 formats, natural-language refinement, edit/undo, clipboard, downloaded text, save, second device, account switching and failed-request draft preservation. Four mocked generations. |
| Image browser workflow | Passed: four modes, graphic/photo request behavior, palette/HEX overrides, brand settings, editing/undo, device restore, account isolation and native modal keyboard behavior. Seven mocked requests, three mocked provider invocations, zero paid calls. |
| Responsive inspection | Text and image screenshots inspected at 1440/768/390 px; no horizontal overflow or page exceptions. Not a full accessibility certification. |
| PNG exports | Actual browser downloads checked at 1080x1080, 1080x1350, 1080x1920 and 1536x864. Model colour/composition quality is not established by mocks. |
| Typecheck, ESLint, production build | Passed; 51 pages, no browser fixture route in the build. |
| Dependency audit | Fresh `npm audit --json`: zero production/development advisories; no dependency changes. |
| Diff check | `git diff --check` passed. |

Local browser evidence: `/tmp/contentos-pr7-closure-text/` and `/tmp/contentos-pr7-closure-image/`. The local server had provider/database/payment/mail/OIDC credentials disabled; browser APIs were intercepted. Database tests used existing least-privilege synthetic credentials with HTTP/provider/mail traffic blocked. Temporary UI fixtures were removed and the server stopped.

## Remaining limits and acceptance decision

No known reproducible critical security, billing or data-integrity failure was found in these checks. Both captured classification defects are corrected. Unknown semantic inventions and conservative false positives remain possible; "Ready to review" is explicitly not factual certification. Independent editorial judgment remains necessary before publication. The five scenarios not executed in the stopped live campaign are not represented as live passes. This pass establishes corrected replay and functional compatibility, not fresh live-model quality or precise generated-image HEX adherence.

Historical private raw outputs, checkpoints, spending and revocation records were retained. No paid calls, new credentials, production data access, billing/subscription/entitlement/firewall changes or changes to the GBP30 cap occurred. Existing Founder lifetime and owner complimentary benefits remain protected by unchanged code and passing regressions. No production Founder status mutation was made.

## Production release and rollback procedure (not executed)

1. Founder accepts this exact local candidate and separately authorizes any push, merge or production release. Do not infer paid-test approval. Preserve the existing live campaign records; do not reopen them.
2. Immediately before an authorized release, record current production commit/deployment and environment metadata securely, verify recovery availability, and compare the complete PR diff. Do not assume an older recorded deployment is still current.
3. Push the approved branch only after authorization, verify CI and deploy through the existing `content-os` process with its production configuration. This correction requires no database migration, new secret, model change, price change or spending-ledger reset. Do not apply QA schema/scripts to production or deploy the browser fixture.
4. Verify READY and exact commit, auth boundaries, account-scoped workspace persistence, recurring prices, Founder/owner access and unchanged spending protections using non-chargeable checks. Monitor grounding rejections, persistence/replay failures and provider-accounting uncertainty. Do not use a paid generation as an unapproved smoke test.
5. On a material regression, pause affected dispatches through the existing controls and restore the recorded last-good deployment/configuration. Never reset spend, reservations, successful usage or customer data. This additive JSON review metadata needs no destructive rollback; old clients may omit its display, so communicate that rollback limitation. Preserve evidence and drafts.

**FINAL RELEASE CANDIDATE READY FOR ACCEPTANCE**

This is acceptance readiness, not production approval or a claim of completed live acceptance. The next stage is the founder's final acceptance and release decision, not another feature sprint.
