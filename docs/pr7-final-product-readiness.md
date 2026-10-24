# PR #7 final product readiness

24 October 2026. Offline finalisation only; not production or paid-test approval.

## Starting state and boundaries

- Clean starting worktree: `feat/simple-creation`, local `4d15d0982fe3553a6bdc5fe35a55f355ae22d63a`.
- GitHub PR #7 was verified draft at `05756c161cbac886691d3a5776694d28e72aca71`. Four subsequent local commits (QA gate, synthetic database isolation, business-fact guard and content quality) were preserved. They were not assumed to be on GitHub.
- No push, merge, deployment, production database access, firewall/configuration change, Stripe request, mail, paid AI call, key provisioning or credential reactivation in this pass. Historical live campaigns were not reopened or reset. New database audit rows belong only to explicitly mock-only QA tests.
- Production's last recorded release is `249d90ccf6207abd264afead7628ffcba54a7eb6`; this report does not claim to have reverified its current live identity. Existing customer accounts, pricing, retired public Founder promotion, Founder lifetime benefits, owner complimentary access and GBP30 controls were not changed.

## A. Completed improvements

### Source-grounding pipeline

The old guard covered selected high-risk assertions but let timing, purpose and future commitments pass as ordinary prose. Tone/audience guidance could influence the model without factual support. The updated single-call pipeline:

- Builds evidence entries from the current brief and user-supplied offer, retaining source and sentence positions. Saved preferences are not independently verified facts; audience, voice, goals, previous generated text and refinement instructions cannot establish achievements.
- Produces explicit internal decisions: source-supported, confirmation required, unsupported, or unverified expression. A missing rule match is **not** reported as verification. These are local decisions, not model certificates or independently verified truth.
- Requires complete supplied wording for recognized high-risk relationships, including history, purpose, dated events, commitments, proof, terms and guarantees. Current explicit contradictory instructions can defeat saved-offer support.
- Allows bounded milestone rephrasing only against a direct supplied subject/achievement/quantity/unit relationship. It rejects changed subject, quantity, location/scope, future goal and negation. It is not a general natural-language entailment engine.
- Normalizes the same typographic dash changes as the delivery parser, avoiding rejection solely because harmless punctuation changed.
- Checks all generated fields before cleanup and again before return, including refinement. Unsupported captured facts never reach successful history or usage completion. Provider spend is still accounted for and rejected requests remain terminal; replay does not generate again.
- Adds explicit prompt distinctions for timing, purpose and promises. Keeps creative hooks, thanks, opinions and user-supplied storytelling. No extra reviewer call or automatic regeneration.
- Refuses recognizable social CTAs in body/items when No CTA is explicit, rather than only clearing the dedicated CTA property. This is bounded instruction checking, not a complete classifier for every possible invitation.
- Keeps the prior relevant-hashtag and restrained filler cleanup. Unsupported niche tags are omitted; explicit hashtag preferences retain precedence.
- Moves the draft/non-independent-fact-checking notice out of collapsed filters into the visible output header. No fact-checked badge is introduced.

### Image Studio and usability

- Removes the duplicate advanced format picker; the main selector retains every format and shows exact export dimensions. Style and format stack so their selected text fits the tablet panel.
- Fixes inline `Headline:` instructions after sentence punctuation. A one-line description previously produced `missing_visual_copy` despite containing a headline. Headline, supporting text and brand directives are separated; unrelated instructions are not inserted into the graphic.
- Preserves type, swatches, custom HEX, style, saved palettes, explicit-over-inferred precedence, advanced controls, editable overlays, undo, local design restore and export. No image model, size, quality, credit, reservation or billing change.

Changed implementation: `lib/business-facts.ts`, `lib/generation-contract.ts`, `lib/prompts.ts`, `lib/image-design.ts`, `components/image-choices.tsx`, `components/studio-shell.tsx`. Supporting changes are regression fixtures/tests and this report.

## B. Verification

