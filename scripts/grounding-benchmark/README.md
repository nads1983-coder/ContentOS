# Controlled grounding benchmark

One user-authorized campaign on 18 October 2026, separate from the closed GBP5 campaign. Maximum GBP9, twelve paid requests, one temporary protected Preview in the existing Vercel project. No application endpoint, production deployment, customer access, billing changes, or new provider credential.

**CLOSED:** seven requests admitted: six completed drafts and one uncertain review. Full reservations retained at GBP4.262720. The review ended at the shared 90-second pipeline deadline; no review result was available. No retry or remaining review slot was dispatched. The Preview was deleted, temporary role revoked, and audit retained. `prepare` and `execute` now refuse before credential/database access. The release verdict remains NO-GO.

## Frozen comparison

- Production baseline: `6c75fab8e995e94c53bec400aed01991e1ee0642`.
- Grounding candidate: `6daddcc4149932e0d1bc59e331ecba7ce99f78ad`.
- Three independently authored, previously sealed synthetic briefs. Original fixture SHA-256: `882551de16ba114b2d748bbcf11acf6de8e31d72a5974f64cf5a4c65b53fc8b2`.
- Input adapter preserves H3's overlong content goal verbatim in its source field, with an empty content-goal field. No factual content changes. Both arms receive the same adapted material.
- Input manifest SHA-256: `9185c65703bd5ad825bcf2f6997836c55ce6e1576c478eaf24a084fcbf6a35ac`.
- Frozen pure source modules are compiled and signed, with source and compiled hashes. The runner imports no application authentication, database, billing or workspace modules.

## Spending controls

Six draft slots reserve GBP0.568960 each; six optional review slots reserve GBP0.848960 each. Maximum reservation is GBP8.507520, below GBP9. No reservations are refunded. Expiring restricted-role SQL functions serialize admissions; only one request may be active. A ready slot is bound once to its exact payload and predecessor response digest. Failed, uncertain or incomplete provider work stops the entire campaign, without a retry.

The published GPT-5.2 default-tier prices checked on 18 October are USD1.75/M input, USD0.175/M cached input and USD14/M output. Reservations assume no cache, one UTF-8 request byte per input token plus 4,096 framing tokens, and bounded output tokens. Conversion reserves GBP1 per USD1 plus 25%; ECB's 16 October reference implies approximately GBP0.74989/USD. Usage-priced results are estimates, not an invoice reconciliation.

Draft payloads are bounded at 64,000 bytes / 24,000 output tokens; reviews at 256,000 bytes / 16,000 output tokens. No tools, images, redirects, priority tier or automatic retries. Missing usage retains the full slot reservation. No paid judge.

## Evaluation boundaries

All six draft packs are collected before semantic reviews, allowing 84 raw assets to be evaluated if a later check fails. Candidate reviews use the frozen `groundGeneration()` implementation, including one optional local correction and fresh revalidation. The candidate's 90-second shared provider deadline is retained by subtracting completed stage latency. Benchmark queuing and additional ledger overhead are excluded; these are provider-pipeline measurements, not full browser request latency.

The baseline retains its original prompt, schema, input normalization and output parser, with the same bounded provider transport for spending safety. Default tier, no storage, no retries and output caps are benchmark safety controls also applied to the older baseline.

Blind files contain only source context and A/B assets. Variant mapping and delivery state are withheld from independent assessors until scores are frozen. If the candidate blocks a pack, its raw draft may be scored diagnostically, but it is never counted as delivered or passed. All 14 formats must be accounted for; missing outputs and false-positive blocks are explicit release failures, not exclusions from the denominator.

## Execution and cleanup

`operator.mjs` uses the authenticated Vercel CLI and the existing isolated Neon owner launcher. It never obtains the OpenAI key locally. The Preview build reads the existing credential in memory, strips inherited customer/billing environment variables, validates the signed manifest and restricted Neon role, then makes its one-shot calls. It produces only an inert protected page, without an execution endpoint.

The fresh schema is `contentos_grounding_benchmark_20261018`; the expiring role is `contentos_grounding_runner_20261018`. They exist only on the pre-existing isolated branch `br-divine-term-b2rihbxv`. No production schema is modified. The earlier campaign remains closed and unchanged.

On completion or failure the campaign is disabled, the temporary role is made NOLOGIN and its grants revoked, active runner connections are terminated, and the temporary Preview is removed. Audit rows and synthetic evidence remain. Operator cleanup preserves recovery state until all required steps are confirmed.

Local deterministic tests: `node --test tests/grounding-benchmark-*.test.mjs`.
Real isolated SQL tests (no provider requests): `node /tmp/contentos-isolated-run.cjs env GROUNDING_LEDGER_ISOLATED_TEST=1 node --test tests/grounding-benchmark-ledger.test.mjs`.

Do not reopen or reset a completed campaign. A future live benchmark would require separate explicit authorization.
