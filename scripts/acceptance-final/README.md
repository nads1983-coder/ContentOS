# Final a7cd acceptance continuation

One authorized protected Preview in the existing content-os project. Execution
and preparation are closed after its launch; only audit and cleanup may run.
No application source is modified. Candidate:
`a7cd2c6ce6d62d78f4cc1670f0992afdf4f123cb`.

The fresh restricted Neon ledger retains both original reservations (GBP0.605550).
It permits only six remaining initial-review keys and seven fresh-review keys,
at most GBP2.47 new / GBP3.08 combined conservative reservations. Each payload is
limited to 56,000 UTF-8 bytes, 60,096 input-token bound and 4,800 output tokens.
Worst-case new GBP2.464865 / combined GBP3.070415. No cached-price discount is
assumed. Provider failures/uncertainty retain their reservations and stop; no retry.

Current GPT-5.2 prices were rechecked on 18 October 2026: USD1.75/M input,
USD0.175/M cached input and USD14/M output. GBP1.10/USD is the conservative bound;
ECB 16 October reference is GBP0.84385/EUR divided by USD1.1253/EUR. This remains
an API usage/reservation calculation, not a provider invoice or assertion about
the customer's eventual tax/currency treatment.

Both closed Neon records and private exports must hash-match before preparation.
The 307-unit draft is byte-preserved. The original 48 decisions are reprocessed
locally under the current parser; two remain unsupported. Source, units and review
instructions match the original payload, apart from the explicitly approved u47
parenthetical-count false-positive diagnostic becoming empty. No original capture
is edited. Original charged metrics/payload hashes are retained; the new parsing
context hash is recorded separately.

This is a new synthetic acceptance attempt with a fresh 45-minute lifetime,
not reopening an expired production attempt. Only its reservation creation time
and synthetic identity are rebound. The original source/checkpoint/response/audit
remain immutable and linked; no generation or first-review transport is possible.

Operator-authenticated one-shot build, signed frozen candidate modules, existing
server-side key only, protected Preview, expiring EXECUTE-only database role,
no execution HTTP endpoint, no direct auth/customer/ledger access. Every stage is
saved atomically before transport; full fresh review is required after correction.
Cleanup disables the ledger, revokes role access, terminates sessions, exports the
audit and deletes only the plan-matched temporary deployment. Spending records
and synthetic checkpoints remain for recovery/audit. No production action.

Focused no-provider checks: `node --test tests/acceptance-final-local.mjs` and
`node /tmp/contentos-isolated-run.cjs node tests/acceptance-final-isolated.mjs`.
Historical app tests are reused because app code is unchanged. See the campaign
report for actual outcome, costs, review coverage and limitations.
