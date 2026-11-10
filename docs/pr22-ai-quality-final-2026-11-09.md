# GetContentOS AI quality evaluation — NO-GO

9 November 2026; base commit `ea2859184ec0b3c5ad4f27d08be96f84d400215a`. Production routing, prompts, token limits, £30 shared monthly ceiling, prices and entitlements were not changed. The retired Founding 100 and subscription functionality remain unchanged. No live payments, production migrations or deployment were performed.

## Corrections and regression evidence

1. A numbered X-thread item such as `4/ Tickets cost £12.` can now match the exact complete source sentence `Tickets cost £12.`. The ordinal is ignored only at the start of the first sentence of an actual `xThread` item; the factual sentence must otherwise match the existing source-evidence rules. Altered prices, added conditions, negation, unrelated formats and additional claims remain rejected. The actual previously rejected Luna all-formats output now passes as a 14-format result.
2. The classifier now treats a statement such as `Seed swap happening Sunday` as a timing claim requiring source evidence. A fresh GPT-5.2 output had stated that an event was happening although the user brief only said it was planned and the venue/time were unconfirmed; the prior parser accepted it. The new guard rejects that claim and accepts it when the same confirmed wording is explicitly supplied by the user. This is a narrow backstop, not a general semantic entailment checker; other expressions of false certainty remain possible.
3. `tests/ai-quality-recorded.test.mjs` replays every one of the 11 previously rejected candidate samples: the numbered-thread sample passes, and the other ten remain rejected. This tests the known cases without treating safety refusals as failures to be suppressed.

## Matched real-model runs

The founder-authorised separate evaluation project ran the same eight original synthetic briefs, two attempts per brief per model, followed by ten new synthetic briefs, two attempts per brief per model. These are 20 outputs per model from **10 distinct new scenarios**, not 20 independent topics or a statistically representative customer sample. All runs used the unchanged production instruction/schema plus the same **evaluation-only** grounding suffix, token preflight <=8,192 input, `max_output_tokens=4096`, standard tier, no tools and no SDK retries. The experiment is not deployed and does not establish that limits or a two-attempt-per-credit rule are enforced in production.

The final timing guard was added while provider calls were running. Every saved response was replayed offline through the final validator; results below require both a provider `completed` status and a final-parser pass. Raw provider results retain the earlier runtime verdict. Prices are estimated from provider-reported token and cache counts, not invoices, using £1/USD and a 20% contingency.

| Set | Model | Final passes | Provider completions | Input tokens | Output tokens | Estimated USD | GBP with contingency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original 16 | GPT-6 Luna | 11/16 (68.75%) | 15/16 | 64,388 | 12,580 | $0.0069382 | £0.00832584 |
| Original 16 | GPT-5.2 | 9/16 (56.25%) | 16/16 | 64,388 | 13,916 | $0.2236374 | £0.26836488 |
| Independent 20 | GPT-6 Luna | 16/20 (80%) | 20/20 | 75,776 | 7,605 | $0.00679643 | £0.00815572 |
| Independent 20 | GPT-5.2 | 14/20 (70%) | 20/20 | 75,776 | 10,380 | $0.2087792 | £0.25053504 |

Neither model meets 15/16 or 95%. The original all-formats Luna request reached the full 4,096 output-token cap and was provider-incomplete. The largest input was 4,853 tokens in the original set and 3,888 in the independent set; preflight counts matched reported input on every call. No conclusion can be drawn about a production-safe larger output cap: higher caps require cost and reliability analysis before any adoption.

The final parser rejects the original Luna milestone, both Unicode café cases, and both all-format attempts (one factual-match rejection, one incomplete). GPT-5.2 fails milestone once, both tentative repair-cafe cases, both all-format cases, and both Unicode cases. In the independent set both models fail both workshop-price and Unicode café samples; GPT-5.2 additionally fails both seed-swap samples because of the new timing guard. The per-attempt original verdict, final verdict, provider status, failure categories and flagged sentences are in `pr22-ai-quality-regression-replay-2026-11-09.json` and `pr22-ai-quality-independent-replay-2026-11-09.json`. Raw responses and token records are in the corresponding files without `-replay`.

