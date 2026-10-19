# Founder discount repair: deleted Stripe customer

## Verified production cause

The live domain was verified on rollback commit `6c75fab8e995e94c53bec400aed01991e1ee0642`, deployment `dpl_HSnCfk4HP3V4iwsxKSfuDEnjiosH`. This hotfix is based directly on that commit, not PR #3.

Production checkout errors reported `No such customer`. A read-only Stripe lookup returned the referenced Customer with `deleted: true`. The application's profile still referenced that deleted Customer. Stripe refuses that reference when creating Checkout, which the route presented as a generic discount failure. This is a stale customer binding, not exhausted promotion inventory or evidence that the rollback changed discount configuration.

The affected account was verified, Free/canceled, without a Founder entitlement. Its three failed claim records have no Checkout Session attached. No account identifiers, emails, session URLs or customer identifiers are included here.

Read-only offer inspection confirmed FOUNDING100 active, maximum 100 redemptions, 12 used, 88 remaining. Its associated coupon is valid, 100% off forever, maximum 100 with 12 used, no expiry or product restriction. The promotion has no customer, first-transaction or minimum-spend restriction. This is remaining Stripe capacity, not a count of unique real customers. No limits or redemption counts were changed.

Three database claims were marked open: one still has a valid open zero-total Stripe session; two have expired at Stripe. All three retain matching account and promotion bindings. Existing session reuse/expiry handling remains unchanged. No claim records were deleted, reset, expired or otherwise repaired during this task.

## Minimal fix

Only `lib/stripe-rest.ts` changes application behavior. Before creating a new Founder Checkout Session for a stored customer, retrieve that Customer. Only an explicit, matching `deleted: true` result permits omitting the deleted ID and using the authenticated account email already supplied by the server. Recovery requires the account identity, email and coordinated claim idempotency key.

Preserve the exact checked FOUNDING100 promotion, claim key, account metadata and client reference. Do not fall back to a coupon, another promotion or a paid checkout. Preserve zero-total inspection, persistent claim coordination, completion validation and lifetime entitlement handling. Existing valid open sessions are reused before this creation path, so recovery does not replace them. No automatic uncertain POST retry is added.

401/403/404/429/500 responses, network failures or mismatched lookup identities fail closed. Generic resource-missing errors are not assumed to mean deletion. Ordinary paid checkout is unchanged. No direct production row repair is necessary; the normal verified completion path records the replacement Stripe customer when an eligible customer completes their claim.

All AI generation, application UI, authentication, standard prices, dependencies and lockfile remain byte-for-byte unchanged from the rollback baseline. PR #3 is neither merged nor deployed. Founder stays ACTIVE.

## Validation and limits

- `npm test`: 45 passed, including seven new actual-adapter/claim-orchestration transport tests.
- New tests cover deleted and valid customers; missing authenticated context; lookup errors and mismatched identity; unchanged paid checkout; concurrency and crash recovery with one idempotent session; sequential open-session reuse; exhausted offer and configuration mismatch; existing paid/Founder refusal; nonzero/wrong-promotion refusal and expiry; no automatic uncertain POST retry.
- Existing tests cover completed Founder activation, webhook retry behavior, cancellation preservation and signup/login offer intent.
- Typecheck, lint, `git diff --check`, clean lockfile install and local production webpack build passed. The staged Vercel build must reach READY before domain promotion.
- Stripe and production database inspection were read-only. All successful-claim tests used synthetic transport, not live Stripe. No live Checkout Session, payment, redemption, subscription or new customer was created by verification.
- Public smoke verifies the Founder presentation, signup/login continuation and anonymous refusal without initiating a payment. It cannot prove an authenticated customer has completed a live claim; that is explicitly not claimed.

## Deployment and rollback

Stage this exact production-baseline hotfix in the existing `content-os` Vercel project, with no environment variable changes or AI model overrides. Verify before promoting. Roll back to `dpl_HSnCfk4HP3V4iwsxKSfuDEnjiosH` if needed. No schema rollback or customer data restoration is required. Retain all issued claims and sessions. Do not retire Founder.
