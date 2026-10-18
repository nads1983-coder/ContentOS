# Final production approval package

## Decision

**RESTRICTED LAUNCH REQUIRED - MINIMUM SAFE CONFIGURATION AND APPROVAL NEEDED.**

This supersedes the earlier request for another benchmark. No additional budget or testing campaign is requested. Full live text delivery has not passed, but the latest failure does not invalidate the independently tested account, manual workspace, image, subscription or Founder functionality. PR #3 remains draft and unmerged. Production is unchanged.

The exact release commit is the commit containing this package, recorded in PR #3 and the owner-facing completion report. Its application changes relative to `d4232b0ba6b8f492b84f7b0a1c5a1ff95cade924` are only a server-side text-generation availability gate, matching UI protection/disclosure and associated tests. The factual validator and all 14 format definitions are unchanged.

## Minimum safe release

Set **`CONTENTOS_TEXT_GENERATION_MODE=paused` at build AND runtime** for the reviewed application deployment. Do not promote the temporary synthetic runner or an artifact built without this setting.

- `/api/generate` refuses authenticated text-generation, refinement and resume requests with HTTP 503 / `text_generation_paused`, before reading the body, admitting a stage, writing usage or calling OpenAI. Origin, authentication and account-binding checks remain enforced. Unknown configured values also refuse execution; absent/`enabled` values preserve full-mode behavior and are **not approved for this restricted launch**.
- Studio generation is disabled. Refinement/regeneration handlers refuse without sending requests. A stale client still meets the independent server gate. Existing drafts/checkpoints are preserved, not reset, deleted or represented as validated output.
- Manual editing, undo, formatting, export, existing history, account-scoped saving and image generation remain available subject to existing plan/security/usage limits. Text generation across all 14 formats remains implemented but unavailable. No unchecked text is delivered as verified.
- A prominent availability notice appears on public pages, pricing, Founder pages and Studio. It explicitly states that subscription text allowances cannot be used during the pause. **This is not the full AI-first launch.** New and existing subscribers must not be told text generation is available. There is no promise of a re-enable date or automatic re-enable.
- Existing standard subscriptions, customer data, prices and verified Founder lifetime entitlements are unchanged. The existing image workflow remains unchanged, not replaced with text credentials/configuration shortcuts.

This configuration is technically safe for a restricted workspace release based on executed evidence, not a claim that its reduced value is commercially equivalent to the intended AI-first product. The owner must explicitly accept that limitation before release. If unacceptable, keep the current production artifact unchanged; no further automatic development or spending is proposed.

## Evidence

[Latest live report](benchmarks/acceptance-recovery-d423-2026-10-18/REPORT.md): npm packaging resolved, protected Preview READY, runtime/isolated checks passed, one known paid review completed. Three certificates refused; 96/307 initial units accepted, no final pack or successful usage charge. Paid token cost USD0.03503395 new; retained reservations GBP0.186566 new / GBP0.979074 combined. Cleanup verified.

Focused changes verified locally:

- **56 behavioral tests passed**, covering paused/malformed modes, unauthenticated/unsafe/cross-account refusal, interrupted-draft preservation, enabled-mode full review and duplicate accounting, existing generation failures/recovery, image accounting/limits and Founder lifetime/retirement protections.
- **Typecheck, lint and production build passed**, with `CONTENTOS_TEXT_GENERATION_MODE=paused npm run build -- --webpack`.
- **Browser PASS at 1440/768/390px**: generation disabled; refinement/regeneration make zero HTTP requests; manual edit/undo, text export, draft reload, availability notices and active Founder claim links work; no overflow or page exceptions. Credential-free local environment; external browser requests blocked. Results/screenshots: `/tmp/contentos-restricted-release-browser/`.
- Authenticated direct-route restriction is covered by executed route tests. Browser test was credential-free, not a new real signup/payment/provider test. Existing isolated auth/account/cloud/billing evidence from [release closure](final-release-closure-2026-10-18.md) is reused; these untouched features were not subjected to another historical campaign.
- Five new runner tests and 13 isolated-Neon checks passed. No production database connection was used for the campaign.
- Existing same-application full-suite evidence: 607 passes, zero failures, one opt-in skip. This is explicitly prior evidence, not a newly rerun full suite. No new dependencies or security surface outside the temporary removed runner were introduced. Previously documented development-only advisory limitations remain unchanged.