| Check | Executed result |
| --- | --- |
| Full `npm test` | 292 passed, 0 failed/skipped. Includes auth/security, subscription checkout/webhooks, Founder/owner protections, quotas, commercial cost policy, request replay, uncertainty and storage. Mocks only. |
| `npm run typecheck`, `npm run lint` | Passed. |
| Default `npm run build` | Passed with Next 16.4.1/Turbopack, TypeScript and 51 prerendered pages. No test fixture route in the production route list. Local build, not deployment. |
| Fresh `npm audit --json` | 0 vulnerabilities across production and development dependencies; no dependency changes in this pass. This is not a guarantee against undiscovered vulnerabilities. |
| `git diff --check` | Passed. |
| `tests/qa-database-isolated.mjs` | 7 groups passed: least privilege, forced RLS, exactly credential-bound synthetic records, cross-account read/write denial, identity-spoofing rejection, unrelated-table and copied-database denial, own workspace CAS/rollback. |
| `tests/qa-auth-isolated.mjs` | 3 groups passed using actual Better Auth: synthetic login isolation, session-cookie isolation and scoped logout. No mail. Expected negative-login warnings contained no account details. |
| `tests/qa-campaign-isolated.mjs` | 11 groups passed: Neon row-lock concurrency, six slots, seventh rejection, restart/replay, budget limits, failed/timeout/uncertain stop, persistence uncertainty, immutable accounting and cross-role denial. New mock-only campaigns, no sealed live campaign changes. |
| `tests/simple-creation-browser.mjs` | Passed: 4 mocked generations, all 14 formats, simple input, explicit overrides, visible draft warning, edit/undo/refinement, export/save, failed-generation recovery, second device and account switching. |
| `tests/image-studio-browser.mjs` | Passed: 4 modes, 7 mocked requests across 2 synthetic accounts, only 3 mocked provider invocations; invalid HEX, explicit palette, editing/undo, restore/isolation, native dialog keyboard/Escape behaviour. |
| Responsive review | Both workflows at 1440/768/390 px, no horizontal overflow or page errors. Screenshots inspected. Not a complete WCAG certification. |
| Actual PNG export | Browser downloads verified by PNG IHDR: 1080x1080, 1080x1350, 1080x1920, 1536x864. No AI needed for Text mode. |

The 14 distinct representative fixtures cover LinkedIn, Instagram, TikTok, X/Twitter, Facebook, YouTube Shorts, X thread, short video script, carousel, email newsletter, repurpose pack, hooks, CTAs and platform hashtags. Each executes normalization, platform instructions, parsing, formatting, account-scoped save/restore and text export. Separate adversarial loops cover every delivered field in every format. This tests contracts, not live platform writing quality.

Captured evidence:

- Original attic-story capture remains unchanged and rejected.
- Previous retest remains unchanged, accepted with bounded hashtag/filler cleanup; this is not retrospective semantic certification.
- New `tests/fixtures/pr7-instagram-quality-comparison.json` is structurally identical to the private raw provider JSON. Canonical SHA-256: `c69666d729ba97357907d9811b697922ff759455650d23ea861ece1a1fa697e5`. The private response and spending audit were read, not modified.
- Timing, purpose and future-commitment failures are each rejected independently, then together in the exact captured response. Actual route tests cover generation and refinement, no successful persistence, retained provider accounting, sanitized diagnostics and no second call on replay.
- Positive cases retain supplied origin/purpose/timing/commitment facts, natural hooks and ordinary educational language. Negative cases include changed totals/entities, scope, source negation, saved-context conflict and unsupported refinement additions.

During verification, the expanded browser test correctly encountered the real six-attempt image rate limit. It was not relaxed or reset; remaining local export cases run as a second synthetic account. A test assumption that native dialogs never yield focus to browser chrome was corrected; background controls remain inaccessible and Tab returns to the dialog. Both final browser runs pass.

Private browser artifacts: `/tmp/contentos-pr7-final-text/` and `/tmp/contentos-pr7-final-image/`. Fixtures are removed in `finally`, and the localhost server is stopped after verification. No production credentials were loaded into it; its existing local OIDC value was explicitly overridden empty. All browser API responses were intercepted. QA database tests block HTTP/provider/mail traffic.

