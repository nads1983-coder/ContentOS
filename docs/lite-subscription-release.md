# Lite subscription release candidate

## Approved scope

- Free unchanged (3 monthly generations).
- Lite GBP5/month: 20 pooled successful text generations, regenerations and refinements; no AI image generation.
- Pro Creator GBP9/month unchanged: 50 pooled operations, no AI image generation.
- Pro Studio GBP39/month unchanged: 250 generations and 100 image credits.
- 20/50 = 40%, strictly below half. All 14 text formats, brand preferences, refinement, editing, save/copy/export use the same paid text functionality.
- Founder and owner lifetime guards, provider model, global GBP30 cap, GBP20/25 private warnings and account transaction boundaries are unchanged.

## Billing integration

`STRIPE_LITE_PRICE_ID` is optional and blank by default. New Lite checkout fails closed without it. The adapter checks active, GBP500 pence, monthly interval/count 1, recurring licensed price before creating a session. No Stripe product/price/subscription was created or modified during implementation.

Lite signup/login/email-verification callbacks and local pending-checkout storage retain the plan. Existing Lite subscribers upgrading (or existing subscribers selecting Lite) go to the existing Stripe customer portal, not a second subscription checkout. Known current prices override stale original Lite metadata on portal plan changes. Webhooks use the existing profile mutation; content, usage counters and preferences survive. Downgrading below current used capacity blocks further generation until the normal reset, rather than resetting usage.

Before launch, explicitly approve and create/reuse the GBP5/month price, configure its environment ID, and verify the existing customer portal permits the relevant products/prices and intended proration/scheduling policy. These live settings have not been inspected or modified. No new migration is required. Do not merge or deploy without release approval.

## Commercial exposure

Official GPT-4.1 pricing checked 26 October 2026: USD2/million input and USD8/million output, excluding cached discounts: https://developers.openai.com/api/docs/models/gpt-4.1

The existing conservative accounting uses GBP1.20 per USD, not a current market FX quote. Illustrative 10,000 input/2,000 output tokens costs GBP0.0432 per call, GBP0.864 for 20 calls. This is a scenario, not measured average usage or a profit guarantee; fees, taxes and hosting are excluded. Lite images cost zero because admission rejects them.

Worst-case existing request envelope is 128,000 serialized bytes + 4,096 input-token contingency, plus 24,000 output tokens: GBP0.547431 rounded per request, or GBP10.948620 for 20 reservations. Actual settled cost is normally lower. Failed/uncertain provider attempts may also cost money without consuming successful-output credits. Thus GBP5 is NOT guaranteed profitable at maximum usage. The unchanged shared GBP30 monthly cap prevents further application dispatch at exhaustion; it neither guarantees every customer's allowance can be delivered nor controls other apps sharing a provider project. Owner acceptance of this commercial risk is needed before launch; no silent reduction of output bounds or credits was made.

## Verification and rollback

Executed: full suite 361 passed, including 8 dedicated Lite behavioral tests; typecheck, lint, production build and diff checks passed. Locked dependency install reported zero vulnerabilities. Local browser at 1440/768/390px passed plan order, copy, no horizontal overflow, Lite signup intent, 20-credit Studio and unlocked text formats, with zero page errors. The browser workspace and APIs were mocked, not live customer sessions. Browser artifacts are under `/tmp/contentos-lite-browser`; the temporary local fixture route was removed. Expected local auth-unavailable logs reflect intentionally absent database credentials.

All testing is offline with synthetic fixtures and mocked Stripe/provider responses. No paid AI calls, live transactions, customer access or production settings changes. Tests cover the 20-credit boundary with pending reservations, all 14 formats, refinement pooling, duplicate replay, image rejection, signup continuation, price validation, portal routing, webhook activation/cancellation/plan changes and account/content preservation. Existing full suite covers Founder/owner guards, signatures, quotas and global spending controls.

Release: verify reviewed commit/tests; separately approve live price and portal configuration; set only `STRIPE_LITE_PRICE_ID`; deploy through the usual reviewed production process; perform non-transactional health/mapping checks. Preserve existing prices and subscriptions. Never roll back to a pre-Lite binary after customers have active Lite subscriptions, since it does not recognize Lite. A rollback after activation must retain Lite entitlement/price recognition and disable new Lite checkout instead. No data deletion or quota reset.
