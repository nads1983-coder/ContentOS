# One-shot isolated benchmark audit

These operator scripts are not imported by the application and expose no HTTP endpoint.
They document the 2026-10-18 owner-authorized Preview benchmark, not a production feature
or migration. Do not run `ledger.sql` against production or reset/recreate its campaign.

Both authorized temporary deployments have been removed. The six initial jobs and three
separately approved corrected-prompt jobs are complete; the runner role is revoked and
disabled. No additional live execution is authorized by the presence of these scripts.
The prompt-only candidate is now pinned to its historical revision, and operator
setup/deploy plus CLI live/init entry points are disabled. These scripts do not
benchmark the newer multi-stage grounding pipeline. See
`docs/grounding-benchmark-proposal.md` for the unapproved held-out follow-up.

## Controls

- Existing `content-os` project, Preview only, unchanged Vercel authentication.
- One operator-authenticated deployment build, with an expiring Ed25519-signed manifest.
- Existing OpenAI Secret remains in Vercel process memory. No key export or new key.
- Six fixed synthetic payloads: three briefs, baseline/candidate, all 14 formats.
- A separately approved follow-up appended three corrected candidate jobs to the SAME
  ledger, preserving all six prior hashes, states, evidence and reservations. Its
  authorization row retains the original campaign completion time/reason.
- A restricted role can only execute fixed SECURITY DEFINER ledger functions on the
  existing temporary Neon branch. It cannot access auth/application schemas or write
  ledger tables directly. Function search paths and PUBLIC permissions are restricted.
- A campaign row lock serializes admission across instances. Each unique job permanently
  reserves GBP 0.568960 before networking; all six reserve GBP 3.413760, below GBP 5.
- Follow-up reservations use the exact immutable serialized UTF-8 payload bytes plus
  4,096 framing tokens, the same 24,000 output cap/rates, GBP 1/USD and 25% headroom:
  GBP 0.463359, 0.463591 and 0.463584. Cumulative reservation is GBP 4.804294.
  The original spend is never reduced; the SQL GBP 5 cap remains the final admission
  limit. A second follow-up initialization fails rather than creating more allowance.
- Null/mismatched hashes, duplicates, changed plans, expiry and ambiguous commits fail
  closed. Unknown provider outcomes retain reservations and stop the campaign. No retry,
  refund, reset or new job is exposed to the runner. No transaction spans the API call.
- Model/tier/output bounds and exact payload hashes are checked before dispatch. Usage,
  synthetic output and latency are stored privately; logs contain fixed statuses only.
- Dependency installation disables lifecycle scripts; the staging pg-only lockfile is
  required before deployment. No customer/auth/billing repository is imported.
- Completion/failure disables the campaign; expiry independently blocks admission. The
  operator cleanup revokes role access, disables login and terminates existing sessions.
- The only build output is an inert page. Remove the temporary deployment afterward;
  keep the disabled database audit and private synthetic evidence. No publicly callable
  benchmark functionality survives the build.

## Validation and interpretation

`tests/benchmark-preview.test.mjs` runs with mock provider/ledger dependencies. The
operator `test` mode uses a separate disposable schema/role on the existing isolated
branch to exercise real PostgreSQL locking, rollback, null arguments, expiry and
permission checks. It never calls OpenAI or queries customer rows.

The offline `analyze.mjs` verifies source/payload identity, computes token-priced metrics
and creates randomized A/B files without model-variant identity or performance metadata.
Blind scoring uses five 0-4 dimensions per format: source fidelity, usefulness/platform
fit, useful originality, brand voice, and CTA compliance. This is a small model-assisted
editorial smoke review, not independent human research or a plagiarism certification.

Material regressions: candidate overall mean at least 1/20 lower; any brief mean at
least 2 lower; one format at least 3 lower in two briefs; or any new material fabrication,
qualification reversal, missing format or No CTA violation. Shared critical defects also
block release. Token-priced cost is usage-derived, not a verified provider invoice;
latency/cost belong to the whole pack, not independently measured formats.

`analyze-followup.mjs` keeps the original scores intact and exports corrected samples
for an explicitly unblinded defect recheck. All nine requests completed, but the
follow-up still failed factual grounding on the fictional class brief. This is a
NO-GO quality result, not authorization to keep spending or to reset the audit.

See `docs/ai-quality-evaluation.md` and the release report for actual results and cleanup
evidence. Scripts require the private isolated launcher and explicit operator modes;
they are deliberately not npm application/build commands.
