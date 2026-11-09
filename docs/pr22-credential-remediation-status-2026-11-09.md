# PR #22 credential remediation status

9 November 2026. This is an interim security handover; remediation and end-to-end payment verification are not complete.

## Confirmed exposure and dependencies

The pre-existing Vercel automation bypass exposed in the previous run is the `content-os` project's designated system environment bypass, created on 12 September. It can grant access to protected deployments across the project. Its external consumers are not inventoried by the dashboard view and no reference to the bypass environment-variable name or header was found in the current tracked source. That absence does not establish that external integrations do not use it. Replacing or revoking the designated secret may disrupt such integrations and existing deployment values. The later temporary bypass created for the Stripe delivery test was revoked in the previous run.

The Stripe test-mode dashboard exposed the named restricted QA key, another restricted test key, and the standard test secret key in the previous run's tool output. Treat all three as compromised; the publishable test key was also visible but is intended for client exposure. The named QA key's request log includes the previous Preview and Stripe QA calls. This is not a complete review of all consumers or an investigation of all historical activity. The old test webhook is disabled. No live Stripe key was exposed in that output.

The Vercel connector returned 403 when listing project environment variables. The existing global and project-local Vercel CLI were not installed. The account-owner dashboard can display the project environment-variable metadata and the test Stripe key rotation dialog, but no credential rotation or environment change has been performed in this pass. Safe replacement requires preserving or explicitly coordinating the known PR Preview consumer and identifying other consumers before removing any existing credential; the standard test key and pre-existing bypass may have unrelated integrations.

A local scan of `git log --all -p` found no matches for the checked Stripe live-key, test-key and webhook-signing-secret patterns. This is a pattern scan of locally available Git history, not proof that all historical, external or unusually formatted secrets are absent. The exact Vercel bypass value was not compared against history. No credential value is included in this report.

## Payment and operational status

The prior report records verified runtime isolation for deployment `dpl_AWjRseBb83A59zQTjbXKFJv8NcFR` and one genuine Stripe test-mode generic expired-session webhook delivered with HTTP 200. That is not an application purchase or entitlement test, and the configured test endpoint is now disabled. No new Stripe transactions, deployed scheduler execution, alert delivery, remote migrations, production changes, or live charges were performed in this pass. Both customer-facing checkout and fulfillment remain disabled for lifetime and top-up offers. The deployed reconciliation schedule exists in configuration but execution and alert delivery remain unverified.

The required £99/£149 lifetime and £5/£9/£15 top-up purchases, credit issuance and consumption, refund/dispute decisions, duplicate processing, administrator reinstatement, subscription protection and deployed reconciliation remain unverified with real Stripe. A safe isolated test-only fulfillment method is required without enabling public sales. Runtime isolation must be rechecked after rotating credentials or changing the deployment.

## Local verification

The four Preview diagnostic tests passed. TypeScript and lint passed. The full suite and PostgreSQL integration tests were not rerun in this limited investigation.

## Next actions

1. In test mode, prepare minimum-permission replacement credentials and securely update the PR-specific Preview consumer; review the named QA key, the other restricted test key, and the standard test secret key for additional consumers and suspicious activity. Coordinate each consumer before revocation. Do not touch live credentials.
2. Inventory users of the existing project-wide Vercel bypass and coordinate its replacement and revocation; verify legitimate automation afterwards. Avoid putting bypass secrets in logs, command arguments, reports, or URL output.
3. Re-establish a narrowly scoped protected test webhook, reprove the exact Preview runtime database and test-credential identities, and execute the genuine payment and operational checklist using isolated test accounts and an explicitly safe fulfillment test path.
4. Keep lifetime and top-up sales disabled and retain the £30 budget. Launch remains NO-GO until these checks and the independent financial and AI quality gates pass.
