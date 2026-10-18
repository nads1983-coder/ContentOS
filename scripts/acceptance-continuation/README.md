# RC717 Acceptance Continuation

Separate continuation authorization: original campaign remains closed and immutable.
No draft generation is permitted by either transport validation or ledger SQL.
The authorized continuation has started; preparation and execution are permanently
closed. Reporting and cleanup remain available.

One authorized protected Preview, existing `content-os` project, exact application
commit `717b4dfb9f7fcd3257ac9c0750fbc9bcb74bffa8`. The application is not modified.
Synthetic Orin Textile brief sealed independently before execution; all 14 formats.
No execution HTTP endpoint. Operator-authenticated one-shot build, signed frozen
modules, expiring restricted Neon role, existing isolated branch only. Provider
key stays in the Preview process and is never exported. No production actions.

## Spending Preflight

Official GPT-5.2 default pricing verified 18 October 2026: USD1.75/M input,
USD0.175/M cached input, USD14/M output. Model limits: 400,000 context and
128,000 output tokens. Application caps remain 24,000 draft / 4,800 review.
ECB 16 October: GBP0.84385/EUR and USD1.1253/EUR, GBP0.7498889185/USD.
Campaign reserves GBP1.10/USD, 46.69% above the reference (22.24% above a 20%
tax-uplifted reference); this is a conservative accounting assumption, not a
claim to know the eventual invoice exchange rate. Candidate USD admission
padding remains unchanged and is checked separately from campaign GBP.

Each complete serialized UTF-8 body + 4,096 bounds input tokens. No cached
discount in reservations; output is reserved at the full cap. Rational integer
arithmetic avoids micro-currency rounding disagreements. All failed/uncertain
reservations are retained; no automatic paid retries.

The previous **GBP0.419173** reservation is carried forward without refund.
Fourteen 56,000-byte review caps plus that reservation total **GBP3.073643**,
under the approved combined GBP3.08 / 15-call ceiling, including the completed call.
All seven actual initial-review payloads fit: 50,089 to 55,275 bytes.
Unseen outputs/corrections can exceed the cap: stop before dispatch, never
truncate context or bypass units. The 307-unit original draft requires seven initial
and up to seven fresh-review batches. All 14 formats remain mandatory.

## Isolation And Closure

The SQL ledger reserves atomically before dispatch, verifies frozen application
stage hashes/USD reservations, binds a fresh synthetic profile and denies
direct auth/app/ledger access. One local correction pass only; actual candidate
functions enforce exhaustive fresh review. Final-save replay must retain exactly
one history entry and one successful usage event. Provider uncertainty stops.
Original campaign, job, profile and checkpoint hashes are reconciled against Neon
before preparation. The exact checkpoint is copied without changing its creation
time, model output, source context, metrics or USD admission reservation. Only the
synthetic account identity and campaign marker are rebound. The prior account,
ledger and audit are untouched. The original 45-minute checkpoint deadline applies.

Finally disable the ledger, revoke role login and privileges, terminate its
sessions, export the audit, delete only the plan-matched temporary Preview and
verify deletion. Preserve recovery state if any cleanup step is uncertain.
Close prepare/execute permanently after the single authorized deployment.

Sources: https://developers.openai.com/api/docs/models/gpt-5.2 and
https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml

The focused operator verifier is `node --test tests/acceptance-continuation-local.mjs`.
It needs the secured original audit and its still-valid checkpoint; it is intentionally
not in the default application test glob. No provider calls are made by this verifier.
