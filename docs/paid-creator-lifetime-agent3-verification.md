# Agent 3 verification — partial, sandbox not passed

Reviewed commit `ffcf049fbd164519676f89e7e1fc22b29dd34911` and the complete Agent 2 handover. No production configuration, payment settings, code, budget or entitlements were changed.

## Evidence gathered independently

- Re-ran 91 targeted tests: all passed. Re-ran TypeScript and ESLint: both passed.
- Re-ran `tests/paid-lifetime-postgres-isolated.mjs` against a freshly created and dropped database on a local PostgreSQL server: all eight compound checks passed. These use simulated Stripe data and a test-process-only allocation capacity override. They cover the actual migration runner, failure rollback, rerun, runtime grants, concurrent £99 allocation, idempotent reversals, checkout reconciliation and shared spending holds.
- Vercel `content-os` returned ready Preview deployment `dpl_13BL56WNNmFbkGzGdhg1K4T1QNcS` for the requested commit. The environment metadata endpoint returned 403; there was no installed Vercel CLI for the permitted fallback. Its Stripe key mode, database identity and isolation are therefore **unverified**. Do not trigger Preview payments or migrations until verified.
- The user-provided Stripe dashboard link visibly opens PIERNEXA Technologies LTD **test mode** and displays Stripe's no-real-transactions sandbox banner. This proves the dashboard is in test mode; it does not provide an API credential to this process. The connected Stripe tool lists only the live-mode account, so it was not used for payment operations. No real sandbox Checkout, webhook, refund or dispute event has been exercised.
- No new defect has been independently established by these checks; no application fix was committed in this stage.

## Test matrix still outstanding

All real Stripe £99/£149 payments, the 25th/26th and competing buyers, duplicate sessions, expired/failed/cancelled and delayed payments, authenticated signed webhooks, refund/dispute ordering, replays after reversal, and real Stripe payload/account/amount verification are **not run**. The local suite tests analogous paths with synthetic objects, not Stripe's actual responses or delivery semantics. Preview browser and API journeys are not run because isolation is not established. Full suite was not independently rerun; Agent 2 reported 463 passes, 10 baseline failures and 2 skips.

## Recommended policy — requires Nadine's approval

- **Partial refund:** quarantine pending a support review. Record the refund amount, reason, purchaser and intended commercial outcome. If it is an agreed goodwill adjustment and the business intends the customer to retain the lifetime product, an authorized operator may restore access only after independently confirming the payment's remaining captured balance, no full refund, no open/lost dispute, and the exact account and purchase. Otherwise keep access suspended or refund the remainder by the separately approved process. Preserve the audit trail and never change unrelated subscriptions.
- **Won dispute:** do not automatically reinstate. Once Stripe's independently retrieved final dispute outcome is won, confirm the underlying charge remains captured, has not been fully refunded, and no other open dispute or reversal exists. An authorized operator may then reinstate the same purchase with an auditable decision. A late webhook or success replay alone is insufficient. Define handling for an already repurchased account and ambiguous outcomes before implementing this flow.

These are recommendations, not approved terms or implemented capabilities. Existing code deliberately leaves such purchases in review/disputed state.

## Agent 4 handover / launch blockers

1. Connect the named restricted test credential to an approved local/sandbox execution environment without printing or committing it. Confirm Stripe account, key prefix/mode, restricted permissions and webhook secret safely. The test-mode browser alone is not API authorization.
2. Grant authorized access to inspect the Vercel Preview configuration, or supply independently verifiable environment metadata proving test Stripe credentials and a dedicated database. Do not bypass the 403. Confirm actual deployment environment before sending requests.
3. Run the full real Stripe matrix from the Agent 2 handover using synthetic accounts, a dedicated database and test-only isolated application configuration. Check records after each event and compare them to fresh Stripe reads. Keep all committed gates closed.
4. Resolve the separate recurring funding issue: the £30 global cap cannot cover even one maximum-size 50-generation monthly allowance (£34.030100) alongside existing users. Preserve 50/0 and all spending controls unless Nadine approves a viable plan. Re-review the cost-policy expiry on 19 November 2026.
5. Obtain explicit refund/reinstatement policy approval and independently validate reconciliation and support procedures. Perform independent review before any launch decision.

**Status: independent Stripe sandbox verification has not passed.**
