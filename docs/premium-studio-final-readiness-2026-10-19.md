# Final Premium Studio readiness

## Decision

**READY FOR OWNER-AUTHORISED LIVE COMPATIBILITY TEST.** Not production launch approval.

PR #4 remains draft on `feat/premium-studio-production`. The reviewed application is unchanged from protected Preview code `586a3c9b4e410d7e6b0a7ff003f408193935bb87`; the final validation commit adds tests and documentation only. Its exact SHA is recorded in the PR description. PR #3 remains untouched.

Production was rechecked read-only: `6517cc23cffa9e34dec684bc035d17a5a3b69dea`, READY deployment `dpl_7ym1m4JGGr51sbnR9YsMm9wuD8ij`, existing `content-os` project. No production mutation, payment, email, provider call or new deployment occurred during this final review. Founder remains ACTIVE under the existing rules; the earlier same-day Stripe inspection recorded 13/100 redemptions, 87 available, not a reconciled customer count. No capacity or entitlement change is proposed.

## Final checks actually executed

- `node tests/premium-release-preflight.mjs`: PASS. Byte-identical production prompts, format configuration, Stripe/Founder/entitlement/usage rules and billing webhook; AST comparison confirms the exact original structured schema and seven parser/normalisation function bodies. All 14 formats pass synthetic response parsing. This proves contract preservation, not a successful provider response.
- `node --test tests/premium-integration.test.mjs tests/generation-route.test.mjs tests/generation-reservation.test.mjs tests/workspace.test.mjs tests/founder*.test.mjs`: **98 passed, 0 failed**. Covers route orchestration, reservation/replay, account-scoped workspace and Founder protections.
- `tests/premium-final-browser.mjs`: PASS on the existing protected remote Preview. Actual synthetic-account authentication, brand/audience/offer/voice cloud save and reload, saved-library search, reopening an existing 14-format pack, clipboard copying, responsive 1440/768/390px layouts and Escape/focus restoration. No horizontal overflow or browser errors. All generation requests were blocked by the test, with **zero attempted generation requests**. Synthetic preferences were restored at completion.
- The first browser attempts encountered an exact-label selector mismatch on a populated textarea. Using its accessible textbox role resolved the harness issue. No application defect or cosmetic correction was established.
- Final script syntax and `git diff --check`: passed.

The prior **187-test full suite, typecheck, lint, local and remote webpack production builds, isolated Neon auth/cloud and image concurrency tests, and full remote Studio workflow** remain applicable: no application, dependency, build or configuration file changed in this final pass. They were not redundantly rerun. See [prior executed evidence](premium-studio-preview-2026-10-19.md) for commands and limitations. That workflow covered editing/undo/refinement/export, actual exactly-once Neon history/usage, injected error recovery, template image rendering, multiple devices and account switching, with explicitly simulated AI transport.

## Protected Preview

