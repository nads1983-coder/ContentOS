# OpenAI opening-spend reconciliation: 21 October 2026

## Verdict

**BLOCKED - OPENING EXPENDITURE UNVERIFIED.** Read-only reconciliation completed
at 2026-10-21T13:41:01Z. Application candidate remains
`70a8a570b6c9a39cca284506b9684df0a570d1db`; this update changes documentation only.
No paid calls, credentials exported, production writes, Stripe changes, merge,
deployment or new commercial product.

## Authoritative evidence and project binding

The owner-authenticated OpenAI dashboard and downloaded CSVs identify the existing
Personal organization / Default project. Full private project/key identifiers and
SHA-256 hashes are retained outside Git. No key was created or retrieved.

The retained GetContentOS compatibility response matches the provider's
19 October 12:26 UTC minute bucket exactly: one GPT-4.1 snapshot request,
2,033 input and 3,078 output tokens, no cached tokens. The existing server-side
preflight and shared production/Preview environment metadata establish use of
the existing credential and GPT-4.1 configuration. The credential/model metadata
has not changed since that preflight. This is strong evidence connecting the
project to GetContentOS, not proof that every project request belongs to this app.
The key has a different application-oriented label; labels alone do not establish
exclusive ownership. Production image-model configuration remains masked.

Exports cover 30 September through 21 October, all projects/keys/sources in the
accessible organization. The extra September day covers the London-month start
at 30 September 23:00 UTC; that day has no recorded cost. Exports are UTC.
The last nonzero cost bucket ends at 20 October 00:00 UTC. Later empty buckets
are not a provider guarantee that billing is finalized through their end time.

| Evidence | Recorded amount |
| --- | ---: |
| Costs grouped by project | USD 1.4819176 |
| Same costs grouped by line item | USD 1.4819176 |
| GPT-4.1 charges | USD 0.156378 |
| GPT-5.2 charges | USD 1.3255396 |
| Text requests | 40 |
| Input / output tokens | 145,073 / 95,748 |
| Image usage / other charged line items in these exports | None recorded |

Independent Decimal arithmetic repricing, including cached tokens, matches the
provider cost export exactly. The two cost exports describe the SAME charges,
not two bills. Refinement cannot be separated from generation using these fields;
any such requests in this project are included in the aggregate text charges.
Absence of image lines here is not proof of no unreported image activity elsewhere.

## Actual cost versus reservations

The matched compatibility call costs USD 0.028690 and is ALREADY in the total.
Its historical GBP0.50 conservative reservation is not an additional charge.
The preserved closing audit confirms one received response, ledger closed, and
the full reservation retained as historical audit. It is not an uncertain call.

Read-only production inspection at 13:25:46Z found three legacy text reservations
still marked reserved, created on 18 October between 16:25:12 and 16:46:07 UTC.
They have no retained provider usage totals. No image reservation arrays were
present. The shared financial tables have not been deployed.

These entries are unresolved financial evidence, NOT evidence that a provider
request is still running or that three extra charges must be added. Existing
retention and older implementations prevent treating the current profile ledger
as a complete monthly request log. The reservations may overlap exported charges;
they must not be cleared, replayed, or added as known charges without correlation.
Runtime-log retrieval did not return usable evidence; no clean-log claim is made.

## Opening configuration: not yet approved

The existing policy uses GBP1 per USD plus 20% contingency, rounded upward to
integer micro-GBP. This is deliberately conservative application accounting, NOT
an observed exchange rate or a guarantee about tax, FX fees or the final invoice.

- Exported subtotal: `ceil(1.4819176 * 1.2 * 1000000) = 1778302` micro-GBP.
- Subtotal equivalent: GBP1.778302.
- Budget remaining BEFORE unresolved exposure: GBP28.221698.
- Approved `opening_microgbp`: **unset**. Do not insert the subtotal as final.
- Final opening: conservatively converted exported charges, plus incremental
  post-export charges and separately evidenced outstanding exposure, with no
  already-included provider call counted again as a known charge.

