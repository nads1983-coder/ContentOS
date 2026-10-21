# Financial release closure: 21 October 2026

**BLOCKED - EXACT OWNER ACTION REQUIRED.** Read-only evidence checked at
14:14:39 UTC / 15:14:39 BST. No application changes or paid provider calls.

## Resolved historical reservations

A narrow Vercel log query succeeded where the previous broad query did not.
The three 18 October attempts produced four provider responses: two rejected
drafts, followed by one draft checkpoint and its failed review. Every response
logged known input/output token usage. Exact minute-level provider buckets match
those counts, including the two responses within the third attempt's minute.

| UTC minute, 18 October | Calls | Input | Cached input | Output | USD already billed |
| --- | ---: | ---: | ---: | ---: | ---: |
| 16:25 | 1 | 3,083 | 0 | 941 | 0.01856925 |
| 16:26 | 1 | 3,087 | 0 | 977 | 0.01908025 |
| 16:46 | 2 | 7,982 | 1,664 | 2,183 | 0.0419097 |
| Total | 4 | 14,152 | 1,664 | 4,101 | **0.0795592** |

The provider export identifies historical GPT-5.2 snapshot usage. Cached-aware
repricing agrees exactly. The third bucket combines 3,091/956 draft tokens and
4,891/1,227 review tokens. The evidence establishes billed inclusion by minute,
count, model and token totals, not an individual provider-ID database join.
There is no unmatched usage in these buckets and no need to invent a worst-case
estimate for these known responses. **Additional historical charge: zero because
it is already included, not because failures were assumed free.** The stale
production reservation rows were not changed, released or retried.

The separate compatibility call remains included once at USD0.028690. Its closed
GBP0.50 reservation is audit history, not an extra provider charge.

## Fresh costs, opening amount and remaining exposure

A fresh all-project/all-key/all-source organization cost export still totals
**USD1.4819176**. It agrees with the earlier project and line-item exports.
Using the existing conservative GBP1/USD plus 20% policy gives **GBP1.778302**
(`1778302` micro-GBP), leaving **GBP28.221698 before cutover exposure**.

- Last nonzero cost bucket ends 20 October 00:00 UTC; later empty buckets are
  not a finalized billing watermark. No new image/other billed categories appear.
- Production Neon at 14:09 UTC: the same three old reservations, no new entries
  within 20 minutes, no image reservation arrays. No customer identifiers selected.
- Production generation-log query from 19 October 12:27 through 21 October
  14:12 UTC returned no matches. Current deployment log groups contain no generation
  path. These are observations, not proof that logging captures every request.
- OpenAI project batch page: no batches found. Responses logs are not a complete
  charge journal; not all calls are stored. They cannot prove every other app idle.
- The entire accessible organization subtotal is included conservatively. It is
  not attributed exclusively to GetContentOS and is not added once per application.

**Opening snapshot:** `1778302`. **Final approved opening:** not yet set. Add only
new, non-overlapping charges and a documented upper bound for any unreported
requests at the controlled cutover. No finite bound on unknown other-application
dispatch has been established. Do not invent a GBP2/5 cushion and call it a bound,
reuse the three now-settled reservations as extra charges, or claim the 20% FX
contingency guarantees coverage for an arbitrary number of unreported requests.

The GBP30 ledger is global across GetContentOS accounts and AI routes. It cannot
enforce an organization-wide OpenAI ceiling on other apps that bypass this ledger.
Other-app costs before cutover must be identified or conservatively included;
ongoing outside-app spending must not be represented as controlled by this release.

## Provider configuration

Production still resolves to `21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc`, READY
deployment `dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs`.

Text: inherited `gpt-4.1`, verified by the retained server-side preflight/actual
response and unchanged shared production/Preview environment metadata. The
historical GPT-5.2 review pipeline is not the current production generator.

Image: `OPENAI_IMAGE_MODEL` exists but is a sensitive setting. Authorized connector
access was refused; authenticated CLI metadata succeeded, but the supported
single-variable read still returned a masked value. No credential was exported.
Local configuration records contain no usable model value; the owner also has no
record. **The `gpt-image-1.5` code fallback is not proof of the active override.**

