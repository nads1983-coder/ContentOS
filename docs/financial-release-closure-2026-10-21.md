# Financial release closure: 21 October 2026

**Later follow-up:** the targeted image pricing defect below is now fixed and
tested. See [final compatibility and cutover report](final-image-compatibility-2026-10-21.md)
for current status, the provider's 23 October Image 1 shutdown and final billing
requirements. The following preserves the earlier inspection evidence.

**BLOCKED - IMAGE COST POLICY MISMATCH AND OPENING EXPOSURE.** Financial evidence
checked at 14:14 UTC; configuration/project-scope follow-up at 14:31 UTC on
21 October. The owner-authorized configuration-only Preview completed and was
removed. No application changes, production changes or paid provider calls.

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

The authorized configuration-only Preview returned `gpt-4.1` and **`gpt-image-1`**
at 14:27:22.498 UTC. Both model variables are single unchanged settings shared by
production and Preview, with no branch override. No explicit OpenAI project setting
was present. The probe read only model names/project metadata, not the API key;
its function overrode provider, database, email and Stripe credential values with
empty strings and contained no network/database client. No project settings changed.

Preview `dpl_4P7tLAbwAH3jz5nrGYC2DR5rRyjh` reached READY with Vercel Authentication.
Anonymous access redirected to authentication (302); authenticated CLI access
returned the allowlisted configuration. Complete build/deployment logs are retained
privately. The deployment was deleted and its endpoint subsequently returned 404.
No new bypass credential was created; existing SSO protection was not altered.

**Material compatibility finding:** `lib/ai-cost.ts` admits only `gpt-image-1.5`.
An offline execution of the actual pricing function with the observed
`gpt-image-1` rejects with `unreviewed_provider_payload` before dispatch. Deploying
this candidate unchanged would disable images. Do not replace the production model
or merely add its name to the allowlist: its output rate is different.

Official [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1) pricing
still supports the text policy. Official
[GPT Image 1](https://developers.openai.com/api/docs/models/gpt-image-1) pricing
is USD5/M text-input tokens and USD40/M image-output tokens, versus the candidate's
USD32/M output rate for Image 1.5. The published high-quality rectangular output
price is USD0.25. Under the existing 20,096 input/6,250 output bounds, the *proposed*
Image 1 reservation would be GBP0.420576, not GBP0.360576. This calculation is not
an implemented policy or approval to change models. Pricing review expires
19 November; the provider marks Image 1 deprecated, so availability also needs a
documented review before release. No paid probe was made.

## Other applications and project scope

The accessible Personal organization exposes one selectable Default project. Its
identifier matches the earlier provider exports; exact identifiers and key tracking
metadata remain in private evidence. All 40 recorded October text requests in the
export belong to one key labelled **LeadWithNadine Content Machine**, including the
matched GetContentOS calls. This establishes GetContentOS usage in that project,
but a key label is not proof that every call originated in the similarly named app.

| Application or credential | Verified evidence | Sharing conclusion |
| --- | --- | --- |
| GetContentOS | Matched provider usage in Default project; production/Preview model settings confirmed. | Uses Default project; exclusivity is not established. |
| TaskPilot AI | Active key with this label in Default project; dashboard shows USD0.00 and last use 11 October. Current Vercel env metadata has no OpenAI credential/model/project; deployed source requires both `AI_ENABLED=true` and a key. Retained Preview config says AI disabled. | Named credential shares Default project, but no evidence current Vercel deployment dispatches chargeable AI. Other/local use of that key cannot be excluded. |
| GorlLead | Live `gorllead.com` is Sites-hosted; latest saved version is 40. Live env revision 22 lists 24 variables, none for OpenAI/provider models/projects. Available local generation module validates supplied content without provider transport. | No shared OpenAI credential found in accessible hosted configuration. External ChatGPT/automation/backend activity is not established by that inspection. |
| LeadWithNadine | Production/Preview OpenAI credential exists; no explicit project/org setting; secret is masked. | Deployed credential-to-project binding unverified. Similar key names are not sufficient proof. |
| 100SecurityPrompts | Production/Preview OpenAI credential exists; no explicit project/org setting; secret is masked. | Deployed credential-to-project binding unverified. |
| Other visible Vercel projects | Fire Risk Experts, Zapbooked, Nadine Analytics, Clean Start Calculator and Business Sorted have no matching provider variables in returned project metadata. | No positive evidence of sharing; not proof against every integration or external host. |

Default project also has active keys labelled Codex, Clear Draft, SEO Publisher,
nadinepierre.com Articles, All Website Key 2 and All Websites. Only the Content
Machine key has nonzero recorded October spend. Rounded USD0.00 key displays do
not establish the absence of pending requests; the detailed export remains the
financial source. No keys, secret prefixes/suffixes or customer data are published
here. No credential was revealed, compared by secret value, exported or changed.

**Protection scope:** after a compatible release, the atomic GBP30 ledger can
bound admitted GetContentOS requests. It does not debit requests from other apps,
stale deployments, direct key use or scripts that bypass that ledger. Shared
provider billing therefore is not protected by the application cap as a whole.
The cap is not deployed yet. Including the organization subtotal once in the
opening balance avoids understating known history but cannot bound future outside
dispatch or arbitrary billing delays.

Recommend a dedicated project and app-scoped credential for each independently
operated application, starting with GetContentOS, with separate provider-level
limits and application reservations. This is a recommendation only: no projects,
keys, permissions or billing controls were changed. Current
[OpenAI spend-limit documentation](https://developers.openai.com/api/docs/guides/spend-limits)
distinguishes alerts from optional enforced hard limits, and notes enforcement
delay can cause slight overshoot. No existing enforced limit was verified here;
do not represent a dashboard budget alert as a hard ceiling. Separation improves
attribution but does not alone guarantee a strict GBP30 total.

## Exact remaining decisions

1. Authorize the focused candidate-only cost-policy correction for the existing
   `gpt-image-1` model, with model-specific settlement, conservative bounds and
   offline tests. No production model/credential change or paid call is needed.
   This financial-inspection task did not modify application code.
2. Before cutover, establish deployed key/project provenance for LeadWithNadine
   and 100SecurityPrompts through a non-secret configuration record or separately
   authorized read-only runtime verification. If provenance cannot be recovered,
   conservatively include those potential sources in an owner-approved dispatch
   pause/drain interval. Also account for direct/shared-key automation. Refresh
   provider costs, reconcile pending calls and retain finite uncertainty holds.
   No final opening amount is claimed until this is done. Project separation is
   optional and requires separate authorization; it is not silently performed.
3. Separately approve the verified migration/opening amount and production
   deployment. The procedure below remains gated, not permission to execute it.

## Exact deployment configuration and procedure (not executed)

Application candidate `70a8a570b6c9a39cca284506b9684df0a570d1db` is **not ready for
unchanged deployment** because of the confirmed image-policy mismatch. Record and
validate the focused corrected candidate before this procedure. Keep the current
synthetic Preview out of production.

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
private hashes and immutable audit; documentation whitespace validation. The
configuration follow-up adds seven probe safety assertions, authenticated read,
anonymous denial/deletion404, nine-project metadata inspection, live GorlLead env
metadata and deployed TaskPilot source inspection. Two offline actual-model
assertions confirm text acceptance and reproduce the image rejection; four
existing cost-policy tests pass. These tests do not resolve the incompatibility.
Prior
201 automated tests, 12 isolated scenarios and build/browser evidence remain
applicable to unchanged application code and were not needlessly rerun.