[Existing Studio Preview](https://content-5z2e94um5-nads1983-9570s-projects.vercel.app/studio), deployment `dpl_34PFtDpCEYxD3YabrQ68q46kCBJ6`, remains SSO-protected. Private synthetic login instructions and screenshots are outside Git. Existing denial checks cover anonymous workspace/generation, disabled signup/reset and non-synthetic login. This is not a public customer-data preview.

Visual review found a clear brief-to-output hierarchy, accessible named controls, compact format selection and usable mobile navigation. This was a targeted keyboard/layout review, not a formal WCAG certification. Existing loading/error/recovery checks were reused.

## One paid request proposed, none authorised or executed

The shortest useful remaining test is **one all-14-format standard-length text request** through the real application route, followed by non-chargeable rendering, saving, editing, undo, export, recovery and usage verification. Do not regenerate the result. Live image and additional refinement calls are not included; existing contract and mocked integration evidence cover them with that limitation explicitly retained.

`tests/premium-release-preflight.mjs` prepares the exact synthetic request without loading credentials or transport:

| Bound | Prepared value |
|---|---:|
| Serialised request | 9,723 UTF-8 bytes |
| Input reservation | 13,819 tokens (entire serialised bytes + 4,096 framing allowance) |
| Maximum output, including reasoning tokens | 24,000 tokens |
| Model assumption, requiring runtime verification | gpt-5.2 |
| USD maximum at verified rates | 0.36018325 |
| Planning GBP/USD multiplier | 0.85, not a spot FX quote |
| GBP reservation before billing contingency | 0.3061557625 |
| GBP with 20% contingency | 0.367386915 |
| Proposed total owner-approved ceiling | **GBP 0.50, one request, no automatic retry** |

Payload SHA-256: `16eff427014842649ffa5db691f6fc27e645dd04935ef3536aa69a5f8f2efe7e`.

[Official GPT-5.2 pricing](https://developers.openai.com/api/docs/models/gpt-5.2), checked 19 October 2026: USD 1.75/M input and USD 14/M output. No cached-input discount is assumed. The source and limits are fixed in the preflight script. This is a conservative proposal, not an actual charge or guaranteed price for an unknown model override.

**Important preconditions:** Vercel identifies `OPENAI_MODEL` as sensitive and did not reveal its value. The code default is GPT-5.2, but the actual inherited production model must be securely compared server-side before dispatch. Recheck model pricing, FX/billing overhead, exact serialised payload and token limits. Stop without calling if they do not fit the GBP 0.50 ceiling; do not change the production model to fit this estimate.

The current fixture Preview intentionally refuses OpenAI/Stripe/email credentials, and Preview database access requires fixture mode. It cannot safely become a live runner by simply adding a key or disabling the fixture guard. After owner approval, prepare a tightly scoped temporary acceptance execution in the existing project using the existing server-side credential, isolated Neon, operator authentication and synthetic-account restrictions. Keep production-database, customer-login, payment and email denial controls. Verify this restricted execution path with non-chargeable checks first. If secure credential access is unavailable, stop; do not export or replace the key or weaken SSO.

Reserve the entire approved maximum atomically before the sole provider dispatch, with one campaign/account/request identity. Concurrent/repeated requests must not dispatch again. Failed or uncertain calls retain the monetary reservation; they never automatically retry. Use the real route's admission, parsing, completion and persistence logic, not a standalone response masquerading as an application success. No additional paid campaign is proposed.

Acceptance evidence must include all 14 format IDs, complete provider status, measured tokens/latency, independently inspected final content, one history result and one successful-usage increment. Reload in a second isolated browser to verify persistence. Editing/undo/export must use that real result; failure recovery and account denial checks must remain non-chargeable. Replaying an already persisted successful request must return the existing result with no provider dispatch. Any uncertainty stops the test and preserves the draft/audit. Remove temporary execution access afterwards, retaining the spending record.

Ordinary output remains an AI-generated draft requiring customer review. No independent factual-certification promise or PR #3 experimental reviewer is introduced.

## Pricing and residual risks

The [finite lifetime-credit evaluation](premium-studio-lifetime-evaluation-2026-10-19.md) is unchanged: assess a small, explicitly capped GBP 49 cohort alongside subscriptions, with 50 non-renewing text credits and 5 images. GBP 29/25 text/0 images and GBP 79/100 text/10 images were also modelled. Do not sell unlimited or monthly-renewing lifetime AI.

At the existing stress assumptions, Core heavy-use contribution is GBP 14.56 before VAT and about GBP 6.40 if the price includes 20% VAT, after the assumed operating reserve but before acquisition/refunds/disputes. Historical retained usage is insufficient to establish lifetime demand or actual average generation cost. Higher provider costs and long-term hosting can erase those margins. Purchased-credit fulfilment is not implemented or approved; no Stripe prices are created.

Production dependency audit previously passed with zero advisories. Seven development-only audit entries trace to the same braces glob-parser issue; keep untrusted glob patterns out of build/lint tooling. The pg SSL forward-compatibility warning needs explicit verification mode before a future driver upgrade, not an unrelated migration now. No new critical defect was established in this final review.

The owner's GBP 60 is the total remaining upgrade budget. The proposed GBP 0.50 is part of it, not an additional phase allowance. Codex sterling consumption is not available as an enforceable programmatic cap; no claim is made that the entire balance has been measured. No credit purchase, new service or paid infrastructure is authorised.

## Exact release and rollback procedure (not executed)

1. Obtain explicit approval for the single-call cap and restricted isolated execution above. Pass its security/spend preflight and real-provider acceptance. Record the exact tested SHA; stop on failure rather than purchasing more tests.
2. Obtain separate owner approval to merge/deploy that exact PR #4 release. Re-read production SHA and deployment; if either differs from the baseline above, review only the intervening change before proceeding. Keep PR #3 unmerged, Founder ACTIVE and existing subscription prices unchanged.
3. Verify the release lockfile, production auth origin, current Neon/Stripe/OpenAI bindings and absence of fixture flags/isolated database settings. No schema migration is needed. Preserve the existing database and all reservations, content and entitlements.
4. Build a separate production-target deployment from the approved SHA using the already verified webpack build command, initially without assigning the public domain. Do not promote the synthetic Preview or copy its environment. Do not create new keys or change existing credentials.
5. Run non-chargeable authentication, account-isolation, workspace, plan/Founder and public checkout-entry checks; verify image renderer/template fallback and static assets. Do not initiate a checkout/payment or chargeable generation as a smoke test. Verify no fixture banner/data appears and the real-provider transport is configured as approved.
6. Assign the production domain only after those checks pass. Recheck production deployment/SHA, login, saved content, subscription access and Founder presentation. Monitor route error rates, failed/uncertain reservations, persistence failures, stale-write conflicts and billing webhook errors without logging customer source text or credentials. Use organic authorised generation evidence; do not invent successful live output.
7. If authentication, billing, isolation, saving or generation materially regresses, roll the domain back to `dpl_7ym1m4JGGr51sbnR9YsMm9wuD8ij` (or the freshly verified baseline if changed before approval). Do not restore database snapshots or reset usage/history/claims. Added profile JSONB is additive. Preserve new drafts even if the old UI cannot expose them; reconcile subsequent usage/events before reactivation rather than resetting counters.

Founder retirement, lifetime billing activation and additional paid requests are excluded. The minimum next owner decision is whether to approve the single isolated real-provider request with a **GBP 0.50 total cap**, conditional on the mandatory server-side preflight. Production remains a separate decision.
