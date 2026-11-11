# Production text fallback maintenance — 11 November 2026

## Scope and evidence

Production source defaults an unset `OPENAI_MODEL` to GPT-5.2, but the existing
cost policy admits only GPT-4.1 and its pinned snapshot. It therefore rejects
an unset override before a provider request. The October operational record in
`financial-release-closure-2026-10-21.md` documents GPT-4.1 as the previously
verified production model; it does not establish the current deployment's
protected value or current provider-project access. README also named GPT-5.2.

This separate change proposes GPT-4.1 only as the fallback when the setting is
absent, and corrects the README example. An explicit setting remains unchanged;
an unsupported value still fails closed before reservation or dispatch. It does
not extend the policy expiry: draft PR #24 does that separately. No provider or
production settings were changed. In particular, this is not proof that the
current production override is absent or compatible.

OpenAI lists GPT-4.1 at $2 per million input tokens and $8 per million output
tokens. The current policy uses those rates with GBP 1.20 per USD contingency;
its maximum text reservation is GBP 0.547431 under the existing request envelope.
This does not increase the GBP 30 application ledger limit. Image provider
charges can exceed an application's estimate; the ledger is not a guaranteed
provider-billing cap. GPT-5.2 output costs $14 per million, so it must not be
admitted under the GPT-4.1 policy without a separately reviewed policy change.
OpenAI lists GPT-4.1 for shutdown on 14 January 2027, so a separately approved
migration is required before then.

Sources: https://developers.openai.com/api/docs/models/gpt-4.1,
https://developers.openai.com/api/docs/models/gpt-5.2 and
https://developers.openai.com/api/docs/deprecations.

## Verification

TypeScript and lint passed. The generation-route and pricing tests passed
(38 on this branch; 40 when exercised together with the exact PR #24 head).
Thirteen synthetic PostgreSQL scenarios passed on a disposable local server,
including missing funding, exhausted capacity, concurrent admission and
duplicate dispatch. The copied integration suite's historical "real Neon"
test label refers to its original target; this run used localhost and mocked
provider calls. The full suite reported 434 passed, 10 failed and 2 skipped;
the ten failures match the previously recorded main-branch content/hashtag
baseline. No production project-access or model-quality test was performed.

## Release gate and rollback

**Do not deploy solely on this change.** An authorised owner must verify, without
disclosing secrets, that the environment snapshot for the new deployment uses
an absent or policy-supported override and that its actual production OpenAI
project permits GPT-4.1. A historic ledger entry or an unassociated local key is
not proof. Confirm all other production environment settings and billing funding
are preserved for the new deployment, because deployment snapshots can differ.
Until these checks pass, text continuity and the safety of the combined release
remain unverified.

After those gates and explicit founder deployment approval, merge this change and
PR #24 into main for one reviewed production deployment, with the latest main and
both exact diffs checked together. Verify the resulting deployment and unchanged
budget configuration, then use authorised normal customer workflows to check
text, image and subscription access; monitor application spend and provider usage.
Retain the 12 December policy review. Do not add real customer charges merely
to verify billing.

Record the existing production deployment before deployment. If rollback is
needed, inspect intervening production changes and the selected deployment's
environment snapshot before promoting it. The original pricing policy expires
at 00:00 UTC on 19 November; rolling back to it after that time causes AI
requests to fail closed. Restore a reviewed policy-bearing deployment promptly
instead of bypassing budget checks, and never overwrite intervening changes.