No defensible numeric allowance for the remaining legacy exposure was established.
Neither zero nor the new candidate's per-call maximum can be assumed for requests
made by older code/models. The export lacks a finalized billing watermark, and
production remains active. Therefore actual spendable remaining budget is not yet
verified. A cap in this app also cannot control other apps sharing the project.

## Current pricing and compatibility

Official prices rechecked on 21 October:

- [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1): USD2/M input,
  USD0.50/M cached input, USD8/M output; matches the candidate's conservative
  uncached quote. The previous server-side model preflight established this model.
- [GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5):
  USD5/M text input, USD32/M image output, high rectangular image USD0.20.
  Matches the candidate's text-only image-input policy, subject to confirming
  the masked production override selects this model.
- [GPT-5.2](https://developers.openai.com/api/docs/models/gpt-5.2): USD1.75/M input,
  USD0.175/M cached input, USD14/M output; historical export charges reconcile.
  The candidate intentionally does not price this model. A production override
  or missing text-model setting selecting the code's GPT-5.2 fallback would be
  refused before dispatch, not silently priced as GPT-4.1.

Maximum candidate reservations remain GBP0.547431 text / GBP0.360576 image,
subject to exact payload limits. Policy expires 19 November 2026. GPT-4.1 is
listed deprecated; track its published lifecycle without changing models in this
financial task. No paid model-availability check was run.

## Minimum evidence and exact rollout procedure

1. Obtain read-only provider request/outcome records for the three 18 October
   reservations, or provider confirmation of their billed inclusion/non-dispatch.
   Correlate privately; publish only aggregate results. Obtain refreshed all-source
   billing at cutover and account for in-flight/unbilled calls conservatively.
   Do not request or paste an API/admin key. Dashboard exports or provider support
   evidence suffice; no paid validation is required.
2. Confirm the existing non-secret production `OPENAI_IMAGE_MODEL` value in an
   authorized server-side check or the owner's configuration record. Do not export
   the API key or change the model just to fit this policy.
3. Owner explicitly approves the exact commit, final opening amount/evidence,
   shared migration and deployment. Approve a short provider-admission cutover
   pause if necessary to prevent old-runtime calls escaping the new ledger.
4. Take a recoverable schema backup; verify the selected production database and
   runtime role. Apply ONLY `drizzle/0003_commercial_spending.sql` once. Verify
   three tables, primary/check/foreign-key constraints, month index, and runtime
   grants. No profile or subscription mutations. Do not replay earlier migrations.
5. Insert the approved singleton with `starts_month='2026-10'`, exact approved
   `opening_microgbp`, `suspended=true`, and a private immutable evidence reference.
   Perform in one admin transaction; assert no existing configuration and abort
   on conflict. Never overwrite/reset an existing opening or audit. If final
   opening exceeds GBP30, halt rather than clamp it into the schema's limit.
6. Build a production-target deployment using existing production credentials,
   production Neon and fixture mode OFF. Do not promote the synthetic Preview.
   Confirm model/payload policy and anonymous/account-isolation/refinement/image
   safeguards without paid calls. Drain old in-flight work and reconcile the
   final tail before enabling admissions; retain suspension if unresolved.
7. Only after approval and verification, promote and clear suspension in an
   audited operation. Monitor GBP20/25 alerts, uncertain holds, 503s and webhook
   outcomes. Existing monthly/annual plans and historical entitlements unchanged.
8. Emergency rollback: suspend provider admission first; preserve all ledger rows.
   The prior production build lacks the cap. Reverting to it requires explicit
   owner approval and separate spending containment. Do not drop the migration,
   erase spending history, restore Lifetime sales or reactivate FOUNDING100.

## Checks actually executed

CSV project/line-item totals match; usage repricing matches; the precise retained
test matches one minute bucket; its closing audit confirms closure; September
boundary has no recorded cost. Private raw CSV copies and SHA-256 manifest retained.
Read-only production aggregates and environment metadata inspected. Official model
prices rechecked. Documentation diff checked. Prior 201 tests, 12 isolated scenarios,
lint/typecheck/build and browser evidence are reused, not claimed rerun. PR remains
draft. No financial assumptions have been written to production.
