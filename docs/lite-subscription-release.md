# Lite subscription release candidate

## Approved scope

- Free unchanged (3 monthly generations).
- Lite GBP5/month: 10 pooled successful text generations, regenerations and refinements; no AI image generation.
- Pro Creator GBP9/month unchanged: 50 pooled operations, no AI image generation.
- Pro Studio GBP39/month unchanged: 250 generations and 100 image credits.
- 10/50 = 20%, strictly below half. All 14 text formats, brand preferences, refinement, editing, save/copy/export use the same paid text functionality. The existing monthly usage window/reset is unchanged.
- Founder and owner lifetime guards, provider model, global GBP30 cap, GBP20/25 private warnings and account transaction boundaries are unchanged.

## Billing integration

`STRIPE_LITE_PRICE_ID` is optional and blank by default. New Lite checkout fails closed without it. The adapter checks active, GBP500 pence, monthly interval/count 1, recurring licensed price before creating a session. No Stripe product/price/subscription was created or modified during implementation.

Lite signup/login/email-verification callbacks and local pending-checkout storage retain the plan. Existing Lite subscribers upgrading (or existing subscribers selecting Lite) go to the existing Stripe customer portal, not a second subscription checkout. Known current prices override stale original Lite metadata on portal plan changes. Webhooks use the existing profile mutation; content, usage counters and preferences survive. Downgrading below current used capacity blocks further generation until the normal reset, rather than resetting usage.

Before launch, explicitly approve and create/reuse the GBP5/month price, configure its environment ID, and verify the existing customer portal permits the relevant products/prices and intended proration/scheduling policy. These live settings have not been inspected or modified. No new migration is required. Do not merge or deploy without release approval.

## Commercial exposure

Official GPT-4.1 pricing checked 26 October 2026: USD2/million input and USD8/million output, excluding cached discounts: https://developers.openai.com/api/docs/models/gpt-4.1

The existing conservative accounting uses GBP1.20 per USD, not a current market FX quote. Illustrative 10,000 input/2,000 output tokens costs GBP0.0432 per call, GBP0.432 for 10 calls. This is a scenario, not measured average usage or a profit guarantee; fees, taxes and hosting are excluded. Lite images cost zero because admission rejects them.

Worst-case existing request envelope is 128,000 serialized bytes + 4,096 input-token contingency, plus 24,000 output tokens: GBP0.547431 rounded per request, or GBP5.474310 for 10 reservations. Calculation: ceil(((132096 * 2) + (24000 * 8)) * 1.2) = 547431 micro-GBP per request. Actual settled cost is normally lower. Failed/uncertain provider attempts may also cost money without consuming successful-output credits. Thus GBP5 is NOT guaranteed profitable at maximum usage. The unchanged shared GBP30 monthly cap prevents further application dispatch at exhaustion; it neither guarantees every customer's allowance can be delivered nor controls other apps sharing a provider project. Owner acceptance of this commercial risk is needed before launch; no silent reduction of output bounds or credits was made.

## Verification and rollback

Executed for the final 10-credit candidate: full suite 361 passed, including 8 dedicated Lite behavioral tests and a new-month reset assertion; typecheck, lint, production build and diff checks passed. The earlier locked dependency install reported zero vulnerabilities; dependencies are unchanged. Local browser at 1440/768/390px passed plan order, copy, no horizontal overflow, Lite signup intent, 10-credit Studio and unlocked text formats, with zero page errors. The browser workspace and APIs were mocked, not live customer sessions. Browser artifacts are under `/tmp/contentos-lite-browser`; the temporary local fixture route was removed. Expected local auth-unavailable logs reflect intentionally absent database credentials.

All testing is offline with synthetic fixtures and mocked Stripe/provider responses. No paid AI calls, live transactions, customer access or production settings changes. Tests cover the 10-credit boundary with pending reservations, all 14 formats, refinement pooling, duplicate replay, image rejection, signup continuation, price validation, portal routing, webhook activation/cancellation/plan changes and account/content preservation. Existing full suite covers Founder/owner guards, signatures, quotas and global spending controls.

Release: verify reviewed commit/tests; separately approve live price and portal configuration; set only `STRIPE_LITE_PRICE_ID`; deploy through the usual reviewed production process; perform non-transactional health/mapping checks. Preserve existing prices and subscriptions. Never roll back to a pre-Lite binary after customers have active Lite subscriptions, since it does not recognize Lite. A rollback after activation must retain Lite entitlement/price recognition and disable new Lite checkout instead. No data deletion or quota reset.

## Entitlement correction, 26 October 2026

The launch preflight found that current prices only overrode checkout metadata when either resolved to Lite. A subscription originally bought as Studio could therefore move through Lite to Creator and incorrectly regain Studio; the inverse transition under-granted Studio. A second reconciliation fallback could reinstate a stored paid tier (or Creator) for an unrecognised price.

