# Lifetime membership evaluation (proposal, not enabled)

## Recommendation

Evaluate a limited-time **GBP 49 lifetime workspace membership with 50 non-renewing text-generation credits and 5 image credits**, alongside the unchanged standard subscriptions. Include all 14 formats in a text pack; a targeted refinement uses one text credit. Editing, undo, copying and exporting do not spend AI credits. Unused purchased credits should not expire. After credits are exhausted, the workspace remains accessible; additional AI use requires a separately priced credit purchase or subscription. No paid plans, prices, entitlements or checkout flows were changed for this proposal.

This is not unlimited AI, nor 50 credits every month forever. Existing Founder promises and entitlements are a separate protected contract and must not be reduced by this proposal. The present implementation still enforces existing monthly plans; a finite purchased-credit ledger and one-time checkout fulfilment would require separate approval before selling these proposed memberships.

## Inputs and uncertainty

- Verified public rates on 19 October 2026: [GPT-5.2](https://developers.openai.com/api/docs/models/gpt-5.2), USD 1.75/M input and 14/M output tokens. [GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5), high-quality output USD 0.133 square or 0.20 portrait/landscape, plus input. These are the code defaults, not a claim about the owner's final invoice or every deployment override.
- [Stripe UK](https://stripe.com/gb/pricing): standard UK cards 1.5% + GBP 0.20; premium UK cards 2.8% + GBP 0.20; international cards cost more. Do not assume the cheapest card fee for every sale.
- Planning FX assumption: USD 1 = GBP 0.85, not a quoted spot rate. Allow GBP 0.45 per text request and GBP 0.20 per image. The text allocation covers long requests and the 24,000 output-token cap at these rates; it is a commercial stress assumption, not a guarantee against future prices, FX changes or repeated failed attempts.
- Model a GBP 10 per-member operating reserve: GBP 6 hosting/storage over five years (GBP 0.10/month) plus GBP 4 support. This is an explicit assumption, not measured hosting attribution, and does not fund infinite years of support. Actual low-volume fixed infrastructure costs may exceed it.
- Read-only production aggregates: 48 profiles (34 free, 13 Founder, 1 Studio), 19 retained usage events, 20 retained generations. Profiles include legacy/test records; these are not customer claim counts. Retained JSON arrays are capped and are not a billing ledger. There is insufficient reliable token, retention and lifetime usage evidence to forecast average customer cost.

## Proposed allowances and scenarios

AI credits below are one-time, non-renewing totals. Scenario consumption is 20% / 60% / 100% of the included credits, all costed at the conservative per-request allocation above.

| Membership | Text packs/refinements | AI images | UK card fee | Full-credit AI reserve | Low / medium / heavy contribution after fees, AI and GBP 10 operating reserve |
|---|---:|---:|---:|---:|---:|
| Entry GBP 29 | 25 | 0 | GBP 0.64 | GBP 11.25 | GBP 16.12 / 11.62 / 7.12 |
| Core GBP 49 | 50 | 5 | GBP 0.94 | GBP 23.50 | GBP 33.36 / 23.96 / 14.56 |
| Premium GBP 79 | 100 | 10 | GBP 1.39 | GBP 47.00 | GBP 58.21 / 39.41 / 20.61 |

Contribution percentages on gross selling price are respectively 55.6% / 40.1% / 24.5%, 68.1% / 48.9% / 29.7%, and 73.7% / 49.9% / 26.1%. These are modelled contributions, not accounting gross margins or profit: VAT, acquisition, refunds, disputes, taxes and additional support are excluded. If the displayed price includes 20% VAT, heavy-use contribution falls to approximately GBP 2.28 / 6.40 / 7.45. Have the actual tax treatment confirmed before setting consumer prices.

Sensitivity: doubling AI unit costs makes heavy-use contribution approximately **minus GBP 4.14 / minus GBP 8.94 / minus GBP 26.39**, before VAT. Another five years of hosting at the assumed rate costs another GBP 6 per member. Heavy-use Core with VAT then has only about GBP 0.40 left. Therefore no tier is an unconditional perpetual-cost guarantee.

## Commercial comparison and safeguards

1. Lifetime-only: easy purchase decision but recurring costs depend on new sales and top-ups. Not recommended as the sole revenue model.
2. Lifetime plus subscriptions: finite prepaid AI alongside recurring higher-volume allowances creates a clear upgrade path, but needs careful messaging to avoid cannibalising subscriptions.
3. Limited-time lifetime plus subscriptions: recommended evaluation. Start with a small explicitly capped sales cohort and reserve the full included AI liability immediately. Measure redemption, support and conversion before expanding. Do not promise false scarcity.

Keep one authenticated account per membership, account-scoped idempotency and atomic credits, bounded input/output, server-side plan checks, concurrency/rate limits and no automatic provider retries. Failed or uncertain provider requests can still cost the business: track an internal monetary allowance separately from successful customer credits, and stop abusive/repeated expensive failures without silently charging a failed generation. Payment webhooks must fulfil once. Terms must state finite included AI credits, service lifetime, export availability, support scope, storage limits and closure policy clearly before purchase; legal review is needed, not a retroactive restriction on Founders.

For new tiers only, consider modest disclosed cloud storage (for example 100 text packs and 25 images, with export and no silent deletion) after measuring actual stored bytes. Existing JSONB image payloads amplify database transfer; do not offer unlimited image archives. Credit top-ups must cover worst-case AI, support and card fees; very small top-ups are inefficient because of the fixed fee. No top-up price or implementation is approved here.

## Decision required later

Review the GBP 49 finite-credit concept first. Validate actual provider token usage and establish tax, support and hosting reserves before separately authorising lifetime billing implementation. Keep current subscriptions and Founder offer unchanged in the meantime.
