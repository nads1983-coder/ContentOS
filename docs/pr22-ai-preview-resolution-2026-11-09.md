# PR #22 AI and Preview resolution — NO-GO

9 November 2026. Starting commit `3bc4e70dafc5c565edbcd8897154dc55552610a9`.

## Model quality

A separately funded evaluation compared GPT-6 Luna and GPT-5.2 with identical eight synthetic briefs and two independent attempts each, the production prompt/schema/parser, and an evaluation-only appended grounding instruction. The candidate directs models to reproduce material facts literally, avoid unsupported commitments, use neutral summaries, and return one section per requested type. This is an experiment, not a production prompt or routing change. Input counting was checked before each request against 8,192 tokens; each response had a 4,096-output-token cap. SDK retries were disabled. No larger independent set was run because the required initial 15/16 acceptance target was not achieved.

| Model | Completed | Validator passes | Input / output tokens | Usage-based estimate USD | GBP scenario with 20% contingency |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 16/16 | 11/16 | 64,388 / 12,238 | $0.00898072 | £0.01077686 |
| GPT-5.2 | 16/16 | 10/16 | 64,388 / 14,206 | $0.24967180 | £0.29960616 |

These use actual provider token counts and list-price estimates including reported cache usage, assume £1/USD, and are not invoices or maximum costs. The 16-sample differences from prior results cannot establish a quality improvement. The deployed production model override is still unverified. The previously modelled Luna £0.36864 per 50 credits and £9.216 for 25 fully active members require two strictly bounded attempts, reviewed pricing, and a separate reserve for existing users. Those retry bounds are not durably enforced per delivered credit. They exclude existing subscription, free/Founder and image usage and therefore do not demonstrate the £30 shared ceiling can fund the offer. Preserve the full existing budget until incumbent demand and invoices are measured.

Failure classification, with every rejected sample and the actual guard decisions in `pr22-grounding-candidate-diagnostics-2026-11-09.json`:

- Luna: both Unicode cases failed high-risk money evidence matching; one all-format case failed price matching on a numbered thread item, the other returned malformed JSON despite the provider reporting completion (4,001 output tokens); the second milestone case failed milestone evidence matching.
- GPT-5.2: both Unicode cases failed money evidence matching; both all-format cases failed money/commitment evidence matching; one milestone case failed milestone/commitment matching; one repair-cafe case failed commitment matching. Some rejected paraphrases preserve source facts, while promises to answer questions and added event details need separate factual review.
- The factual guard runs before later section/platform and hashtag processing. Its rejection does not establish that those later stages or actual output quality would pass. The malformed all-format response is an output-structure failure, not simply a grounding failure. No blind human quality panel or reliability claim has been made.

The earlier ticket-price fix remains narrow. This pass does not weaken grounding checks or change production instructions. Further work needs explicit source-grounded handling of qualified amounts, exact numbered-format facts, named milestones, and supported versus invented commitments, with adversarial tests for subject, amount, currency, qualifications, negation and temporal claims. Then repeat the initial set and only proceed to the larger independent set after meeting the threshold.

## Preview access and isolation

The existing Vercel app and CLI credential had returned 403 for environment operations. Official Vercel documentation describes branch-specific Preview overrides and separately scoped app permissions: [environment variables](https://vercel.com/docs/environment-variables), [integration permissions](https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference). Through the authenticated owner dashboard, the founder approved creation of a one-hour `content-os` project token and completed the required email identity check. The project-scoped token successfully listed metadata and created only branch-specific Preview overrides; no Production values were modified. The token was subsequently revoked, the private local copy removed, and a request using it returned 403. The token appeared temporarily in the computer-use tool trace; it is revoked and must not be reused.

Vercel API metadata showed the PR-specific `DATABASE_URL`, test `STRIPE_SECRET_KEY`, fixture opt-in and QA branch marker. Empty PR-branch overrides were added for `OPENAI_API_KEY` and `RESEND_API_KEY`; they no longer inherit the shared provider secrets in new builds. Metadata also exposed shared Preview/Production scope for `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; empty PR-specific overrides were created for those as well. No Stripe webhook was created, and payment testing is not enabled.

Added a fail-closed fixture target for only Git branch `feat/paid-creator-lifetime-2026`, the prepared QA database `pr22_payments_qa`, the exact QA Neon endpoint and branch ID, and an explicit test-mode Stripe secret key. Existing fixture settings remain supported. Negative tests reject Production, other Git branches, databases or Neon endpoints, a live Stripe key, missing test opt-in, and real AI/email keys. This is not a billing bypass: Checkout/fulfillment flags remain false. The distinct empty QA database and separate Neon project had been confirmed in the earlier report; no remote migrations were performed here.

Preview deployment `dpl_C6LiMyrLqmj7UhbwCpyFRHUFe3yD` for `73c0af8dc9de121aae008e2630936d9ef02a08fc` reached READY after the first pair of empty overrides and the guard fix. The two Stripe-related empty overrides were added **after** that deployment began, so that deployment must not be used for payment scenarios. A fresh Preview build is needed to incorporate all overrides; runtime database identity and exact deployed Stripe webhook/test credentials have not yet been verified. Environment metadata and a successful build are not proof of a complete, isolated runtime.

No real Stripe transaction, test webhook, refund, dispute, deployed scheduler or external alert delivery was executed. A genuine Stripe end-to-end test requires a signed test webhook and publishable key in the PR-only scope, a fresh Preview deployment, explicit verification of the actual runtime/database and least-privilege QA role, isolated migrations, and an independently reviewed test-only Checkout/fulfillment harness that cannot enable live sales. The currently empty webhook secret intentionally fails closed. A daily checked-in cron is not evidence of retry cadence or deployed alert delivery.

## Checks

- Five Preview integration tests passed, including new branch/database/credential negative cases.
- TypeScript and lint passed. Full suite: 498 tests, 486 passed, 10 existing baseline content/hashtag failures, two skipped.
- Both models ran 16 real synthetic prompts each; raw outputs and token usage are in `pr22-grounding-candidate-2026-11-09.json`, cost arithmetic in `pr22-grounding-candidate-summary-2026-11-09.json` and per-failure decisions in `pr22-grounding-candidate-diagnostics-2026-11-09.json`.
- No production routing, entitlement, price, budget, live Stripe configuration, production migration or live checkout was changed.

**NO-GO.** The 15/16 AI gate, larger independent evaluation, financial funding proof, actual isolated Preview runtime, genuine Stripe payment matrix and deployed operational checks remain open. Keep both offers disabled.

## Fresh Preview build

After all four empty provider overrides were created, Preview deployment `dpl_Ejoxtaa5u743szspb9T7cdWp9241` for commit `4b013f7b0c14c5769cd2f2d47e83267c7b93d7b5` reached READY. The fixture guard runs during that build and would reject the wrong QA tuple, a non-test Stripe key, or nonempty AI/email credentials. This improves build-time evidence, but it does not establish runtime database identity, a valid signed test webhook, or any payment transaction. Later commits create new Preview deployments and must be verified separately.