Current recognised subscription prices are now authoritative for every paid tier. Original checkout metadata and saved profile plans cannot elevate an unknown price. Missing, unknown, ambiguously configured, multi-item, truncated, one-time, metered or invalid-quantity subscription evidence fails closed to Free while retaining Stripe linkage for duplicate-subscription prevention. Known archived prices retain the purchased tier for existing active subscriptions: Stripe's `active=false` prevents new sales, not existing entitlement (https://docs.stripe.com/products-prices/manage-prices#archive-price). Existing configured legacy price IDs remain supported. Founder and owner lifetime protection is still applied independently by the repository.

All ordinary subscription webhooks, including deletion, now reconcile against current Stripe state rather than applying a delayed event snapshot. A delayed deletion of an old subscription cannot sequentially overwrite a newer active replacement. Lookup failures propagate as retryable server errors without applying the historical event. This is current-state reconciliation, not a new distributed event ordering system; normal webhook/provider eventual-consistency limitations remain.

Verification: 371 full-suite tests passed with zero failures/skips; 18 focused Lite/transition tests passed. New tests execute the actual webhook, Stripe lookup/mapping and profile mutation against mocked transport/database transactions. They cover all four requested multi-step transitions, unchanged original metadata, duplicate/reordered events, cancellation/renewal, replacement subscriptions, scheduled/pending changes, unknown/archived/inconsistent prices, outage safety, Founder/owner protection and preservation of unrelated accounts, drafts, preferences, history and usage. The existing suite covers exactly-once usage, quotas and the GBP30 spending gate. Scheduled/prorated tests verify that only the effective current subscription item affects access; they do not execute or validate live Stripe invoice arithmetic.

Typecheck, lint and diff checks passed. Default `npm run build` was attempted twice (including outside the sandbox) but Turbopack could not bind its local CSS worker port: `Operation not permitted`. The supported alternate production build, `npm run build -- --webpack`, passed. No build configuration or dependencies changed. Earlier responsive browser evidence is reused because no UI files changed in this correction. No paid AI calls, customer transactions, database writes or production changes occurred.

### Portal configuration prepared, not activated

Read-only live inspection confirmed the default portal used by GetContentOS has plan switching disabled, cancellation at period end enabled and proration `none`. The separate TaskPilot portal must remain untouched. Before launch, create/reuse the approved Lite price and scope switching strictly to GetContentOS Lite, Creator and Studio products/prices; allow `price` only, not quantity or promotion changes. Preserve cancellation at period end, payment methods, invoice history and the billing-cycle anchor. Keep trials running on plan changes (`continue_trial`).

Proposed policy for owner confirmation: immediate customer-confirmed plan changes, `create_prorations` (credits/debits on the next regular invoice), billing anchor unchanged, and no automatic invoice/charge initiated by this release. Block changes with open invoices where supported. Customers must see the consequences in Stripe before confirming. No subscription is modified by preparing this configuration.

