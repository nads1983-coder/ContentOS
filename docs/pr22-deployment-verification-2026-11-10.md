# PR #22 Preview deployment verification — 10 November 2026

**DEPLOYMENT-NOT-READY.** The current deployment's runtime isolation, Stripe webhook delivery and deployed operations remain unverified. Do not enable sales.

## Deployment and isolation

At verification, Vercel reported READY Preview deployment `dpl_BGEz8RY168m2novzz5xfoZ3Hqrrn` for branch `feat/paid-creator-lifetime-2026`, commit `e2b39e2204376a5f536b283eca8d2010e64fcf8e`. A browser with authorised Vercel access reached `/api/internal/preview-isolation`, which returned HTTP 401 without the application's separate diagnostic bearer. Vercel's environment-variable metadata shows branch-specific diagnostic, database, Stripe secret-key and webhook-signing variables; names and scopes do not prove their runtime values.

The diagnostic bearer is not available to this session. An independently verified expected digest for the configured test webhook secret is also unavailable, as is a verified comparison of the deployed key with the approved Preview replacement. Therefore the runtime database identity, separation from production, test-key identity, exact webhook-signing configuration and absence of inherited live Stripe credentials are **unproven for this deployment**. The earlier successful diagnostic for `dpl_AWjRseBb83A59zQTjbXKFJv8NcFR` is evidence only for that older deployment and configuration.

Pushing this report may cause Vercel to build a newer Preview. That deployment must be identified and its own runtime configuration verified; this report does not certify it.

## Stripe and operations

No Stripe event was sent to this deployment. The former test webhook endpoint was disabled after an earlier isolated test. A protected test-only delivery route and an independently established signing secret must be configured and verified after current runtime isolation is proven. The previously exposed Vercel bypass and Stripe keys must not be used. No current-deployment signature validation, successful event processing, duplicate-event handling or production-data isolation has been demonstrated.

The deployed reconciliation worker was not invoked. Retry behaviour, job reporting, administrator visibility and external alert delivery were not tested against this deployment. A non-production trigger and authorised test alert destination are required; the production Vercel cron configuration is not evidence of Preview execution. No remote migration or production database write was attempted.

## Checks and access required

- The targeted Preview diagnostic, lifetime webhook, Stripe, top-up and reconciliation-admin suites passed **20/20** locally. TypeScript and lint passed. These are local checks, not deployed integration results.
- PostgreSQL integration checks were not run: no disposable local PostgreSQL server or container runtime was available. No remote database was used as a substitute.
- Secure access is needed to the existing PR-only diagnostic bearer, the independently derived digest of the exact intended test webhook signing secret, and an independent identity comparison for the approved Preview Stripe replacement key. The values must not be printed or committed.
- After isolation is proved, establish a protected test-only event delivery path without the exposed project-wide bypass, deliver a real Stripe test event and replay it, then verify the isolated database outcomes. Use an authorised Preview-only worker trigger and test alert destination to verify operational paths.

No new application defect was established in this pass; the missing integration evidence and access are release blockers. Customer-facing sales remain disabled. No live Stripe configuration, production deployment, production migration, pricing, entitlements, model routing or AI spending limit was changed.
