# Final subscription-only production preparation

## Decision

Implementation and non-chargeable compatibility checks are complete. No further
general development or paid benchmark is proposed. PR #5 remains draft/unmerged.
The only owner action is approval of the controlled production cutover below.
**The final opening balance cannot be certified before admissions are paused and
in-flight/reporting exposure is reconciled.** This preparation does not authorize
that production change, merge, migration or deployment.

## Image replacement

Use `OPENAI_IMAGE_MODEL=gpt-image-2.5-flare-2026-09-08` at production build and
runtime. The route default and example configuration now use this pinned snapshot;
an explicitly configured model is not silently overridden. The existing production
environment still names Image 1 and must be updated during the approved cutover.
Text model and credentials remain unchanged.

OpenAI's [deprecation schedule](https://developers.openai.com/api/docs/deprecations)
recommends Flare or Sunburst for retiring Image 1. Flare is the better fit for this
single-image, text-prompt workflow rather than precision image editing. Its
[model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare)
confirms the pinned ID, Images API and USD5/M text-input, USD30/M image-output
pricing. Image inputs would cost USD8/M, but this route does not accept them.
The authenticated Default-project image selector lists the exact snapshot.

The [official guide/calculator](https://developers.openai.com/api/docs/guides/image-generation)
supports the unchanged high-quality square/portrait/landscape sizes, PNG, opaque
background and automatic moderation. On 21 October its high-quality estimates
were 1,756 output tokens for 1024x1024 and 1,372 for both 1536x1024 and 1024x1536.
The existing larger 6,250-token reservation is retained as a conservative margin,
not misrepresented as a published Flare maximum or a provider-side monetary cap.

```text
serialized request ceiling: 16,000 UTF-8 bytes + 4,096 input-token overhead
input reservation: 20,096 * USD5/M  = USD0.100480
output reservation: 6,250 * USD30/M = USD0.187500
maximum admitted reservation:        USD0.287980
GBP1/USD with 20% contingency:        GBP0.345576
```

Actual quotes use actual serialized payload size. Streaming, partial images,
image inputs, extra outputs, custom sizes, automatic/higher quality, unreviewed
models and unknown fields remain refused. Old Image 1/1.5 settlement rates are
preserved. Unknown usage retains its whole reservation; reported bound violations
suspend further admissions. Existing policy expiry remains 19 November 2026.

Availability in the authenticated selector and passing mocks do not prove a live
image will succeed with the production key, meet latency limits or have acceptable
visual quality. No paid request was authorized or made. Existing error handling,
template fallback and no-charge-on-failed-delivery behavior are retained; no
automatic provider retry was added.

## Fresh financial evidence

Cost export downloaded at approximately 17:59 UTC and activity export at 18:03 UTC,
21 October 2026, from the owner's existing authenticated OpenAI session. Both
include all projects/keys, beginning 30 September to cover the London-month edge.
Raw files remain privately in Downloads, outside Git.

| Evidence | Result |
| --- | --- |
| Cumulative recorded cost | USD1.4819176, all nonzero rows in Default project |
| Conservative GBP subtotal | GBP1.778302 (1,778,302 micro-pounds) |
| Remaining snapshot capacity | GBP28.221698 |
| Text activity | 40 calls, 145,073 input and 95,748 output tokens; one key |
| Last nonzero daily bucket end | 20 October 00:00 UTC |
| Last exported daily bucket end | 22 October 00:00 UTC |
| Cost CSV SHA-256 | `3917c8939ab4cf016943933589d1cd4969df754185af666fdb15057244ceb0d3` |
| Activity CSV SHA-256 | `82154dd8b507072c874781f11ca3635a8e16a2d8141e7c921a93c3fd0eb5b50a` |

No increase against the reconciled historical evidence. The three historical
reservations and compatibility call remain included exactly once. Empty amounts
are not invented zero charges: totals sum recorded rows only. The future daily
bucket end is not a billing-completeness watermark. Neither the export nor logs
certify the absence of delayed/in-flight calls. **Final opening: not yet fixed.**
Opening must equal the latest conservatively converted cumulative billed amount
plus only non-overlapping, evidenced unreported exposure. Do not add this subtotal
again to a later cumulative export. Stop if exposure is unbounded or exceeds GBP30.

TaskPilot's refreshed Vercel metadata still has no OpenAI credential/model and
only a Preview-scoped AI flag. Its last-24-hour production logs contained one
ordinary server-action warning and no AI-dispatch evidence. The fresh provider
text export has the same 40 calls and one key as the prior reconciled record.
This is not proof of no direct/local use of TaskPilot's active shared-project key.
Prior masked bindings for other sites remain unverified; no other application,
credential, project or configuration was changed. GetContentOS's GBP30 ledger
controls GetContentOS dispatch only, never all shared-project spending. Keep any
unattributed historical exposure conservatively accounted at cutover; do not
require unrelated websites to stop or imply their future spend is capped here.

## Actual checks

- 49 targeted cost/image/reservation/subscription tests passed, including the
  pinned replacement, all four rendered layouts, unsupported parameters, usage
  settlement, deduplication, isolation and preserved historical billing fields.
- 55 text-generation and Founder journey/retirement tests passed: actual route
  orchestration with mocked providers, no automatic retries, exactly-once usage,
  retired acquisition, preserved lifetime benefits and owner complimentary access.
- Typecheck, lint, ordinary production build and explicit production-mode build
  passed (51 routes). The latter used `CONTENTOS_PREVIEW_FIXTURES=0`,
  `VERCEL_ENV=production`, and the pinned image model. It is a local build, not a
  cloud production deployment or proof of live provider success.
- `git diff --check` passed. No dependency/lockfile, UI, subscription price,
  entitlement, text-prompt or migration changes.
- Prior 12 isolated Neon integration scenarios and 1440/768/390 browser evidence
  are reused for unchanged ledger/database/UI logic, not claimed as new runs.
  The attempted integration rerun was stopped before connection: automatic safety
  review refused transferring a database password through terminal input. No
  workaround was attempted. The harness now expects Flare settlement for its next
  securely provisioned run. Local tests cover that changed arithmetic.
- Fresh connector-only read checks confirm isolated tables and runtime SELECT,
  INSERT and settlement UPDATE grants, denied opening-balance UPDATE and denied
  audit DELETE. Production has neither new spending table and has its runtime role.
- Existing production is still READY at commit
  `21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc`, deployment
  `dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs`. Latest logs do not establish an in-flight
  cutoff. No paid AI/Stripe calls, customer writes, merge or deployment occurred.

## Recovery and exact release sequence

A manual production Neon snapshot was created and independently listed:
`snap-solitary-silence-b2oypnev`, `pre-pr5-subscription-only-20261021`,
21 October 18:01:39 UTC. It captures `br-broad-sea-b29qogmq`. Existing point-in-time
retention is six hours. No restore drill or production restore was performed.
Refresh the recovery point at actual cutover if needed; prefer additive rollback
over restoring an old database over newer customer work.

After explicit owner approval, execute this sequence, stopping on a failed gate:

1. Confirm the approved PR head and unchanged live identity. Preserve production
   environment metadata and model rollback value privately. GetContentOS Vercel
   currently has no custom firewall configuration; default mitigations are active.
   Add only a temporary generation-path admission rule after approval, covering
   `/api/generate` (including refinement) and `/api/generate-image`, including old
   deployment hosts. Verify blocked requests before provider dispatch. Keep auth,
   content retrieval, editing, billing and webhooks available. Do not change other
   applications or disable existing protections. Abort if this isolation cannot
   be established with existing free infrastructure.
2. Drain existing requests, reconcile durable status/unknown outcomes and obtain
   the latest provider export. Record the immutable cutoff and any finite delayed
   exposure without overlap. Missing billing evidence is not zero. If it cannot
   be bounded, keep generation paused and wait for provider reporting; do not
   initiate a paid test or another development cycle.
3. Verify the recovery point. Apply only `drizzle/0003_commercial_spending.sql`
   once, transactionally, to production `contentos`. It creates three shared
   controls only, not Lifetime commerce. Verify checks, indexes and runtime grants.
4. Insert the exact approved opening, initially suspended. The earlier subtotal
   is not an automatic default; an existing singleton must fail, not reset:

   ```sql
   BEGIN;
   LOCK TABLE contentos_app.ai_budget_configuration IN EXCLUSIVE MODE;
   INSERT INTO contentos_app.ai_budget_configuration
     (singleton, starts_month, opening_microgbp, suspended, evidence_reference)
   VALUES (true, :'cutover_london_month', :'approved_opening_microgbp'::bigint,
           true, :'immutable_cutover_evidence_reference');
   COMMIT;
   ```

5. Set only the production image model to `gpt-image-2.5-flare-2026-09-08`.
   Preserve the verified production text model `gpt-4.1`, credentials, prices and
   existing access settings. Keep development fixtures disabled and isolated
   database settings absent. Never copy `.env.example` over production settings.
6. Build the exact approved commit in the existing Vercel project with the real
   production configuration. Verify non-chargeable authentication/account checks,
   saved content, subscription/Founder/owner access and suspended generation before
   promoting. Do not promote the older synthetic Preview. Merge only if included
   in the owner's final approval and do not accidentally trigger an earlier build.
7. Only after financial and deployment gates pass, audit the singleton unsuspension
   and restore generation admission for the capped deployment. Old uncapped hosts
   must remain blocked. Retain the retired Founder acquisition status, all Founder
   and complimentary owner benefits, Free accounts and recurring subscriptions.
8. Monitor private GBP20/25 alerts, capacity503s, provider failures and uncertain
   holds. These alerts are private dashboard records, not an assumed email service.
   Rollback: suspend admission first, retain every ledger record, revert deployment
   only with old uncapped generation still blocked. Do not reset the ledger, drop
   audit tables, restore obsolete Image 1 after shutdown, or overwrite customer data.

## Single approval needed

Approve the exact PR-head cutover, including a temporary generation-only pause,
final financial reconciliation, migration, pinned Flare production setting and
conditional deployment. Admissions must remain suspended if the final opening
cannot be evidenced within GBP30. No extra service, paid test or owner dashboard
re-export is currently needed; the authenticated session is accessible.