Stripe documents that portal period-end downgrades require prices under the same product (https://docs.stripe.com/customer-management/configure-portal). The existing Creator and Studio prices use different products. Do not promise scheduled cross-product downgrades or silently restructure existing prices. If period-end switching rather than the proposed immediate/prorated policy is required, that remains a separate commercial/setup decision. Actual portal catalog acceptance, tax compatibility and customer-facing change summaries must be verified non-transactionally during the separately authorised release; no live price or portal mutation was made here.

Verdict: correction ready for founder release review, not automatic launch. Remaining launch gates are approval of the corrected commit and portal policy, live Lite price/environment setup, portal verification, and controlled deployment with Lite-compatible rollback protection.

## Final cancellation status correction, 26 October 2026

Existing authorized Stripe Dashboard test mode resolved the connector access limitation. Synthetic monthly GBP5/9/39 prices, a test customer, a test clock and a nondefault test portal verified immediate Lite -> Creator -> Studio -> Lite switching. No new invoice/payment occurred during those changes. A subsequent Creator switch left GBP2.07 net prorations; the next regular renewal correctly test-paid GBP11.07 (GBP9 + GBP2.07). Portal cancellation ended the subscription at the next period end without another renewal invoice. Hosted test Checkout displayed GBP5/month; it was inspected, not completed, then expired. The temporary test portal was disabled afterward. No live Stripe settings or customer records were modified.

The captured portal response used `cancel_at=1796083200`, `cancel_at_period_end=false`, `current_period_end=1796083200`, and `canceled_at=1793498400`. The last field is the cancellation request time, not its effective date. Previously the application ignored `cancel_at`, incorrectly showing a renewal date.

The mapper now recognises both scheduled-cancellation representations. It persists the authoritative effective date in the existing JSON profile as `subscription_cancel_at`, separately from the unchanged billing-period end. No database migration is needed. `cancel_at` takes priority; flag-only cancellations fall back to the period end. Cancellation reversal clears the date and pending flag during the existing synchronization. Dashboard status, paid-until date and notice use this effective date; genuine renewal messages remain unchanged. Existing entitlement expiry, usage windows, current-price authority and lifetime protections are unchanged.

Verification for this correction: 380 full-suite tests passed with no failures/skips, including nine new regressions. Tests cover the captured response, earlier explicit cancellation dates, flag-only cancellation, malformed/missing dates, all three paid tiers, duplicate and stale events, reversal, renewal, profile round-trip, account/history preservation, and actual server-rendered dashboard messages. Founder/owner lifetime guards and display remain protected. Typecheck, lint and diff checks passed. Default production build encountered the existing local Turbopack CSS worker port restriction (`Operation not permitted`); `npm run build -- --webpack` passed without configuration changes.

The prior real Stripe test-mode billing evidence remains applicable: no checkout request, portal configuration, price mapping, proration, invoice or subscription mutation code changed in this correction. The approved policy remains immediate changes, `create_prorations` carried to the regular invoice, unchanged anchor and preserved cancellation/payment management. No new Stripe calls or paid AI calls were made. Test-state mapping and dashboard verification are offline; they do not claim live end-to-end webhook delivery.

GO for owner review of the corrected release candidate. Remaining release actions: approve the corrected commit; create/reuse and validate live Lite price, set `STRIPE_LITE_PRICE_ID`, configure/verify the GetContentOS-only portal policy, and perform the authorized release preflight/deployment with Lite-compatible rollback. No merge or production deployment is included in this correction.

## Dedicated portal isolation correction, 26 October 2026

This update supersedes the earlier unconfigured-portal launch blockers above. The application previously omitted `configuration` when creating a billing portal session, which implicitly selected Stripe's account-wide default. Enabling GetContentOS plan switching there could affect other applications sharing the Stripe account.

Created one live, active, nondefault GetContentOS configuration: `bpc_1UUpfgFnoS3uqGtrfnzXblpu`, tagged `application=getcontentos`. Its expanded switching catalogue contains only:

- Lite: `getcontentos_lite`, `price_1UUpbNFnoS3uqGtrwgQGjM1a`, GBP5/month.
- Creator: `prod_UZ1rbhGewTjKZQ`, `price_1Ta8qXFnoS3uqGtrYoCtzd8y`, GBP9/month.
- Studio: `prod_UZ1reQTYPRSyX3`, `price_1Ta8r0FnoS3uqGtrzQ03A8zC`, GBP39/month.

The existing Lite price was reused; no price was created or changed. Live readback confirmed all three prices active, GBP, monthly, interval count 1, licensed. The portal allows price changes only, with quantity changes disabled per product and no promotion-code updates. Policy remains immediate switching, `create_prorations`, unchanged billing-cycle anchor, continued trials, and no scheduled-switch conditions. Cancellation remains at period end with no cancellation prorations. Payment-method management and invoice history remain enabled. The standalone portal login page is disabled; the application creates authenticated customer-scoped sessions.

Exact before/after JSON comparison confirmed the default portal `bpc_1TZYerFnoS3uqGtrluwpxflt` and TaskPilot portal `bpc_1URVTGFnoS3uqGtr9a290QMg` unchanged, including their update timestamps. No customer subscriptions or live transactions were created or modified.

The existing Vercel `content-os` project now has production-only encrypted `STRIPE_PORTAL_CONFIGURATION_ID` and `STRIPE_LITE_PRICE_ID` mappings to the IDs above. Targeted decrypted comparisons verified the two values without printing credentials. No deployment was triggered by configuration setup. No other environment variables, firewall rules, credentials, models or spending settings changed.

The adapter now validates the dedicated configuration on every session request, including its expanded exact catalogue and approved billing policy, and explicitly passes its ID to Stripe. Missing, inactive, default, unrelated, malformed or unsafe configurations fail closed without creating a fallback session. Stripe lookup/session errors are redacted. The portal route returns a clear 503 without claiming a subscription change; existing origin, authentication and profile-derived customer binding remain intact. The same adapter covers existing-subscription checkout redirects. There is no new migration, entitlement change, quota change or dependency.

Verification: 409 full-suite tests passed, zero failures/skips, including 29 new dedicated portal tests. Typecheck, lint, diff checks and `npm run build -- --webpack` passed. The supported Webpack build reuses the previously documented workaround for this machine's Turbopack CSS-worker port restriction; no build configuration was changed. A separate offline replay of the captured real expanded portal configuration through the actual adapter passed with fully mocked transport and zero live sessions. Tests cover explicit configuration selection, missing/invalid mappings, foreign/default catalogues, unsafe proration/anchor/trial/scheduling options, quantity/promotion changes, outage handling without retries/fallback, origin/auth/account binding and safe errors. Existing subscription-transition, cancellation/reversal, renewal, Founder/owner, account-isolation, quota and GBP30 spending regressions all passed.

The prior real Stripe test-mode switching/proration/renewal/cancellation evidence remains applicable because this change selects and validates the same policy rather than changing invoice arithmetic or subscription mutation logic. No new live customer switching or payment was performed, and offline tests do not establish live webhook delivery. No UI changed; previous responsive layout evidence is reused.

GO for owner review. Remaining release action is explicit approval of this corrected commit, followed by the normal production preflight, controlled deployment and non-transactional authenticated portal verification using the configured application credential. Do not merge or deploy automatically. After Lite activation, rollback must retain Lite recognition and dedicated portal isolation; disable new Lite purchases if necessary rather than reverting customers to pre-Lite code. Historical evidence and customer data remain untouched.
