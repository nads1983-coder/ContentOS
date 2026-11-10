# PR 22 credential remediation — 10 November 2026

**SECURITY-NOT-READY.** The inventory and replacement checks below do not establish that all consumers are known. The compromised credentials must not be treated as safe merely because a replacement exists.

## Credential status and dependencies

| Credential | Status and evidence | Consumer evidence and remaining uncertainty |
| --- | --- | --- |
| Stripe standard **test** secret, key metadata ID `mk_1TZVw1FnoS3uqGtrMxleYKzB` | Exposed, still present; not revoked | Stripe test request logs include reads of charges, events and webhook endpoints. Caller identities and all integrations are not conclusively identified. |
| Unnamed restricted test key `mk_1TZVvqFnoS3uqGtrKOybQpyt` | Exposed, still present; not revoked | No rows were visible in the selected request-log view. This is not proof of no consumer. |
| `GetContentOS lifetime QA – ChatGPT – Nov 2026`, key ID `mk_1UZbrvFnoS3uqGtrQ0Ilhs7w` | Exposed, still present; not revoked | Test request logs include prior Checkout and webhook-endpoint operations; the old test webhook was previously disabled. Other consumers remain unknown. |
| `GetContentOS PR22 isolated sandbox QA – Nov 2026`, key ID `mk_1UZzKgFnoS3uqGtrtwIlHtVo` | Exposed, still present; not revoked | Prior local QA tests used it. The account owner previously reported saving it as the branch-specific Preview `STRIPE_SECRET_KEY`; metadata confirms the variable and scope, but the current deployed value and all consumers are not independently proven. |
| Pre-existing `content-os` Vercel automation bypass | Exposed, still present and designated as a system environment variable | Dashboard metadata says it is available to all deployments and was added 12 September. External consumers are not inventoried; revocation may interrupt protected deployment access. No tracked source reference proves usage or non-usage. |

The Vercel dashboard shows `STRIPE_SECRET_KEY` entries for PR22 Preview, two other Preview branches, and a shared Production/Preview entry. The values were not revealed; these scopes do not establish which credential any entry contains. The connected Vercel integration previously returned 403 for environment-variable operations. Production and Preview runtime identity remain unverified in this remediation pass. GitHub reports no repository-level Actions secrets or secrets in its named Preview and Production environments; this does not inventory external CI, organisation settings or other secret stores. Stripe test request logs were inspected by key metadata only and are not a complete consumer or incident audit.

## Replacement prepared

With account-owner approval, Stripe test-mode restricted key **GetContentOS PR22 Preview replacement – Nov 2026** was created, metadata ID `mk_1UaJUGFnoS3uqGtrEzlZw1VA`. Its configured permissions are Checkout Sessions and Subscriptions write; Customers, Payment Intents, Payment Disputes and Prices read. It has no live-mode access. Test API reads of the synthetic customer, subscription, price, PaymentIntent, Checkout Session and disputes returned 200; event and webhook-endpoint reads returned 403. An empty refund request returned 400 before a permission conclusion could be drawn, so refund-write denial was not independently proven. No real refund was attempted.

The PR-only Vercel `STRIPE_SECRET_KEY` editor was prepared. **Migration, deployment, runtime verification and revocation have not been completed.** Computer-use security requires account-owner entry and submission of a changed authentication credential; do not paste credentials into chat. After entry, use an authorised Preview deployment and the authenticated isolation diagnostic to establish the expected QA database and test-key identity before relying on it. The diagnostic bearer is not currently held by this session and Vercel Authentication protects the deployment, so those access prerequisites must also be resolved without a project-wide bypass or broad token. Verify subscription and checkout integration paths before considering revocation of the old key. The replacement was scoped for the Preview runtime, not the old key's local Stripe CLI listener, refund administration or webhook-management duties; those require separately scoped consumers and migration.

The local checkout's `git log --all -p` text-history scan found no exact matches for fingerprints of the four exposed Stripe test secret keys and no long Stripe-key or webhook-secret-shaped strings. A repeat scan found no exact match for the replacement key. This is a text-patch scan of locally available refs, not a guarantee about unreachable Git objects, binary files, external systems or the Vercel bypass value. No new credential value was written to Git, logs or this report.

## Required decisions and completion

1. Complete the protected PR Preview credential-entry handoff and independently re-establish Preview access and runtime isolation; verify replacement integration paths.
2. Identify or coordinate owners of the standard test key, unnamed restricted test key and older QA key. Supply replacement credentials and recovery procedures for each known consumer; obtain an explicit approved interruption plan if unknown dependencies cannot be eliminated.
3. Inventory automation consumers of the project-wide Vercel bypass, design an approved replacement and rollback, then migrate and verify those consumers. Do not assume the absence of tracked references means it is unused.
4. Only after migration and verification, or an explicit approved interruption/recovery plan, revoke each exposed credential and verify it is rejected. The compromised test keys and bypass remain an active security risk until then. Avoid changing unrelated live Stripe credentials or production services.

No credential was revoked in this pass. Customer-facing sales remain disabled; no production migration, production deployment, live Stripe change or budget change was performed.
