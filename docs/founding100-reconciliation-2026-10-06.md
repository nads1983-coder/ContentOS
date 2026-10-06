# Founding 100 reconciliation summary

This public repository note intentionally contains aggregate counts only. The detailed evidence list, account identifiers, checkout identifiers and proposed repair SQL are stored outside the repository with private file permissions.

## Current evidence summary

- The production app uses Neon Postgres and Better Auth.
- The Founder entitlement is activated by a completed Stripe Checkout Session with the configured Founding 100 promotion code and a confirmed zero total.
- Fourteen reported opt-in emails were checked against account/profile records and Stripe evidence.
- All fourteen reported opt-ins have accounts.
- Two of those fourteen had completed qualifying Founder checkouts and already had Founder access.
- Twelve had accounts but no qualifying completed Founder checkout evidence, so they must not be upgraded from the opt-in list alone.
- Seven active Founder profiles existed in Neon at review time, one of which was known test data.
- Six real customer Founder accounts were verified.
- Stripe reported seven Founding 100 redemptions, including one known test redemption.
- Stripe-enforced remaining capacity was therefore ninety-three, even though the intended real-customer remaining capacity was ninety-four if the known test redemption is accounted for.

## Public repair position

No production data repair, Stripe capacity change, customer contact or production deployment was performed as part of this PR.

Any future repair should be applied only from the private evidence packet after a fresh backup and approval. The repair must remain idempotent, preserve existing account IDs, content, usage history and entitlements, and only update records where qualifying checkout evidence is established.

## Capacity position

The app now treats Stripe's active Founding 100 promotion code as the source of truth for checkout capacity. Stripe remains the final concurrency and redemption-limit enforcement layer. The app performs an early availability/configuration check to avoid sending users into an exhausted or misconfigured Founder checkout.
