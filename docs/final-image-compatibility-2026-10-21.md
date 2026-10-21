# Final subscription-only image compatibility correction

## Verdict

The code compatibility defect is resolved. **BLOCKED - external model availability
and final cutover expenditure require owner action.** No further general development
or paid benchmark is proposed. PR #5 remains draft and unmerged.

Production was reconfirmed READY at 17:38 UTC on 21 October:
`21ff2b8bcaf7420e3f0b22204060f1f2c859c0fc`, deployment
`dpl_ARA1dZsFsQydFfsxCKXu8D3mZHDs`. It was not changed.

## Minimum correction completed

- `lib/ai-cost.ts` now reserves and settles `gpt-image-1` using its own output
  rate. Existing `gpt-image-1.5` quotes remain correctly priced, including historical
  settlement. No model, quality, route payload, subscription price or entitlement
  was changed. The policy is versioned `2026-10-21-v2`.
- Only bounded text-only single-image requests are admitted. Unknown fields,
  streaming/partial images, input images/masks, automatic sizes/quality, extra
  outputs and unsupported models fail before provider dispatch.
- GBP30 monthly admission, GBP20/25 private warnings, transaction locks, exactly-once
  usage, account isolation, pre-dispatch releases and full uncertain-call holds
  are unchanged. No new migration or commerce functionality was added.
- New Image 1 reservations stop at 00:00 UTC on 23 October, the conservative start
  of its published shutdown date. Existing-call settlement and text are unaffected.
  This does not select a replacement model or change production configuration.

## Pricing and bounds

