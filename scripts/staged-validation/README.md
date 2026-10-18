# Final staged-delivery validation: CLOSED

Single authorized campaign, 18 October 2026. Maximum GBP4 and 23 paid calls; one protected temporary Preview in the existing `content-os` project, existing OpenAI credential in build-process memory only, fresh isolated Neon ledger, one unseen synthetic brief, all 14 formats.

**Outcome: blocked after two completed provider calls.** The draft took 50.446s, the first 48-unit review 10.641s. The server rejected four review certificates; no review batch was accepted, no validated history/usage was saved. The draft remains in the isolated synthetic checkpoint. No timeout or provider uncertainty occurred. Known token-priced cost USD0.09541175 (approximately GBP0.07155); nonrefunded worst-case reservation GBP0.639420. No further calls are authorized by the unused ceiling.

`operator.mjs prepare` and `execute` refuse before credential/database access. Do not reopen this campaign. Audit/export/cleanup modes remain available. Previous campaigns were not reused.

## Architecture and safeguards

- Candidate pinned to `c32110aa3711a14bc59a8e7b1da7e8d5f0e38e4c`. Exact pure stage, validation, reservation and final-save functions compiled from that commit. Only the three entitlement normalization helpers and their pure dependency were extracted from Stripe code; no Stripe transport is included.
- Authenticated Vercel operator dispatch plus signed, expiring manifest. No execution URL, public benchmark endpoint, automation bypass or deployment-protection change. The build emits an inert protected page only.
- Existing isolated branch only. Fresh `contentos_staged_validation_20261018` schema; expiring `contentos_staged_runner_20261018` role has EXECUTE-only access. Security-definer functions bind one synthetic profile by campaign hash/account marker. Runner cannot read customer/auth schemas or mutate ledger tables directly.
- Real profile row locking and JSON checkpoints, with commits before provider calls. This is the actual transition logic and real isolated persistence, not a live browser/authenticated HTTP benchmark; earlier route/browser tests remain separate evidence.
- SQL derives the reservation from exact UTF-8 payload bytes, fixed model/tier/output caps and published rates. One byte per input token plus 4,096 framing tokens; no cache discount; GBP1.25 per USD1 reservation. A row lock and unique active-call index enforce cumulative GBP4, 23 calls, no concurrent dispatch, no replay and no refund of failed/uncertain work. Provider calls have independent 90-second deadlines and no retry.
- An unsupported review decision or invalid certificate stops the entire campaign. The campaign does not buy a corrective pass after a detected claim failure. Correction/revalidation therefore remained unexercised live.
- One post-draft stale-stage lookup exercises checkpoint recovery without repeating paid generation. Final-save replay would execute only after full acceptance; it was not reached.
- Existing shared cleanup helper handles deployment discovery, disable, NOLOGIN, grants revocation, connection termination, audit export, DELETE and confirmed GET404. Cleanup completed; temporary credential/staging files removed. Synthetic checkpoint and audit retained, no customer records touched.

## Reproduction without paid calls

```sh
node --test tests/staged-validation.test.mjs
node /tmp/contentos-isolated-run.cjs node tests/staged-validation-isolated.mjs
```

The second command is opt-in and creates/removes only disposable synthetic fixtures on the verified isolated branch. It never runs a provider call or modifies the consumed campaign. The initial SQL test exposed a CASE-expression parser error; it was corrected before campaign preparation and before any paid call. All ten isolated checks then passed.

`export-evidence.mjs` reads private operator audit files, exports only synthetic content and deidentified execution evidence, and requires confirmed cleanup first. It has no network/provider transport. Private paths and runtime credentials are never committed.

Evidence and independent assessment: [final report](../../docs/staged-live-validation-2026-10-18.md). Production release remains NO-GO.