Classification: source-grounded prices and milestone summaries are sometimes refused because the source matcher requires complete supported relationships; unsupported added promises and definite timing must remain refused. The all-format Luna failure is output truncation, not a successful response. Output-format and hashtag correctness are not guaranteed by a grounding pass; grounding failures can prevent later checks from running. A manual comparison of selected independent outputs found Luna's checklist clear but somewhat repetitive, and its sample used relevant bakery hashtags. GPT-5.2 produced more expansive LinkedIn copy and broad operations hashtags, but its seed-swap TikTok copy asserted a tentative event as definite. This is a limited engineer review, not a blinded quality panel and not proof of overall hashtag relevance, platform suitability, tone or factual accuracy.

## Financial implications and recommendation

[OpenAI's current Luna rates](https://developers.openai.com/api/docs/models/gpt-6-luna) are $0.10 per million input tokens, $0.125 cache-write and $0.50 output. Under the hypothetical 8,192-input/4,096-output envelope, charging all input at cache-write rates, two fully funded attempts per delivered generation, £1/USD and 20% contingency, Luna costs **£0.0073728 per delivered credit**, **£0.36864 per fully active lifetime user per month**, and **£9.216 for 25**, before any incumbent use. This is a planning scenario; durable retry, uncertainty and token limits are not yet verified in production. With current GPT-5.2 code-default request bounds, the approximate £0.680602 single-request reservation implies £34.03 for 50 requests per user before retries. The deployed model override remains unknown.

The shared £30 ceiling cannot be declared sufficient. Reserve existing subscriber, Founder/free, image, overhead and uncertain-call demand first. If Luna's £9.216 scenario were proven, 25 fully active lifetime members leave at most £20.784 for all other demand; without measured existing demand, the defensible current allocation for additional lifetime sales remains zero. At 100 fully active lifetime users, the same hypothetical reserve is £36.864 even before existing customers.

Under that hypothetical Luna envelope, a 20% VAT-inclusive scenario, the [published Stripe](https://stripe.com/gb/pricing) international-card plus FX stress fee of 5.15% +20p rounded up, and a 10% gross operating reserve, the £5/25, £9/50 and £15/100 packages yield projected contributions of £3.02235, £5.56136 and £9.28272 respectively. These are scenarios, not proven margins: taxes, actual fee mix, disputes, future prices, non-expiring credit liabilities and funding need separate verification. GPT-5.2 at the same proposed bounds and two attempts produces negative projected contributions for all three packages.

**Recommendation: no model switch.** Luna is a lower-cost research candidate but fails both reliability gates, has an observed 14-format output-cap failure, and needs substantive blinded quality and adversarial factual review. Keep production routing and the £30 ceiling unchanged; preserve existing subscriptions and keep both sales disabled. Do not rerun the same evaluation indefinitely. Address amount/subject/qualification evidence matching and safe handling of multi-format truncation, add adversarial tests, then seek a fresh independent quality assessment only after those changes are ready.

## Verification

- Recorded-failure, grounding and publication tests: 30 passed. TypeScript and lint passed.
- Full suite after the final timing guard: 511 tests, 499 passed, 10 pre-existing content/hashtag failures, 2 skipped. The ten failure names match the existing baseline.
- 72 real synthetic provider calls across the two sets; no customer content and no live Stripe operations. Evaluation costs are separately funded and do not modify the application £30 setting.
- No production deployment, model routing, subscription entitlement, payment setting, price or allowance was altered.

**NO-GO.** Both acceptance thresholds and an independently reviewed quality bar remain unmet. Stripe sandbox and Preview isolation remain separately unverified as described in earlier reports.
