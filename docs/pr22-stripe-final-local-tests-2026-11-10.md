# PR 22: focused Stripe local verification — 10 November 2026

**PAYMENT-NOT-READY.** Prices: Read and Subscriptions: Write were approved and applied only to the named restricted Stripe test key. Stripe test API verified access to the existing test Creator price and subscription writes. No live Stripe configuration was changed.

## Full refund after credit consumption

Stripe approved and completed £15 test refund `re_3Ua7cZFnoS3uqGtr1tXwnvKS` on PaymentIntent `pi_3Ua7cZFnoS3uqGtr1NYurJyV`. The isolated QA database and the Stripe PaymentIntent were independently confirmed as QA and test mode. Application reconciliation changed purchase `1e208891-34f2-4948-9c3b-f8799b583ff0` to `revoked`; its two previously consumed reservations and two consume ledger entries remained, and the 98 unused credits are excluded from available balance by the account-summary query. There was one original grant and one reverse entry.

Genuine Stripe event `evt_3Ua7cZFnoS3uqGtr1ZuFt2v2` was fetched and passed through the actual webhook handler twice using a temporary **locally generated signature**. Both calls succeeded, with one event record and one reversal ledger entry afterward. This verifies local idempotency with genuine event data, not a fresh Stripe-delivered webhook or deployed endpoint. The two test credit settlements simulated delivery; no model generation was performed.

## Real test subscription

A new synthetic QA user completed a real Stripe test-mode Creator Checkout at the existing £9/month test price `price_1UUp85FnoS3uqGtrLJbybVVv`; Checkout `cs_test_a1hUbS8Uxa8k2Nb2n2gXf6Y3CioI5j0gj1CTLxnb4VjSY0KePxO8q1ZeBG` returned complete/paid and created subscription `sub_1UaGQcFnoS3uqGtryJXr3qm6`. The application subscription state reader fetched Stripe and resolved active `pro_creator`; the actual repository persisted this to the isolated synthetic QA profile. With lifetime checkout enabled only in the local test harness, the actual reservation service rejected the active Creator subscriber before creating a lifetime reservation. This is real Stripe state with local service execution, not a deployed webhook test.

A £5 top-up Checkout for that synthetic subscriber was prepared with the application service and local-only test offer configuration. Automatic approval review rejected submitting the additional sandbox payment as outside the narrowed two-test scope; no payment was submitted. The session was expired in Stripe and the application reconciled it as expired/unpaid. Consequently, buying a top-up while subscribed and verifying an unchanged subscription remains **unverified**. The separate cleanup cancellation of the synthetic subscription was approved through Stripe's test review, and Stripe and the synthetic QA profile now both show canceled. Existing subscriptions were not modified.

## Credential exposure and checks

After the permission update, the Stripe API keys dashboard unexpectedly returned unredacted test credentials in a tool output. This included the restricted PR22 key, other restricted test keys and the standard test secret key. Treat all displayed test secret keys as compromised. Identify their legitimate consumers, prepare and securely deploy minimum-scope replacements, then coordinate revocation and verify integrations. Do not print their values or assume the earlier remediation is complete. The previously exposed Vercel automation bypass still needs its own coordinated rotation. The new test-key permissions remain applied.

Targeted lifetime, top-up and subscription tests passed **61/61**; TypeScript and lint passed. No application code or commercial settings were changed. Current Preview isolation, deployed signed webhook/scheduler/alerts, actual subscriber top-up invariance, credential rotation and the separate AI/funding launch gates remain outstanding. Sales remain disabled.