## Exact release procedure: awaiting approval

1. Obtain owner approval for the **exact PR head SHA and restricted configuration** above. Full text enablement is excluded. Record the approval and reject any subsequent unreviewed code/config drift.
2. Recheck production identity and preserve a recoverable backup/restore point. Read-only verification on 18 October found production project `prj_aO6mDTNkCKe5jzepGPCvzOWy1eBS`, deployment `dpl_HSnCfk4HP3V4iwsxKSfuDEnjiosH`, commit `6c75fab8e995e94c53bec400aed01991e1ee0642`, main, READY. This is the rollback reference; reverify before acting. Never restore an older snapshot over newer customer data.
   The public `/founder` page also returned HTTP 200 with the active claim link and no closed-offer notice. No checkout was created.
3. Verify production Neon/Better Auth/Stripe identities, grants, canonical URLs and claim constraints read-only against existing records. No new schema migration is required by the availability gate. Do not apply historical repairs. Confirm benchmark deployment/access absent and no benchmark connection/settings included in production.
4. Under approval only: set the non-secret pause setting for build/runtime, keep `FOUNDER_RETIREMENT_RECEIPT` unset, merge the exact reviewed PR and build/deploy the corresponding production artifact in the existing project. Do not trigger an automatic full-mode production deployment before the pause setting is established. Verify merged tree matches the reviewed application; stop on drift.
5. Verify READY, domain/SHA, public notices including pricing, authenticated server refusal before usage/provider work, manual workspace/save/history, auth navigation and unchanged billing/Founder access. Validate writes only using owner-authorized isolated/internal fixtures; no customer mutation, live purchase, email, Founder consumption or paid generation as an unapproved smoke test. Record what cannot be checked without real activity; inspect first genuine activity read-only.
6. Inspect sanitized logs for auth/database errors, workspace save failures, cross-account responses, image reservation faults, duplicate usage, webhook failures or unexpected text dispatch. Any security, data-integrity or billing failure halts verification. Text usage/provider activity while paused is an immediate stop/rollback condition.
7. Only after owner-authorized launch succeeds **and production verification passes**, execute the already-prepared Founder retirement mechanism under the owner's stated conditional instruction. Record a valid `FOUNDER_RETIREMENT_RECEIPT` with exact approved/verified SHA, deployment ID and ordered actual timestamps; redeploy the same reviewed application with pause retained. Do not create a receipt or retire now. Verify new claims refused, public promotion removed, normal subscriptions and existing lifetime benefits preserved. Valid pre-cutover sessions remain honored; unrelated external Stripe links require read-only inspection before claiming universal promotion retirement. Do not alter Stripe capacity or subscriptions.

## Rollback and monitoring

- Before retirement, restore the verified prior application artifact/configuration on failure, preserving database rows, accounts, usage, drafts and checkpoints. Do not replay uncertain AI requests or billing webhooks as a repair shortcut.
- After retirement, rollback must retain both the text pause and verified retirement receipt. Blind promotion of the old artifact can reopen Founder. Prefer the reviewed restricted artifact with the receipt or a narrow forward fix; obtain approval for any necessary emergency policy change.
- At deployment, after retirement and during first real usage, inspect failure categories, generation dispatch count (must be zero while paused), image holds/completions, save conflicts, auth errors and billing/Founder retries. Do not log customer content or identifiers publicly. This is an execution procedure, not a silently scheduled automation.
- Acceptable with monitoring: documented development-only dependency advisory, bounded replay maintenance, per-account rather than universal anti-abuse limits, pre-retirement session grace and ordinary subscription-event ordering limits with existing lifetime protections.
- Prohibits full AI launch: no completed independently assessed live fact-checked text pack. Classification/semantic certificate issues remain deferred **behind the server block**, not ignored or declared fixed. No known captured factual bypass was introduced by this work.

## Owner decision

Approve this exact **restricted workspace release with AI text generation paused**, understanding subscription text allowances are unavailable, and retain the conditional post-verification Founder retirement sequence. Or keep production unchanged until full text delivery is verified. No new credit, API budget, service or general development request accompanies this decision.
