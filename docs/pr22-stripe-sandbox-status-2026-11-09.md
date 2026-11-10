# PR #22 Stripe sandbox verification status — NO-GO

Starting commit `b696313fcfcaddfbab62f050e648cef72eb5e1a3`, 9 November 2026. No payments, remote migrations, webhook configuration, live Stripe changes or production writes were performed in this pass. Both lifetime and top-up Checkout and fulfillment flags remain false.

The current branch was clean at the starting commit. Vercel reports Preview deployment `dpl_64iK81W4GAWaX8BK2FfF1c2Y3d21` for that exact commit READY. The existing build-time fixture guard requires the PR branch, specific isolated Neon QA endpoint/database, QA branch marker, test-mode Stripe secret prefix and empty OpenAI/Resend credentials. Prior Vercel metadata confirmed PR-specific empty Stripe webhook and publishable-key overrides; the current test webhook is deliberately not configured. These are build/configuration signals, not independent proof of runtime PostgreSQL server/database/role identity or a functioning signed test webhook. No existing endpoint returns a safely authenticated runtime identity assertion. Do not perform remote migrations or payment scenarios until the runtime target and all Stripe credentials are independently verified.

The current Stripe connector inventory offers PIERNEXA in **live mode only**. The named restricted test key was verified through an authenticated dashboard in the preceding report, and its temporary local copy was deleted. No new test key was obtained or used in this pass. Do not send a live-mode request to substitute for a missing sandbox connection. The endpoint signing secret and publishable test key still need test-only creation/configuration after runtime isolation is proved. Existing Checkout and fulfillment code has explicit disabled flags; real end-to-end test scenarios need an independently reviewed test-only harness or build that cannot enable live sales.

## Fresh local checks

- 47 targeted Preview, lifetime and top-up tests passed.
- TypeScript and lint passed.
- 22 disposable localhost PostgreSQL compound checks passed, including migration rollback/rerun, payment reversal persistence, concurrent allocation, credits and reviewed reinstatement. The last check exercised local HTTPS alert failure/retry and authenticated cron-handler dispatch. It does not establish a deployed scheduler, external alert delivery, or a real Stripe integration.

## Remaining work

1. Establish a secure, authenticated runtime-only assertion of database identity and test credential mode, and verify no inherited live webhook or publishable credentials on the exact deployment. Verify the selected database is the prepared synthetic QA database and that runtime roles cannot write production. Do not expose secret values.
2. Configure a signed Stripe **test** webhook and test publishable key for the PR-specific Preview only; verify reachability and signing. The currently empty branch-specific webhook value keeps this path closed.
3. Review and run an isolated test-only flow with genuine Stripe test Checkout, independently retrieved provider objects, signed events and database assertions. Cover both lifetime prices, all top-ups, duplicates/delays, failures/expiry, full/partial refunds, disputes, balances and subscription protection. Record sanitised test IDs. Nothing in the local tests is evidence of those transactions.
4. Verify deployed scheduler execution, persistent retry state and actual delivery to an authorised test alert destination. The repository's once-daily cron is not proof of timely retry execution.
5. Retain the £30 budget and disabled sales; independently review the remaining AI-quality and funding blockers before any launch decision.

**NO-GO.** Real Stripe sandbox verification and deployed runtime isolation remain unproven.
