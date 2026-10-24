# PR7 QA database isolation - 24 October 2026

## Root cause

The old test branch was created with parent data. Its ordinary `contentos_runtime` role has table-wide SELECT/UPDATE privileges on auth users and profiles, and those tables have no RLS. Application-level fixture filtering did not limit the credential's access to other rows. This was a real preflight failure, not a provider or billing issue.

## Implemented boundary

- Created empty `contentos_pr7_qa` on the EXISTING temporary branch. No new service, compute, production migration or customer-data copy.
- Seeded only the three previously approved synthetic fixture identities from private local fixture records, with their synthetic password hashes and minimal profiles. No historical sessions, content, customer records, billing tables, payment identifiers or production credentials were copied.
- Created `pr7_qa_synthetic_a/b/c` through SQL, not Neon's privileged role-creation API. They have no elevated attributes or memberships. Passwords expire after 24 hours. Private account-specific files are mode 0600 under a mode 0700 directory, outside Git and Next.js env discovery; strict TLS verification is pinned.
- Forced RLS on all seven account/campaign tables. A protected role/account registry and fixed-search-path security-definer lookup derive identity from `session_user`. Setting an account GUC, changing request IDs or passing another account cannot change the database identity.
- Auth user/account rows are read-only. Session and rate-limit mutation is account-scoped. Profiles can update only data/timestamp, with immutable ID/email and synthetic fixture constraints. Registration, verification, password mutation, unrelated tables and DDL are refused.
- Gate validates database name, role and host, then confirms actual session/database/account on each transaction. The old database/role are rejected even though the endpoint hostname is unchanged.
- The old database remains intact. Its PUBLIC CONNECT privilege was not changed: QA roles can establish a connection there but have zero readable application/auth tables and no application-schema usage. Actual forbidden SELECT checks returned permission errors. SQL access to copied records is denied, not merely filtered by application code.
- Production role metadata confirms none of the new QA role names exists in production. No production customer query or credential retrieval was performed.

## Verification

- Full mocked application suite: **246 passed**, network disabled.
- Actual Neon database isolation: **7 grouped checks passed**, covering all three credentials, forced RLS, account spoofing, cross-account reads/writes, legacy database denial, absent/denied unrelated data, workspace persistence/CAS and rollback.
- Actual Neon campaign gate: **11 grouped checks passed**, including concurrent instances, six successes/seventh refusal, immutable reservations, failure/uncertainty retention, restart replay, lost completion acknowledgement, audit protection and cross-credential campaign isolation.
- Actual Better Auth against the new database: **3 grouped checks passed**: valid own-account login, denial of another synthetic login even with the correct password, cross-account cookie rejection with the same signing secret, and scoped logout. Expected negative-login warnings contained no identity data. No mail sent.
- Typecheck, application lint, additional QA/test lint, production build and `git diff --check`: passed. A QA test's missing URL import was fixed before the final lint pass. First sandboxed DB attempts could not resolve DNS; authorised database-network runs passed with HTTP/provider access disabled.
- Owner-level aggregate inventory: exactly three users, three profiles, three synthetic credential records; zero non-fixture profiles or non-synthetic users. Historical database still has 58 profiles, 35 auth users, 12 mock-only campaign audits and zero live campaigns.
- No UI code changed; no new browser usability claim. Existing subscription, Founder/owner entitlement, image/text contract, quota and GBP30 controls are covered by the unchanged application tests.

## Setup cleanup completed

The Neon create-role connector ignored `no_login: true` and created three unwanted privileged roles (`pr7_qa_actor_a/b/c`). Their credentials were never installed in the local runner. They owned no QA data and were not used for QA execution. SQL attempts to remove their administrator membership or disable login were refused by Neon. After explicit owner approval, all three were deleted from the temporary branch. A fresh catalog check confirms zero such roles remain, with all three restricted synthetic roles still valid. No existing role was deleted.

A proposed broad CONNECT-privilege change on the legacy test database was rejected by the execution safety reviewer. It was NOT applied or bypassed. The implemented safer alternative changes no legacy grants and proves table/schema denial using the new nonprivileged roles.

## Reproduction and rollback

Only on the named temporary branch: create an EMPTY QA database, create nonprivileged roles with SQL, apply the existing auth/profile DDL from `drizzle/0000_lush_blue_blade.sql` excluding mail tables, then `scripts/qa/schema.sql` and `scripts/qa/isolation.sql`. Seed only the explicit local synthetic fixture inventory and role bindings as database owner. No dump/restore of the populated legacy database is permitted. Provision new role passwords privately; never use the copied runtime credential for execution.

Run with real provider and HTTP access blocked:

```sh
node --require ./scripts/qa/mock-network.cjs tests/qa-database-isolated.mjs
node --require ./scripts/qa/mock-network.cjs tests/qa-auth-isolated.mjs
node --require ./scripts/qa/mock-network.cjs tests/qa-campaign-isolated.mjs
```

Rollback is to stop the local QA process and revoke/disable only its three dedicated credentials, retaining database audit records. Do not restore access through the old runtime role. There is no production rollback because production was not changed.

## Remaining limitations and verdict

No paid execution has been approved or performed. No push, PR merge, deployment, firewall or production billing change. GBP2.68 remains an application reservation ceiling, not a guaranteed provider invoice cap. Unix file permissions do not isolate secrets from malicious processes running under the same OS user or privileged administrators. An operator must use only the dedicated configuration and guarded transport, recheck credential expiry and obtain separate paid approval.

The real live harness still requires the separately authorised transport wiring and six sealed request payloads; these mock/database checks do not prove live AI quality or live end-to-end generation.

Secret scan of 1,457 QA/test/documentation/build files found zero QA credential matches. Private credential files are outside the repository. The new roles expire at 2026-10-25T09:12:43Z; any later execution requires fresh explicit credential/expiry verification, not automatic renewal.

**GO FOR FOUNDER REVIEW OF SIX CONTROLLED LIVE TESTS.** Database isolation and non-billable regression checks pass; no paid execution is authorised by this result. Maximum planned six requests / GBP2.679021 reservations under the GBP2.68 application ceiling, with unchanged uncertainty and no-retry controls. Recheck API-key expiry, pricing and sealed payload bounds immediately before any separately approved execution.
