# Premium Studio integration: protected Preview review

Final review and the narrowed one-call approval proposal are in [final readiness](premium-studio-final-readiness-2026-10-19.md). That report supersedes the broader provider-test suggestion below; existing evidence is retained unchanged.

## Scope and baseline

- Verified current production: commit `6517cc23cffa9e34dec684bc035d17a5a3b69dea`, deployment `dpl_7ym1m4JGGr51sbnR9YsMm9wuD8ij`, project `content-os`.
- Integration branch: `feat/premium-studio-production`, created from that production commit, not from main or PR #3.
- Selectively reused PR #3's stable pre-grounding Studio/workspace/reservation implementation at `2cfcecc`. PR #3 and its captured evidence remain untouched.
- Production prompts (`lib/prompts.ts`), structured-output schema and text normalisation are preserved. Ordinary standard-length calls use exactly the original `buildInput`. A small source-preserving adapter adds optional length and single-section refinement instructions. Structural completeness, request bounds and unique section IDs are checked; this is not independent factual certification.
- No factual-review batches, claim-scope modules, staged generation checkpoints or experimental provider orchestration were imported. The UI explicitly labels AI drafts and asks customers to review facts and permissions before publication.

## Implemented

All 14 format selections; progressive brand/advanced controls; direct edits and undo; provenance labels; targeted refinement; copy/export; saved library and search; recent work; account-scoped cloud drafts and preferences; stale-device revision protection and local recovery. Images retain the existing renderer and model, with atomic quota reservations, idempotency and no-credit template fallback.

Generation uses account-scoped durable reservations in existing profile JSONB. Admission, quota counters, history and successful usage are transactionally protected; network requests do not hold database locks. Provider retries are disabled. A replay returns the existing result rather than spending again. Failed/uncertain work does not automatically retry; current drafts remain. Auth transaction context and password-reset session revocation are the tested stable implementation from PR #3.

No schema migration is required. Workspace writes update only their explicit profile fields and preserve billing/history. Existing Founder checkout, exact promotion enforcement, claims table, Stripe hotfix, lifetime entitlement rules, prices and monthly allowances are unchanged. No customer repair is included.

## Executed evidence

- `npm ci --ignore-scripts --no-audit --no-fund`: passed for baseline lockfile; subsequent targeted sharp patch install passed.
- `npm test`: 187 tests passed, including real route orchestration with mocked provider/DB dependencies, workspace CAS, auth/reset failures, text/image reservation races and quota/refund handling.
- `npm run typecheck`, `npm run lint`, `git diff --check`: passed.
- `npm run build`: local Turbopack blocked by sandbox CSS worker port creation (EPERM), not an application compile failure. `npm run build -- --webpack`: passed. Preview explicitly uses the same supported webpack build command.
- `tests/auth-isolated.mjs`: passed against the existing isolated Neon branch, including concurrent signups, verification, two-device persistence, stale writes, account isolation, password reset and logout. Mail transport was mocked; no messages sent. Synthetic rows cleaned up.
- `tests/image-isolated.mjs`: passed real database concurrency, quota, replay, refund and projection checks; eight fixtures cleaned up, zero provider calls.
- `tests/premium-browser.mjs`: passed on local isolated runtime at 1440/768/390px. Actual login, generation route, database persistence and replay; 14 cards; edit/undo/refine/provenance; export; injected failure preserving drafts and usage; decoded template image; cross-device cloud loading and stale-account rejection. No unexpected console/page errors or horizontal overflow. Text transport is explicitly synthetic, not live AI evidence.
- Production-only npm audit: zero advisories after pinning the existing transitive sharp package to 0.35.5. Full audit: seven high findings from the same development-only `braces <=3.0.3` stack-exhaustion issue through Tailwind/ESLint tooling. Those glob parsers are not customer runtime endpoints; do not process untrusted glob patterns in CI. A forced framework downgrade or Tailwind major migration is not justified for this integration.

## Protected Preview safeguards

