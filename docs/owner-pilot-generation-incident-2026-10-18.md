# Owner pilot generation incident

## Confirmed evidence and diagnosis limit

Production at investigation: `8b55f6080e118ef34cf5007a1aeb21c355c61396`, Vercel deployment `dpl_nFyCADK8mVG19fdiCkR2XD8utxQg`. The text mode is `pilot`, with the existing sensitive owner-only allowlist. No public text enablement is authorized.

Read-only production inspection found two draft-stage failures on 18 October 2026, at approximately 16:25 and 16:26 UTC. Their provider durations were 17,476 ms and 13,083 ms. OpenAI returned usage: 3,083/941 and 3,087/977 input/output tokens. These calls may be billable; token counts are not an invoice. The retained conservative reservations total USD0.925790, not actual cost.

Both checkpoints contain `generation_failed`, phase `draft`, zero reviewed units, no accepted generated draft and no completed review/correction/revalidation stages. There were no successful usage events or generated history entries after these attempts. The owner's original Studio draft remains present. No owner/customer content or account/request identifiers are published here.

**The precise original rejection is not recoverable from the available evidence.** The deployed catch discarded the exception and receipt. Runtime logs contain only the stage, duration and token counts. The provider request uses `store: false`. Therefore neither a historical semantic-review issue nor a timeout is established as this incident's cause. The confirmed failure boundary is provider-draft acceptance, before factual review. The exact output-contract/provider-status/coverage/internal predicate remains unknown. Synthetic examples below reproduce diagnostic loss, not the unavailable original response.

## Targeted correction

- Add explicit output-error codes, distinguish provider status/size, review rejection and unexpected internal errors. Do not infer causes from error-message text.
- Persist the code with the existing atomic stage checkpoint and include only the safe code in telemetry/progress.
- Preserve the exact failed receipt and normalized source request in the account's private reservation journal when serialized evidence fits 240 KB and the existing per-checkpoint/account caps. Otherwise retain the hash/code only. This data is not a delivered draft, history entry or public log. Existing reader projections exclude reservations. Existing 45-minute checkpoint retention still applies; this is not an indefinite audit archive.
- Tell users when the failure preceded factual review instead of misreporting all failures as factual validation. Do not automatically repeat paid work.
- Keep all validation predicates, model payloads, budgets, attempt controls, entitlements and account isolation unchanged. No guessed permissive parser fix, regeneration, migration or data repair.

This is a diagnostic-loss/messaging fix, **not proof that the original generation failure has been repaired**. A successful provider-backed owner delivery remains unverified. No new paid request was made during this investigation.

## Validation

- 55 focused contract/actual-route/pilot/diagnostics tests passed.
- 51 reservation/staged-validation/reader-projection/Founder safeguards tests passed.
- New isolated Neon test passed: concurrent failed-checkpoint persistence, exact private receipt retention, redacted reader projection, cross-account refusal, no successful usage/history, unchanged Founder entitlement and no redispatch. Synthetic row removed; no production writes or provider calls.
- Typecheck, lint and `git diff --check` passed.
- Default local Turbopack build was blocked by the execution environment's worker-port binding restriction, including the permission-reviewed attempt. Supported `npm run build -- --webpack` passed. The actual staged Vercel production build must separately reach READY before promotion.
- No authenticated customer session was impersonated. No live checkout, image render or AI text request was initiated. Mocked transport does not prove model delivery or quality.

## Rollout and rollback

Deploy only this scoped repair to the existing owner pilot, using a staged production artifact before promotion. Preserve `CONTENTOS_TEXT_GENERATION_MODE=pilot`, the existing sensitive allowlist and the explicit build/runtime `OPENAI_MODEL=gpt-5.2` pin. Keep production credentials and protection unchanged. Verify anonymous generation/image/workspace requests are refused, public pages still disclose pilot mode and the custom domain points to the verified artifact.

Immediate application rollback target is `dpl_nFyCADK8mVG19fdiCkR2XD8utxQg`, which already contains the owner-only gate. No schema or data rollback is required. Rollback would restore the diagnostic limitation. To stop all pilot generation, stage/promote the guarded code with `CONTENTOS_TEXT_GENERATION_MODE=paused`; an env edit alone does not change a deployed immutable artifact. Never promote an older artifact lacking the gate.

## Founder status

The production retirement receipt is absent and the existing promotion is ACTIVE, not retired. The previous explicit authorization conditioned retirement on a separately authorized and verified full public launch; an owner-only pilot does not meet that condition. Do not remove claims/promotions on the unsupported assumption that retirement already occurred. No Founder settings, Stripe data or lifetime benefits were changed by this repair.

## Remaining action

The two original provider outputs cannot be regenerated/replayed without new paid work, which is not authorized. Preserve the retained private incident snapshot and historical spending evidence. A separately authorized, instrumented owner attempt is needed to identify any surviving rejection or verify a complete provider-backed delivery. Do not call the pilot fully functional or expand public access based on these offline checks.
