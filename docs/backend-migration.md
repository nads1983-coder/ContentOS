# ContentOS backend operation and rollback

The application now uses Better Auth 1.7.4, Drizzle and Postgres in the existing Vercel Node.js runtime. Neon Free project `long-hat-93822871` hosts the `contentos` database in Frankfurt. Production branch: `br-broad-sea-b29qogmq`; isolated preview branch: `br-withered-dream-b2ht91ka`.

## Preserved data and account transition

An offline, private snapshot preserved 11 Appwrite account IDs and 17 application profiles, including all serialized content and usage records, six Founder profiles and one manual lifetime Studio entitlement. Two blocked source accounts remain blocked. Six profiles without an existing account remain reserved, preventing a new signup from claiming their data. Every original application field was compared exactly against the imported Postgres JSONB data. The source was compared again after cutover.

Password hashes were not exported. Existing members use the normal reset-password flow once to create a new scrypt credential after proving email ownership. This retains their ID, profile and entitlement. New registrations must verify email. Disabled accounts cannot receive auth mail or create/use an application session.

The original Appwrite project `6a2a6be900011401e963` has not been deleted. It is a historical source, not a live replica. Never overwrite the new database with the old snapshot after users have claimed accounts or saved new work.

## Security and operation

`contentos_auth` stores users, credential accounts, revocable sessions, hashed reset-token identifiers and database rate limits. `contentos_app` stores profiles, email delivery records and email budgets. Neither schema is exposed through a browser database API or grants access to PUBLIC. Runtime role `contentos_runtime` has no ownership, schema-creation, role-management, replication or RLS-bypass privileges. It cannot delete application profiles. Database access uses TLS certificate verification.

Application data access uses the authenticated user ID, never a client-supplied ID or editable metadata. Cookie-authenticated writes check the exact application origin; authentication routes also retain Better Auth's own CSRF protections. Passwords use Better Auth's scrypt hashing. Cookies are Secure, HttpOnly and SameSite=Lax; sessions expire in 30 days and are revoked on reset/logout. Reset links expire in 30 minutes and cannot be reused. Server logs omit passwords, reset tokens and database credentials.

Email work is registered with Better Auth's after-transaction hook, so rolled-back signups do not send mail and new-account visibility cannot race delivery. Vercel `waitUntil` retains the background task. Delivery status is recorded without tokens. The existing Resend service sends verification/reset mail and one deduplicated owner notification per new account. All share a hard application allowance of 100 emails/day and 3,000/month.

There is no scheduler, fake traffic, project-activity write, new monitoring service or manual console-login requirement. Neon compute scales to zero and automatically resumes for actual database work. An idle test endpoint was confirmed to wake through a normal Postgres connection in 1.352 seconds.

## Costs and limits

No new subscription or paid product was introduced. Neon is on Free, with 0.5 GB storage, 100 CU-hours/month and 5 GB public transfer per project. Compute is capped at 0.25 CU. Free compute sleeps after five minutes idle; the next connection wakes it. Quota exhaustion can suspend service until quota resets; free service does not promise unlimited capacity or an uptime SLA. The plan is not a time-limited trial.

Existing Vercel Pro and Resend Pro subscriptions are unchanged. Vercel showed $0.54 of its existing $20 infrastructure credit consumed when checked on September 12, 2026; the credit covered those usage charges. Resend's existing 50,000-email plan had transactional pay-as-you-go disabled. The migration adds no subscription cost and fits the current allowances. Higher future traffic or other projects exhausting shared Vercel credit can create overages under the existing Pro agreement. Billing settings were not changed.

References: [Neon pricing](https://neon.com/pricing), [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero), [Vercel Pro credit](https://vercel.com/docs/plans/pro-plan), [Vercel function usage](https://vercel.com/docs/functions/usage-and-pricing), [Resend pricing](https://resend.com/pricing).

## Recovery

Prefer rolling back application code while retaining Postgres. The verified production deployment `content-3w0plkgn2-nads1983-9570s-projects.vercel.app` (`dpl_6D9DEWhuCFLzYk9DTsTJtAStWufv`, commit `21a4943`) already uses the replacement database and corrected email transaction handling. Its immutable environment contains the required backend selection and credentials. Promote it with the authenticated Vercel CLI if the later cleanup deployment regresses, then fix forward. Existing sessions and new data remain in Postgres.

The last pre-migration Appwrite production deployment was `content-gfviue1zx-nads1983-9570s-projects.vercel.app` (`dpl_FCQBYmAUKAT6Q1CdNPkLF8HWaHbD`, commit `d7dc9b7`). Do not blindly promote it: it has no post-cutover users, passwords or data. Returning to it would require reconciling all post-cutover changes and a planned transition. No source project or production data has been deleted.

Private source snapshots and owner URLs are outside the repository. They must never be committed or served over HTTP. `import-legacy-profiles.mjs` validates snapshots and refuses to overwrite accounts that already have credential records. Use `verify` mode for comparisons; do not rerun `apply` against a live migrated database.
