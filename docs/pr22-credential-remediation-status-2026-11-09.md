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

## Restricted test-key replacement prepared

A new Stripe test-mode restricted key named `GetContentOS PR22 isolated sandbox QA – Nov 2026` was created on 9 November. Its selected permissions are Checkout Sessions write, Charges and Refunds write, Payment Disputes write, Payment Intents read, Events read, Webhook Endpoints and Event Destinations write, Customers read, and Subscriptions read. Read-only requests to Stripe test events, Checkout Sessions, and webhook endpoints returned HTTP 200. No live credential was created. The temporary local copy was deleted.

The PR-specific Preview `STRIPE_SECRET_KEY` editor was located with the exact branch scope and is awaiting account-owner entry of the new credential. Until that change is completed and a new deployment is verified, the Preview has not been migrated to the replacement key. Existing exposed credentials remain active and must be treated as compromised. The standard test key's dashboard shows historical test API reads involving charges, Checkout Sessions, events and webhook endpoints; their consumers have not been conclusively identified. No old credential was revoked in this pass.

## Preview update and current verification gap

The account owner reported saving the new test key, and the Vercel dashboard showed the branch-specific Preview `STRIPE_SECRET_KEY` secret as recently updated. This confirms the scoped setting was changed, not its value or a running deployment's key. A read-only authenticated diagnostic was extended to compare the running test key with a caller-supplied SHA-256 digest of an independently held key. It rejects mismatches and live key prefixes without returning key material. Five diagnostic tests, TypeScript, and lint passed.

The diagnostic bearer and former test webhook signing secret were deleted from the local workspace after the previous verification. The latter endpoint was disabled. Therefore the new deployment's running database and exact key have not yet been verified, and no new genuine payment or webhook scenario has been performed. Re-establish a fresh PR-only diagnostic secret and a test webhook signing secret through authorised Vercel access; verify the runtime on the exact deployment before payment tests. Protected Stripe webhook delivery additionally requires an explicitly authorised, temporary protected-deployment access path. Existing compromised credentials and the pre-existing Vercel automation bypass still require coordinated rotation.
