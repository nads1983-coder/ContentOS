# Owner-approved Lite reopening, 26 October 2026

The owner authorises restoring new Lite purchases after recovery deployment `dpl_9zFvR4TEaaoLF1tiaxBwXwdovqVu`, commit `94b5c99845a80b0eec7a28748248246495ec9b18`.

## Scope

Lift only `LITE_PURCHASES_SUSPENDED`. Keep the reversible guard, strict dedicated-portal validation, deleted/missing-customer recovery, cancellation handling, price-authoritative entitlements, all quotas and spending controls unchanged. No migrations or customer-record mutations.

Lite remains GBP5/month with 10 pooled text operations and no AI images. Creator and Studio remain GBP9/50 and GBP39/250 plus 100 image credits. Existing Founder and complimentary owner benefits remain independent of Stripe.

## Preflight evidence

- Recovery is READY and serves the production domains. No error/warning/fatal runtime entries since recovery in the inspected interval.
- Stripe created a dedicated portal session for a valid existing customer without changing a subscription. Deleted-customer recovery remains covered by route and dashboard regressions; no replacement customer was created.
- Active Lite price `price_1UUpbNFnoS3uqGtrwgQGjM1a` is GBP500/month, licensed, quantity one. Production Lite and portal environment ID mappings match.
- Dedicated configuration `bpc_1UUpfgFnoS3uqGtrfnzXblpu` retains immediate price-only switching, create_prorations, unchanged anchor, period-end cancellation, invoice history and payment methods. Restore only Lite to its existing Creator/Studio catalogue. Do not change default or TaskPilot configurations.
- Read-only profile fingerprint matches incident recovery; no Lite profiles currently exist. Opening spending, request accounting and firewall version 5 are unchanged.
- 416 full-suite tests passed; typecheck, lint and production Webpack build passed. Coverage includes reopening, reversible containment, deleted customers, account binding, monthly reset, Lite image refusal, subscriptions, Founder/owner protections and spending limits.

## Controlled activation and recovery

Stage a production-environment build without assigning public domains. Verify READY and exact source. Restore Lite in the dedicated portal immediately before promotion; verify the promoted deployment and portal together. Abort or restore the two-price catalogue and recovery deployment if activation fails. A short configuration mismatch during the paired cutover fails closed rather than falling back to a shared portal.

Retain the recovery deployment as the Lite-compatible rollback anchor. Rollback must pair the suspended application with the dedicated two-price catalogue, preserving existing Lite recognition and customer records. Never roll back to pre-Lite code. No paid AI calls, payment submission, subscription changes or new customers are part of verification.

Post-activation deployment identity and live checks are recorded separately. Offline tests and session creation do not claim a completed payment or impersonation of a customer's authenticated browser.
