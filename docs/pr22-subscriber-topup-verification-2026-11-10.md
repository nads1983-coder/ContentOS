# PR 22: subscriber top-up verification — 10 November 2026

**PASS for the isolated local subscriber top-up protection scenario.** This is not a production launch or deployed-Preview verification.

## Isolation and preflight

The clean branch began at `8c33e4b`. The QA endpoint was restricted to Neon project `quiet-fog-56852665`, branch `br-hidden-recipe-b9yqeimn` and database `pr22_payments_qa`; PostgreSQL confirmed that database and role `neondb_owner`. Earlier control-plane evidence establishes this project is separate from production project `long-hat-93822871`. Stripe requests used a restricted test-mode key and a test card. No live payment method, production database or public sales configuration was used.

The existing synthetic `example.invalid` QA account `d90f6432-894f-4f49-9723-c4f95e60b767` had one prior canceled test subscription and no active, trialing, past-due, incomplete, unpaid or paused subscriptions across all Stripe test customers matching its synthetic email. No existing subscription was duplicated.

## Genuine Stripe test results

The founder authorised at most one £9 Creator subscription Checkout and one £5 Starter top-up Checkout. Both completed in Stripe test mode:

- Creator Checkout `cs_test_a1omGxSsPfJ8AmiMNwgXjD5FVEdBxyoOtOivJbmP1P7h6Ko54sgB1qCDHt` completed and was paid, creating `sub_1UaGkEFnoS3uqGtrqecSoENR` for `cus_VbThdMarE2FdAH`. Application subscription-state reading and repository reconciliation recorded active `pro_creator` in QA.
- Starter Checkout `cs_test_a1hHfnyxupzD9nAMjgbgEDnhfsZEwwTpjI2Fn5gvTo9LqndktOryfTg9oY` completed and was paid for £5; PaymentIntent `pi_3UaGm9FnoS3uqGtr1BZJrimF`. Application fulfillment verified Stripe data and recorded purchase `d7b3c41b-b321-4b4c-b8b1-f92c26c404c2` as paid.
- Purchased balance increased from **0 to 25**. The ledger has exactly one 25-credit grant; purchase history shows Starter, 500 pence, 25 credits, paid, zero consumed and zero reserved.
- Genuine Stripe event `evt_1UaGmAFnoS3uqGtroTpAE1Mo` was fetched and replayed twice against the actual webhook handler with a temporary **locally generated signature**. Both returned 200 and the ledger remained one grant. This is genuine event data and local signature verification, not a new Stripe-delivered webhook or deployed endpoint.
- Before and after top-up, the subscription was active on price `price_1UUp85FnoS3uqGtrLJbybVVv`, quantity 1, not scheduled to cancel, with Stripe item period 10 November to 10 December 2026 at 15:13:57 UTC. A complete check of all Stripe test customers for the synthetic email found exactly one nonterminal subscription after purchase. The QA subscription fields and generation usage counters were unchanged; the Creator limit remained 50 per month.

Top-up checkout and fulfillment were enabled only through local test-harness dependency injection. Tracked public offer flags remain disabled. The test subscription remains active in Stripe test mode to preserve the requested after-state; coordinate its eventual cancellation when the fixture is no longer needed. It cannot charge live funds.

## Separate billing-period finding

The application's configured Stripe API version `2026-02-25.clover` returned no top-level subscription `current_period_end` for this test subscription, while its subscription item had `current_period_end = 1796915637`. The application subscription reconciliation stored `subscription_current_period_end: null` both before and after the top-up. The top-up did not cause or alter this condition, but `lib/stripe-rest.ts` reads the top-level field and `lib/usage.ts` falls back to a calendar window when no billing end is available. Investigate and test this separate subscription renewal/usage-window issue before launch; this scenario does not prove correct subscription-period resets.

## Checks and remaining launch restrictions

30 targeted top-up/subscription tests passed; TypeScript and lint passed. The previously exposed Stripe test credentials, including the standard test secret, and the Vercel automation bypass still require coordinated replacement and revocation. Current Preview isolation, deployed signed webhook delivery, scheduler/alerts and the separate AI quality and funding gates remain outstanding. The £30 ceiling, model routing and commercial entitlements were not changed; sales remain disabled.