Official [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1) and
[GPT Image 1.5](https://developers.openai.com/api/docs/models/gpt-image-1.5) prices
were rechecked and still match the candidate policy. Candidate maxima remain
GBP0.547431 text and GBP0.360576 image. The image maximum is applicable only after
confirming the actual model matches. Unknown models fail before provider dispatch.
Pricing review expires 19 November; model deprecation is documented, not bypassed.

## Shortest remaining owner action

1. Authorize one temporary, SSO-protected **configuration-only** Preview check in
   the existing Vercel project. It must inherit the same unchanged model settings,
   return only the two model names to an authenticated operator, make no OpenAI,
   Stripe or customer-database calls, export no secrets, and be removed afterward.
   This is a non-chargeable provider check, not an AI benchmark or production
   deployment. It has NOT been created under this read-only instruction.
2. Identify whether other apps dispatch through the same OpenAI project and
   authorize/arrange a controlled cutover interval with no untracked dispatch,
   or supply their pending-request evidence and finite cost bounds. Refresh costs
   and match outstanding requests during that interval; retain the uncertainty
   hold until resolved. This is the missing scope/exposure evidence, not a request
   to recover the now-reconciled three historical outcomes.

## Exact deployment configuration and procedure (not executed)

Use application candidate `70a8a570b6c9a39cca284506b9684df0a570d1db` plus documentation
updates only. Keep the current synthetic Preview out of production.

After separate owner production approval and a recoverable schema backup:

1. Drain old production provider work under the approved cutover controls; record
   an immutable cutoff and privately reconcile new usage without overlap.
2. Apply only `drizzle/0003_commercial_spending.sql` once to the verified production
   database. Verify its three tables, checks, foreign key, primary keys, month index
   and least-privilege runtime grants. No profile repair or old-migration replay.
3. Insert the approved configuration in one admin transaction, initially suspended.
   Required parameters are deliberately not defaulted to the snapshot:

```sql
BEGIN;
LOCK TABLE contentos_app.ai_budget_configuration IN EXCLUSIVE MODE;
INSERT INTO contentos_app.ai_budget_configuration
  (singleton, starts_month, opening_microgbp, suspended, evidence_reference)
VALUES
  (true, '2026-10', :'approved_opening_microgbp'::bigint, true,
   :'private_immutable_evidence_reference');
COMMIT;
```

An existing singleton causes failure; never add an upsert/reset. The snapshot
`1778302` is eligible only if refreshed evidence establishes no extra exposure.
Otherwise insert the evidenced larger total; abort if greater than 30 million
micro-GBP rather than clamping away real costs. Refresh the London month if rollout
occurs later. Neither SQL nor migration has been executed in production.

4. Build with existing production settings, verified models, production Neon and
   fixtures OFF. Verify without paid calls. Promote only with explicit approval.
   Keep admission suspended until the final opening reconciles and old requests
   have drained. Unsuspend in a separately audited operation; monitor holds/alerts.
5. Emergency response: suspend new admissions, keep workspaces available and all
   financial records intact. Prior production lacks the cap; rolling back requires
   explicit approval and external spend containment. Never drop ledger/history or
   alter subscriptions, owner Premium, Founder benefits or retirement status.

## Existing safeguards and checks

Source inspection confirms GBP30 London-month atomic admission, GBP20/25 private
durable warnings, cross-instance transaction locks, account/fingerprint binding,
no provider call inside a transaction, pre-dispatch failure release and full holds
for uncertain calls. History/usage delivery commits with financial state;
duplicates cannot dispatch again. Subscription prices and entitlements unchanged.

Capacity exhaustion returns HTTP503 before dispatch and successful-usage charging:
"AI generation capacity is temporarily unavailable. Your saved content and unused
credits are unchanged." Editing, saving and export remain available. The cap can
pause generation for subscribers, existing Founders and the complimentary owner.

New checks: four runtime responses matched to three provider minute buckets;
cached-aware legacy costs; refreshed organization subtotal; zero new retained
reservations; unchanged production deployment; supported masked-config reads;
private hashes and immutable audit; documentation whitespace validation. Prior
201 automated tests, 12 isolated scenarios and build/browser evidence remain
applicable to unchanged application code and were not needlessly rerun.
