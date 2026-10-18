# Replacement acceptance runner: CLOSED

The single owner-approved replacement deployment was attempted and deleted after
failure. Candidate `b7e27e8aaf5fd0d15d643306e774b4bc5355ecd7` has unchanged
application code. Prepare/execute are permanently closed; no automatic retry.

Full logs now identify npm `EUSAGE`: the remote installer found package.json and
package-lock.json inconsistent, with pg@8.23.0 and its transitive entries missing.
It failed before build/runtime preflight or paid calls. All four prior records
(three paid calls and the zero-call failed Preview) remain immutable.

The replacement separated zero-provider build from operator-signed, SSO-protected
stage requests. Local signatures, actual packaged handler preflight and isolated
ledger tests passed. No hosted stage request occurred because installation failed.

After failure, the minimum packaging correction is prepared: include a fixed
generated runner lockfile, assert package/lock agreement, require npm ci locally,
retain the exact upload inputs and log their hashes on remote install. The new
installer passes locally. The original uploaded lockfile was not retained, so
the precise cause of the local/remote input difference is not established. Do not
claim the correction has passed remotely or that the deployment was READY.

The runtime permits only five initial batches plus seven fresh batches. The
atomic ledger starts at GBP0.792508 and enforces GBP2.28 new / GBP3.08 combined,
12 additional calls, no repeat generation/review keys, no automatic paid retry.
Each signed request binds one stage and an expiry; no OpenAI key is exported.

Cleanup revoked login/schema/functions, terminated sessions, disabled the ledger,
preserved audit/build logs and deleted the deployment. The temporary private
signing key, connection state and staging directory were removed. Synthetic
checkpoints/audit rows remain, not production customer data.

Evidence: `docs/benchmarks/acceptance-replacement-b7e-2026-10-18/REPORT.md`.
No production deployment, merge, further API budget or Founder retirement.
