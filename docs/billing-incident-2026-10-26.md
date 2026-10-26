# Billing incident recovery, 26 October 2026

## Confirmed cause

Production portal POST at 15:34:57 UTC reached Stripe using the correct dedicated configuration and dashboard return URL. Stripe returned HTTP 400, `resource_missing`, parameter `customer`. Read-only customer retrieval confirmed the owner's stored customer reference is deleted. No credentials, account mismatch, portal catalogue or proration failure was demonstrated. The adapter's generic catch had converted this into an unexplained application HTTP 503. The lifetime dashboard retained a Manage subscription button for that stale reference.

No customer reference is replaced or repaired. Existing lifetime access is independent of Stripe and remains protected. Deleted/missing billing customers now produce a clear 409 without recreating customers or attempting a portal POST. A lifetime dashboard with a confirmed deleted customer hides the unusable action and explains that no payment is required. Permission errors and outages remain failures, not evidence that the customer is deleted. The authenticated route still derives its customer exclusively from the signed-in account.

## Containment

`LITE_PURCHASES_SUSPENDED=true` is a source-controlled incident guard. Checkout rejects Lite before account/provider work, the Stripe adapter independently rejects it, all Lite purchase buttons are disabled with an explicit notice, and homepage offer metadata is OutOfStock. The flag does not affect price recognition, subscription renewal, usage, saved content or the existing 10-operation allowance. Reopening requires separate owner approval and a reviewed release.

Dedicated portal `bpc_1UUpfgFnoS3uqGtrfnzXblpu` now offers only the existing Creator and Studio prices for switching. Lite was removed from its selectable catalogue, not from Stripe or existing entitlements. The adapter validates this exact two-price catalogue while sales are suspended. Immediate changes, create_prorations, unchanged anchor, continue_trial, period-end cancellation, payment methods and invoice history remain unchanged. Default and TaskPilot configurations must remain unchanged. No price is archived or deleted.

## Verification

- 415 full-suite tests passed, zero failures or skips; typecheck, lint, diff check and production Webpack build passed.
- Regressions cover the captured deleted-customer response, resource_missing versus outages, authenticated customer binding, no fallback/default session, safe 409, lifetime dashboard messaging, blocked Lite checkout/buttons, current Lite entitlement recognition, renewal/reset, Creator/Studio checkout, and dedicated catalogue enforcement. Existing Founder/owner, isolation, cancellation, quota and GBP30 spending tests remain passing.
- Existing real Stripe test-mode proration/switching/cancellation evidence is reused; this recovery does not change invoice policy.
- Live Stripe created one portal session for an existing valid GetContentOS customer with the dedicated configuration and correct return URL. The session URL is retained privately, not in Git or reports. No subscription change, payment, new customer or charge was initiated. This API verification is not a claim that another customer's authenticated browser session was impersonated or tested.
- Before recovery: 54 profiles, 14 Founder profiles, one complimentary owner, zero Lite profiles; read-only Stripe inventory found zero Lite subscriptions. Profile fingerprint matched the pre-release snapshot. No charges since the release and no open Checkout sessions created since it were found.

## Recovery and rollback

Deploy only this focused recovery. Keep Lite sales suspended after portal verification. Do not roll back to pre-Lite code or the failed release with Lite sales enabled. Retain this recovery deployment as a Lite-compatible rollback anchor. No migrations, customer-data mutations, credentials, firewall, model, provider-spending or entitlement-policy changes are part of recovery. Subsequent reopening requires the owner to approve restoring Lite to the dedicated portal catalogue and lifting the application guard together.

Live deployment and post-deployment checks are reported separately after execution. No paid AI generation or customer transaction is authorised or required.
