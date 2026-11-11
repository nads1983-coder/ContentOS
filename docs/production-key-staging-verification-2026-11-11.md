# Protected production staging verification — 11 November 2026

The customer-facing domain remained on deployment `dpl_2pFutFE74y4wwza577juvxxCsEAA`.
The combined candidate plus a temporary verifier was deployed as
`dpl_BYmRKaC67GHt9besiG11DQoahqS1`, commit
`57cf0e8fdd1efab75e3e81a9ee0870cc71621f14`, with domain assignment skipped.
Vercel reported authentication protection; an anonymous request redirected to
Vercel sign-in. Both the customer domain and normal project alias remained on
the original deployment. A deployment-scoped five-minute access link was used
and revoked. The unaliased test deployment was removed; its diagnostic URL
subsequently returned 404. The temporary verifier is not included in this branch.

The verifier compared a one-way proof of the Production-only credential against
the locally verified replacement and checked the effective text and image model
configuration. It returned PASS for credential, GPT-4.1 and pinned Flare. The
two actual provider calls were reserved, dispatched and settled through the
existing shared ledger. The synthetic-only retained audit rows total GBP 0.063359
(text: 10 input and 3 output tokens, GBP 0.000053; image: 15 input and 1,756
output tokens, GBP 0.063306). No existing customer profile was accessed by the
verifier; the ledger necessarily checked aggregate funded capacity. A synthetic
profile and its accounting rows remain in the production database for audit.

The project environment metadata still showed the existing shared
`OPENAI_API_KEY` bound to Production and Preview and the dedicated
`OPENAI_API_KEY_1` bound to Production. This branch selects the latter only for
Production and fails closed when it is missing. Other environments keep the
existing binding. Preview secret values are write-only; their values were not
read or compared. No Stripe or subscription configuration was changed.

The staged candidate passed 64 route/pricing tests, four verifier security and
replay tests, TypeScript and lint. A separate clean release build must be
reviewed without the temporary verifier and must not be promoted without final
founder approval. Verify current billing credit and production configuration
again before release. The OpenAI project limit is subject to delayed enforcement;
the GBP 30 application ledger is not an unconditional provider-billing cap.

Before rollback, check intervening changes and the target deployment snapshot.
The original deployment's pricing policy expires at 00:00 UTC on 19 November;
promoting it after then would fail closed. Preserve the previous credential.