Preview fixture mode fails closed unless Vercel environment is Preview and the database endpoint, branch and database name match the pre-existing isolated Neon branch. Production database connections are refused on Preview. Only pre-seeded `example.invalid` review accounts may authenticate; sign-up/reset/email flows are disabled there. OpenAI, Stripe and Resend keys must be absent. Authentication, server-side account binding, plan checks, reservations and usage accounting still run. Fixture data never qualifies as live provider evidence.

Vercel SSO protection remains enabled. No real checkout, email or paid AI call is permitted. Review credentials are stored privately outside Git; the Preview is not public access to cloned customer records.

### Verified remote deployment

- [Protected Preview](https://content-5z2e94um5-nads1983-9570s-projects.vercel.app/studio), deployment `dpl_34PFtDpCEYxD3YabrQ68q46kCBJ6`, **READY**, Preview target.
- Deployed code/report commit: `586a3c9b4e410d7e6b0a7ff003f408193935bb87`. Subsequent changes to this report only do not change the reviewed application build.
- [Draft integration PR #4](https://github.com/nads1983-coder/ContentOS/pull/4). PR #3 remains unchanged and unmerged.
- Remote production build and TypeScript passed. Local final webpack build also passed after the dependency patch.
- Unauthenticated `/studio`: HTTP 302 to Vercel SSO. Existing short-lived project authentication was used for browser checks without disabling protection.
- Full `tests/premium-browser.mjs` passed against the deployed Preview, including actual authenticated generation/refinement routes with fixture transport, exactly-once Neon usage/history, failure recovery, editing/undo/export, decoded template image, account switching and independent-device hydration at 1440/768/390px. Zero browser errors; zero live AI calls.
- Separate remote denial checks: anonymous workspace and generation return 401; signup, reset and non-synthetic login return 403. No account or mail created by those checks.
- Runtime error query returned three PostgreSQL SSL-mode forward-compatibility warnings emitted to stderr (classified by Vercel as error logs), not application exceptions. The installed driver currently treats `require` as `verify-full`; choose explicit certificate verification before a future driver major upgrade. No unexpected application exception was observed in the queried window.
- Final read-only production identity is still `6517cc23cffa9e34dec684bc035d17a5a3b69dea` / `dpl_7ym1m4JGGr51sbnR9YsMm9wuD8ij`. Stripe FOUNDING100 is ACTIVE, 13 of 100 redemptions used, 87 currently available. These are Stripe capacity figures, not a reconciled customer count. No Stripe mutation occurred.

## Production approval and rollback (not executed)

1. Owner reviews the protected Studio and separate lifetime evaluation. Existing monthly plans continue; proposed lifetime pricing is not enabled.
2. Obtain explicit approval for the smallest provider compatibility check using synthetic data: one all-format production-contract text pack, one single-section refinement, and one image if authorised. Confirm actual output, latency, cost, persistence and quota accounting. No paid checks are authorised now.
3. Separately approve production deployment. Recheck the current production SHA, exact integration diff, migration-free JSONB compatibility, Founder ACTIVE status and production configuration. Do not promote this synthetic Preview. Build a distinct production deployment with fixture mode absent, existing production credentials and database, without automatic domain assignment.
4. Verify auth, existing plans, Founder protections, saving, usage, image rendering and non-chargeable security checks before assigning the domain. Monitor generation failures/timeouts, workspace conflicts, quota denials and billing webhook failures; never log source text or credentials.
5. Roll back the domain to the previously verified working deployment if a material regression occurs. Do not restore an old database snapshot or reset usage/history. Added JSONB fields are additive; retained new cloud drafts remain available when the integration returns, although the old UI will not expose all of them. If rollback generation traffic occurs, reconcile the newer durable counters against all subsequent usage events before reactivation; the code uses the maximum of counters/events/history rather than assuming a fresh counter.

## Limits and next decision

Mocked transport proves integration, not writing quality or live provider success. No real Stripe payments or email delivery were tested. Provider-backed text/refinement/image compatibility and owner acceptance are required before production approval. No production, pricing, Founder promotion or customer-data changes were made.

**PASS - PREMIUM STUDIO READY FOR CONTROLLED LIVE ACCEPTANCE.** Phase 1 ends here. Owner review and separate, explicit paid-provider/production authorisations remain required.
