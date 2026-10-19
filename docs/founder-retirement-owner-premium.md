# Founder retirement and owner complimentary Premium

Targeted release based on production `65761aa4ede3bc15b83fb12a2197b56d1fc1092f`.

- New Founder acquisition returns HTTP 410 at checkout, with a separate Stripe helper guard. Legacy signup/login links lead to the closed-offer page, and saved Founder intent cannot silently become paid checkout.
- Public acquisition cards, dashboard incentive and sitemap entry removed. The closed landing page is noindex. Existing Founder labels and valid historical activation remain intact.
- `owner_complimentary_lifetime` is a distinct, active Pro Studio entitlement with no expiry. Existing row-locked subscription updates preserve it, including reordered/duplicate cancellations. Normal Pro Studio quotas apply; no Founder redemption is used.
- No changes to generation, image generation, refinement, persistence, auth, plan limits, Stripe prices or existing subscriptions.

## Operations

Before the production grant, privately snapshot the uniquely matched verified owner auth/profile record. Use one guarded transaction to merge only the authorised entitlement fields and append a grant audit retaining their previous values. Preserve all Stripe identifiers and unrelated JSON fields. Never check the private snapshot, repair SQL or customer details into Git.

Deactivate the existing exact FOUNDING100 promotion code (`active=false`), not its coupon. Do not reset its redemption count, change its maximum, expire issued sessions, or delete claims. Existing qualifying checkout webhooks must still activate lifetime access. Keep private before/after evidence of issued sessions and the promotion state.

Stage the production build without assigning domains; verify project, environment and routes before promotion. Previous deployment: `dpl_qg1iMLYophzXev7xb5TYSAwg6j3L`. A blind rollback to that build would remove the new complimentary-entitlement guard and restore public acquisition UI. Prefer a forward fix; if an emergency rollback is necessary, first retain the entitlement guard and checkout retirement guard in the rollback source. Do not undo customer content or entitlement data with a whole-profile snapshot restore.

## Validation

193 unit/behavioural tests passed, including retirement rejection before external calls, historical activation/retries, owner/Founder cancellation protection, unchanged standard pricing, account isolation, working 14-format generation and images with mocked providers. Typecheck, lint, webpack production build and diff whitespace checks passed. Isolated Neon verified six concurrent billing updates preserve the owner entitlement and unrelated data. Existing isolated auth/cloud tests passed signup, verification, login, recovery, multi-device saving and account isolation without customer emails or provider calls. The staged production build passed and its authenticated runtime confirmed the production database binding and exact verified owner/profile match. Private operational evidence is retained outside Git; no paid AI call or payment is required for this release.