The unchanged production monthly ledger was not reconfigured or rerun with administrator access. Existing commercial transaction evidence is retained from its release; this pass reran cost/route/accounting unit regressions and the least-privilege QA concurrency checks. Those are different scopes and are not represented as fresh production ledger observations.

## C. Product acceptance

| Area | Assessment |
| --- | --- |
| Ease of use | Verified with actual UI and mocked transport: short idea, platform, generate, refine, save/export. Advanced controls remain collapsed. No replacement workflow. |
| Writing | Instructions and offline cleanup preserve supported specificity and natural expression. Captured failures are covered. New live writing improvement is **not yet demonstrated**; no new editorial score is claimed. |
| Factual reliability | All captured critical assertions are refused, with no successful history/usage completion. Unrecognized semantic inventions and valid paraphrase false positives remain possible. Clear visible draft status, not a factual-certification claim. |
| Image Studio | Controls, request precedence, safe rendering, keyboard interaction and exact canvas export verified. Generative image composition and pixel-level HEX adherence remain untested by mocks; only app-rendered colours/dimensions are deterministic. Designs remain account-scoped on the device; text workspace has cloud persistence. |
| Commercial safety | Relevant regression and synthetic database checks pass. No changed billing/auth/entitlement/quota/financial implementation and no production mutation. |

## D. Genuine release gates and limitations

No known reproducible critical security, account-isolation, accounting or captured-claim bypass remains in the executed checks. This is **ready for final founder acceptance**, not an assertion that live AI output is reliable or that production deployment is approved.

The remaining acceptance gate is independently reviewed live output from this exact candidate, including simple text, refinement and image instruction adherence. Earlier campaigns stopped early and cannot establish the unexecuted scenarios. A successful parser alone is not enough. Credentials remain revoked, and no earlier paid allowance/campaign may be reset or reused without authority. Any fresh live work needs explicit scope, budget and credential approval plus renewed pricing/expiry/isolation preflight.

The bounded guard does not understand every paraphrase, industry claim or contradiction. Exact wording requirements can reject legitimate high-risk paraphrases; conservative hashtag matching can omit valid synonyms. User-provided facts themselves are not independently verified. These limitations must remain disclosed; do not market the product as autonomous fact-checking or remove human publication review.

## E. Optional post-launch work

Monitor anonymized rejection categories and genuine customer usability feedback after an authorised launch. Broader synonym support and editorial tuning are optional, not grounds for another speculative development cycle. No additional feature backlog is proposed.

## F. Release and rollback procedure / minimum decision

1. Founder reviews the local commit containing this report. Separately approve publication of the preserved local commits to PR #7; do not force-push or assume they already exist remotely.
2. Approve final controlled acceptance scope and spending before any provider dispatch. Use only the existing synthetic-only QA infrastructure, a fresh approved temporary credential and durable gate; no production/Preview credential exposure, automatic retry or sealed-campaign reset. Revoke execution access afterward. Do not substitute mocks for this gate.
3. Only after acceptance and explicit production authorisation, reverify the actual live commit/deployment and save it as the rollback target. Confirm existing production environment identities without exporting secrets, and verify the prior deployment is safe to restore with the same financial controls.
4. Build the reviewed application commit through the existing project, preserving production models, quotas, retired Founder configuration, subscription prices, owner/Founder entitlements and GBP30 ledger. **No production schema migration is needed for these changes.** QA SQL under `scripts/qa` is never a production migration.
5. Keep Preview protection and the noncanonical-host firewall intact. Never deploy the local browser fixture. Non-chargeable checks must verify login/session ownership, workspace reads/saves, paid-plan gating, unauthenticated provider-route refusal and live commit/READY identity; do not create Stripe checkouts or paid AI smoke requests without separate authority.
6. Monitor generation rejection/error rates, duplicate/uncertain holds, workspace conflicts and spending alerts. On a material regression, promote the recorded prior production deployment; keep all ledger/audit/customer rows and environment safeguards. Do not reset usage or roll back data to a stale snapshot. If dispatch safety is uncertain, suspend generation with the established controls until verified.

**READY FOR FINAL FOUNDER ACCEPTANCE**

This decision permits review only. No push, paid execution, merge or production launch has occurred or is implicitly authorised.
