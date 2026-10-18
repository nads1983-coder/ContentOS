# Replacement Preview: infrastructure NO-GO

Application candidate: `b7e27e8aaf5fd0d15d643306e774b4bc5355ecd7`, existing draft PR #3. Application source remains unchanged. One explicitly approved replacement Preview was attempted in the existing project; no other benchmark deployment or provider call was made.

## Confirmed failure

The retained complete [build log](build-log.txt) shows **npm EUSAGE** during `npm ci --ignore-scripts --omit=dev`: package.json and package-lock.json were inconsistent, with **pg@8.23.0 and its transitive package entries missing from the lockfile**. Vercel wrapped this installation error as **BUILD_UTILS_SPAWN_1**. It occurred before the build script, runtime initialization or any paid request.

This is a **temporary acceptance infrastructure/packaging failure**, not a new model-semantic failure or demonstrated customer-security/billing defect. The first failed Preview had the same wrapper code but no retained inner log; this run establishes its own exact inner failure, not proof that the earlier run had an identical cause.

The original uploaded lockfile was not retained before cleanup, so the reason remote inputs differed from the successful local install cannot be proven. A clean reconstruction using npm 11.12.1 / Node 24.15.0 passed `npm ci` locally. No claim is made that Vercel cache or npm versions caused the discrepancy.

## Minimum deployment correction prepared

The replacement runner was changed to perform **no paid work during build** and to require READY, SSO verification and signed zero-provider runtime preflight before any bounded stage request. One stage per request reuses the exact application transition functions and existing restricted atomic ledger. No production endpoint or application behavior was changed. Local tests verified this wrapper; it was not reached remotely because installation failed.

After the captured installation failure, packaging is now pinned to a generated, checked-in **runner-only** lockfile. The closed operator copies that exact file, requires a local clean `npm ci`, preserves package.json/package-lock.json/vercel.json privately before upload, and the installer validates package/lock agreement and records their hashes before remote `npm ci`. The installer passed locally. This is a focused packaging/diagnostic correction, **not a remotely verified fix**. No second replacement deployment was attempted.

## Actual acceptance result

| Check | Result |
| --- | --- |
| Preserved draft | 14 formats, 307 units; no regeneration |
| Reused original responses | 96 locally accepted certificates; six unsupported decisions retained |
| Remaining initial reviews | 0 of 5 executed |
| Correction / fresh revalidation | Not reached / 0 of 7 executed |
| Final validated pack / independent assessment | None / not possible |
| New history entries / successful usage | 0 / 0 |
| Provider uncertainty | None: zero new dispatches/jobs |
| Recovery | Draft, both reviews and all audit records recoverable |

| Spending | New | Combined |
| --- | ---: | ---: |
| Paid calls | **0** | **3** |
| Conservative reservation | **GBP0** | **GBP0.792508** |
| Usage-priced cost | **USD0** | **USD0.13628790** |
| Reference GBP cost estimate | 0 | 0.102201 |

The GBP2.28 new / GBP3.08 combined limits are unchanged. All 12 permitted additional provider calls remain unspent. However, the single replacement deployment permission was consumed; unused API funds do not authorize another deployment or retry.

Pricing was rechecked against [OpenAI GPT-5.2](https://developers.openai.com/api/docs/models/gpt-5.2): USD1.75/M input and USD14/M output. The conservative GBP1.10/USD bound and 56,000-byte / 4,800-output-token limit were unchanged. Five initial payloads remained 54,421 / 54,611 / 54,592 / 55,247 / 50,061 bytes. Uniform maximum new reservations remain GBP2.275260, combined GBP3.067768. No truncation or factual-review weakening.

## Executed evidence

- Five local checks PASS: linked historical manifests/96 certificates, signed operation binding/expiry, all twelve explicit mock review steps plus one save/usage and duplicate replay, bounded payload rejection, uncertainty/no retry. Mock reviewers establish orchestration only, not live content accuracy.
- Twelve real isolated-Neon checks PASS: all four prior audit records match, including the zero-spend failed Preview; restricted access, account binding, concurrent reservation, both original-review keys refused, new/combined caps and uncertainty stop. Synthetic test fixtures removed afterward.
- Exact packaged zero-provider build PASS locally. Exact packaged HTTP handler's signed preflight PASS locally with restricted isolated database credentials and a synthetic placeholder key; provider transport was disabled. Actual OpenAI credentials were never exported or used locally.
- Hosted dependency installation FAIL as above. Build never reached READY; no hosted SSO HTTP or authenticated runtime preflight success is claimed. Existing project SSO configuration was checked and left unchanged.
- Focused post-failure clean-install reconstruction and pinned installer PASS locally. Wrapper syntax/diff checks PASS. Unchanged application build/test/browser evidence reused, not rerun or represented as new live acceptance.

## Diagnostics and cleanup

Complete remote build events were retrieved successfully **before deletion** and retained privately and as the reviewed text log above. Cleanup verified the isolated campaign disabled, runner NOLOGIN, function/schema access revoked, sessions terminated, audit exported, deployment deleted and deletion confirmed. Temporary private connection/signing state and staging files removed. The prior three paid audits and zero-spend failed campaign were not overwritten or reopened. The current synthetic audit/checkpoint remain for recovery.

No customer data, production schema/configuration, Stripe price/subscription, existing account, content, usage or Founder entitlement was changed. Preparation/execution are permanently closed; no public unsigned execution or automatic paid retry is available. Founder remains unchanged and ACTIVE.

## Final decision and safe alternative

**NO-GO for the upgraded public AI-first release.** The outstanding gate is essential live delivery and independent assessment. This run gives no new reason to redesign factual validation or weaken customer protections: it failed before reaching them.

The minimum safe alternative **now** is to keep the existing production version operating with Founder ACTIVE and retain the unmerged draft PR. A manual-only upgrade is not asserted safe for immediate launch: it would still need explicit server-side generation restrictions, clear UI messaging and direct-route/no-charge checks, which this task did not implement. It is not a substitute for a verified AI-first launch.

The targeted lockfile correction is ready for remote verification, but any additional temporary deployment requires separate owner permission. **No additional API budget is requested.** No further deployment or paid campaign is initiated automatically. Only after successful live acceptance should the prepared [production/rollback package](../../final-launch-decision-2026-10-18.md) be considered for explicit production authorization. Founder retirement remains prohibited until authorized launch succeeds and production verification passes, preserving existing benefits.
