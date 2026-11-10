# PR #22 grounding and Preview retest

9 November 2026. This is an incremental verification of commit `f01e3c8`. Sales remain disabled; no production routing, prices, entitlement, budget or Stripe setting was changed.

A narrowly bounded ticket-price evidence rule accepts the complete sentence “Tickets are £12” when the only ticket reference in the user brief is the complete unqualified sentence “Tickets cost £12” (or vice versa). It requires matching currency and amount and refuses additional ticket statements, other prices, and an explicit free-admission contradiction. It does not accept extra subjects, conditions, qualifiers, negation, uncertain prices or altered amounts. New regression tests cover those cases; existing grounding checks remain in force.

Replaying the previous 32 synthetic outputs with the updated parser still yields GPT-6 Luna 9/16 and GPT-5.2 9/16: individual accepted sentences do not resolve all defects in those responses. The change therefore does not establish satisfactory overall quality. Real new model retesting is recorded in `pr22-grounding-retest-2026-11-09.json` and its accompanying summary, including provider token counts and estimated—not invoiced—costs. The evaluation script loaded the rule before the final additional conflict guard; all its cases were subsequently replayed through the final parser to verify final outcomes.

After the founder authorised the Vercel team, normal connector access to project and deployment metadata succeeded, but environment-variable listing for `content-os` still returned HTTP 403 `projectEnvVars/list`, using both the team slug and explicit team/project IDs. The existing normal CLI credential was also denied in the preceding verification. Do not bypass that restriction. The latest inspected Preview deployment `dpl_53ePj4wjuzV4zJSznGewgQjNcQT6` failed its build during prerender: `previewFixturesEnabled` raised “Preview isolation is not configured safely.” This is consistent with the prepared QA tuple not being in the strict allowlist and inherited provider credentials not having been excluded, although the exact failed predicate has not been independently identified. The guard must remain fail-closed.

The prepared QA database remains separate and empty, but the deployed Preview's actual database, provider credentials, webhook secret and runtime isolation have not been verified. No remote migration, live or test payment, refund, dispute, webhook delivery, deployed scheduler invocation or external alert delivery was performed in this pass. No Stripe integration success is claimed. The existing daily schedule and prior local tests do not prove deployed operations.

To proceed, the Vercel account owner must grant the connected app project environment-variable read and create/update access for Preview. Then establish isolated provider overrides and a narrowly tested QA allowlist; validate the actual deployment before any database or payment writes. The separately approved model-routing change and funded per-account allocation are still absent. Preserve the £30 shared budget, prioritise incumbent subscription demand, and keep sales disabled.

Verification: grounding/publication tests 17 passed; TypeScript and lint passed. Full suite 497: 485 passed, 10 known baseline content/hashtag failures, two skipped. The test-data replay and new independent model evaluation are not Stripe tests. See previous audit and `pr22-autonomous-access-verification-2026-11-09.md` for cost scenarios and remaining release criteria. **NO-GO.**

## New real-model results

With the same eight synthetic briefs, production instruction/schema, two independent runs and no SDK retry for each model, all 32 API calls completed. Under the final parser, GPT-6 Luna passed 10/16 (62.5%); GPT-5.2 passed 8/16 (50%). All 32 recorded results were replayed against the final parser and matched their recorded outcomes. Small-sample variation prevents attributing the difference from the previous 9/16 results to the code change. This is not a blind quality assessment and the deployed production model override remains unverified.

| Model | Input tokens | Output tokens | List-price estimate USD | GBP scenario including 20% contingency | GBP per attempt |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 62,852 | 10,738 | $0.00600184 | £0.00720221 | £0.00045014 |
| GPT-5.2 | 62,852 | 14,751 | $0.235865 | £0.283038 | £0.01768988 |

These are estimated using provider-reported cache reads/writes and current published rates, assuming £1/USD, not actual invoices. They do not replace the conservative worst-case projections or account for unpaid retries, model changes, payment fees, taxes, subscription demand or future operating costs.

## Vercel account inspection

The founder authorised the team and asked the agent to inspect the account directly. In Vercel's **Sign in with Vercel → ChatGPT** connection, the displayed permissions include team read, and authorised project and deployment changes; no user-editable environment-variable scope or change control was offered on that page. This does not establish why Vercel's environment endpoint returns 403. Project integration settings did not expose a ChatGPT permission editor. No additional credential was created and no permission restriction was bypassed. A project owner or Vercel support must provide a supported credential/connection with the required environment-variable scope; alternatively a reviewed Preview-only configuration must be set through the authorised UI without exposing or inheriting live credentials. Then independently verify the deployed configuration before tests.