Official [Image 1 pricing](https://developers.openai.com/api/docs/models/gpt-image-1),
rechecked 21 October: USD5/M text-input tokens, USD40/M image-output tokens. No
cached-input discount is relied upon. The existing route sends `n=1`, `quality=high`,
PNG, opaque background, automatic moderation and one of 1024x1024, 1024x1536 or
1536x1024. There are no input images.

The [official token table](https://developers.openai.com/api/docs/guides/image-generation)
lists 4,160 / 6,240 / 6,208 high-quality output tokens for those sizes. The policy
retains a rounded 6,250 bound for all three. Full serialized payload is limited to
16,000 UTF-8 bytes, plus 4,096 input-token overhead. Thus:

```text
maximum input:   20,096 tokens x USD5/M  = USD0.100480
maximum output:  6,250 tokens x USD40/M  = USD0.250000
maximum USD exposure:                    USD0.350480
GBP1/USD with existing 20% contingency:   GBP0.420576
```

Actual reservations use actual serialized bytes plus overhead, so this is the
maximum permitted request, not an assertion that each image costs this much.
Unknown provider usage keeps the full reservation. Bound violations suspend
admission. The existing text maximum remains GBP0.547431; Image 1.5 GBP0.360576.

**External availability:** OpenAI's
[deprecation schedule](https://developers.openai.com/api/docs/deprecations)
explicitly lists **23 October 2026** for `gpt-image-1`. Keeping that model forever
is not possible through an application fix. The owner must either approve a
separately reviewed supported replacement (not done here), or explicitly accept
an interim release whose paid image generation pauses on that date. No new service,
account or paid test is required to make that decision. This is not a claim that
a replacement has already been validated. General pricing expiry remains
19 November; the earlier model-specific date takes precedence.

## Tests actually executed

- 48 focused tests: seven cost-policy tests, production-image route rendering
  across all four layouts, replay/one-credit accounting, failure/uncertainty,
  account isolation, quota/concurrency, subscription checkout, retired Founder
  acquisition, retained Founder/owner benefits and historical fields.
- 12 existing isolated Neon scenarios rerun on the existing temporary branch:
  image-priced final-budget race admits exactly one; correct Image 1 settlement;
  unknown/failing calls retain maxima; duplicate attempts cannot redispatch;
  actual text route delivers all 14 mocked formats with one history/usage record;
  actual image route persists once; warnings, rollover, grants and rollback pass.
  Synthetic test profiles/requests were cleaned up and prior configuration restored.
  No production rows or historical acceptance evidence were changed.
- `npm run typecheck`, `npm run lint`, `npm run build -- --webpack`, and
  `git diff --check` passed. No dependency or lockfile changes.
- Prior untouched-system release/browser evidence is reused, not represented as
  a new live test. No chargeable AI or Stripe request, new Preview or deployment.
- The isolated pg driver warned about a future major-version SSL-mode semantic
  change; current pinned driver treats `require` as verified TLS. No TLS bypass.

## Shared project and finances

TaskPilot metadata refreshed at 17:35 UTC: still no OpenAI credential/model in the
returned Vercel variables, only a Preview-scoped AI flag. Its already-inspected
deployed source requires both enablement and a key. A production log query for
20 October 17:36 through 21 October 17:36 returned one ordinary `/` warning, no
provider/AI-job indication and no omitted interval/pagination. There is **no
positive evidence of current hosted AI dispatch**. Logs and variable names do not
prove absence of external workers or direct use of its active Default-project key.

Earlier same-day GorlLead live configuration and other-app metadata findings in
the [financial report](financial-release-closure-2026-10-21.md) remain applicable.
LeadWithNadine and 100SecurityPrompts deployed key/project binding remains masked.
No other applications, keys or projects were changed. The GBP30 cap is exclusively
GetContentOS admission control, never a promise about the whole OpenAI project.

Authoritative recorded October charges remain **USD1.4819176 / GBP1.778302**.
The three old reservations and compatibility call are already included once.
GBP28.221698 is the remaining *snapshot* capacity, not an approved final balance.
The accessible Chrome billing tab is now at OpenAI sign-in, so no newer export or
final billing watermark was obtained this pass. No missing exposure is assumed zero.

## Exact production cutover, not executed

1. Owner restores OpenAI billing sign-in or supplies a fresh all-project October
   cost/usage export (cost-free), and explicitly authorizes the cutover. Confirm the
   image-model availability decision above. No release should advertise continued
   Image 1 availability after its shutdown date.
2. During a short scheduled window, block only new GetContentOS text/image/refine
   provider dispatch, including direct old-deployment URLs; keep workspaces and
   billing webhooks available. Use an approved existing ingress control, not just
   a UI notice. Drain requests, record the cutoff, and retain unknown-call holds.
   No such production control has been changed under this instruction.
3. For masked potential shared-key users, pause their AI jobs/direct automation
   only if the owner separately authorizes it; do not pause unrelated websites.
   Otherwise obtain finite pending-call evidence for those sources. If neither is
   possible, leave admission suspended: do not claim a project-wide bound. Separate
   projects are optional future administration, not a new service prerequisite.
4. Refresh provider costs at cutover. Opening = conservatively converted fresh
   cumulative billed total plus only non-overlapping bounded unreported exposure.
   Do not add the known USD1.4819176 again to a cumulative export, or add already
   billed legacy reservations. Wait/reconcile if lag has no finite bound. Abort if
   the result exceeds GBP30; do not clamp it. Capture immutable private evidence.
5. After backup, apply only `drizzle/0003_commercial_spending.sql` in a transaction
   on verified production Neon. Check three shared tables, checks/indexes and
   `contentos_runtime` grants. No old migration replay, profile repair or Lifetime
   tables. Insert the singleton initially `suspended=true` using the exact
   parameterized SQL in the financial report, with the reconciled opening value
   and actual London month. No upsert/reset. The GBP1.778302 snapshot is not a default.
6. Build/deploy the exact owner-approved commit with unchanged production model
   and credential settings, fixtures OFF. Do not promote the synthetic Preview.
   Verify auth, subscriptions, Founder/owner access, saving and refusal while
   suspended without paid calls. Only then unsuspend through an audited operation
   and remove the temporary ingress block. Do not open admissions if reconciliation
   or model-availability checks fail.
7. Monitor private GBP20/25 warnings, capacity503s, uncertainty and webhook errors.
   Emergency stop is `suspended=true`, preserving all records. Rollback to the
   prior deployment requires maintaining provider-admission blocking, since it
   lacks the cap. Never drop financial/history rows or reset opening spend.

The remaining work is an external billing/cutover and model-availability decision,
not another general development cycle. No merge or production action is authorized
by this report.
