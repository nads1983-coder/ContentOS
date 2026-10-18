# Infrastructure recovery and acceptance result

18 October 2026. Frozen application candidate `d4232b0ba6b8f492b84f7b0a1c5a1ff95cade924`, existing draft PR #3. One authorized protected Preview, no production changes.

## Result

**Infrastructure PASS; full live text delivery NO-GO.** The previous npm packaging failure is resolved. This is now a certificate acceptance problem, not a build, timeout, credential or database connectivity problem. Do not infer that the manual workspace, authentication, images or billing are unusable from this synthetic text-pipeline failure.

- Exact clean install: `npm ci --ignore-scripts --omit=dev --no-audit --no-fund` passed locally and remotely. `pg@8.23.0` and all 14 installed packages resolved. Optional `pg-native` is not required. Local Node 24.15.0; remote Node 24.21.0.
- Package and pinned lock hashes matched remote installer logs exactly. Lock SHA256: `39503f87182b0953cb3b84f1739731b93d243036bd91ecd6d402c61159731e38`.
- Preview `dpl_BTTwA5qAwzDVCepy2WRknQd7o7CK` reached READY. Anonymous access was protected; operator signature, existing runtime credential, exact isolated database, restricted privileges, checkpoint and account binding passed before dispatch.
- Both captured responses replayed unchanged: 96 accepted certificates, including six unsupported decisions. The preserved 307-unit draft was not regenerated.
- One new request: `1:review:0:2`, 54,421 serialized bytes, 13.633 seconds, complete known provider outcome. No automatic retry or uncertain call.
- Third batch returned 48 decisions. Three certificates were refused; 45 are individually parseable, but the batch was correctly rejected atomically. Accepted initial coverage remains **96/307**, final coverage **0/307**. No correction or final revalidation ran.
- Final packs persisted: **0**. Successful usage events: **0**. Draft and review evidence remain recoverable. Exactly-once *live successful delivery* is unverified, not passed. Fail-closed persistence and isolated account binding did pass.

## Precise remaining observations

| Unit | Captured behavior | Impact |
| --- | --- | --- |
| u117 | Model called the GBP4 sample-envelope/two-swatch sentence supported; deterministic quantity/scope checks report missing evidence. The source explicitly limits included postage to the fictional country, while the sentence omits that qualification. | Requires scoped semantic adjudication, not a blanket quantity exemption or automatic approval. |
| u124 | Creative advice, “Before you pick a cushion cover pattern, pick your care routine”, has no deterministic finding but the creative-certificate category check refuses it. | Physical-product vocabulary still collides with curriculum classification in this phrasing. A classification false positive, not evidence of customer data/billing damage. |
| u128 | Model calls “Orin Textile has two cushion cover ranges” supported using a statement naming Arc and Bond and their pattern counts; deterministic scope checking refuses it. | Named categories versus an explicit/exhaustive quantity relationship need careful handling. Do not silently treat mentioned categories as proof of every quantity claim. |

The exact source, draft, response, payload, hashes and rejected decisions are in `execution.json`, `brief.json` and `raw-draft.json`. They were not edited to pass. Six earlier unsupported decisions and two new model-identified unsupported decisions remain recorded, not approved. No final pack exists for an independent final-asset assessment; none is claimed. No further classifier changes, paid campaign or weakened review were attempted.

## Spending and security

[GPT-5.2 official pricing](https://developers.openai.com/api/docs/models/gpt-5.2) reverified: USD1.75/M input, USD0.175/M cached input, USD14/M output. [ECB reference](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml), 16 October: GBP0.84385 and USD1.1253 per EUR. Reservation conversion remains the conservative GBP1.10/USD, with no cache discount assumed.

| Measure | Value |
| --- | ---: |
| New calls / approved maximum | 1 / 12 |
| Historical calls reused / combined calls | 3 / 4 |
| New usage-priced API cost | USD0.03503395 (approximately GBP0.026272) |
| Combined usage-priced API cost | USD0.17132185 (approximately GBP0.128472) |
| New conservative reservation | GBP0.186566 |
| Historical retained reservation | GBP0.792508 |
| Combined retained reservation | **GBP0.979074** |
| Preflight uniform worst-case combined reservation | GBP3.067768, below GBP3.08 |

This is provider token pricing, not an account tax/card invoice. All five earlier closed records were reconciled read-only; cumulative snapshots were not double-counted. Fresh ledger, no reopened or reset audit. Failure retains the full new reservation.

Cleanup verified: ledger disabled; role NOLOGIN, schema/function access revoked, sessions terminated; temporary deployment deleted and absence confirmed; staged execution files and operator access removed. Full build events and exact packaging inputs were saved before deletion. The isolated branch and immutable audits remain. Private audit SHA256: `7c9e2f3767d32eb14d2e7b5871ff444ac9ac0e9213ed5daba68ffdc16b213254`.

## Executed checks

- 5 runner behavioral tests passed (explicit mock transport, not semantic evidence).
- 13 real isolated-Neon checks passed: audit reconciliation, role isolation, account binding, atomic concurrent reservation, historical-call refusal, limits and uncertainty handling.
- Signed local build and exact clean install passed; remote READY/preflight passed. Full remote text log retained in `build-log.txt`; machine evidence in `infrastructure.json`.
- Restricted-release checks and launch/rollback decision are in [the final approval package](../../restricted-launch-approval-2026-10-18.md).

No production deployment, database write, customer access, Stripe modification, Founder retirement or merge occurred. The campaign is closed. Remaining numerical allowance is not permission to start another campaign.
