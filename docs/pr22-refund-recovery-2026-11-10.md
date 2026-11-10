# PR 22: interrupted refund verification recovery — 10 November 2026

## Repository and isolation

The original checkout reported a corrupt or truncated packfile and was left untouched, including its untracked report. A separate fresh checkout of `feat/paid-creator-lifetime-2026` at `1def995` passed `git fsck --no-reflogs --connectivity-only`. Dependencies installed in the fresh checkout. Earlier stalled work completed there; the cause of every earlier stall was not independently established.

Neon control-plane evidence identifies QA project `quiet-fog-56852665`, branch `br-hidden-recipe-b9yqeimn`, database `pr22_payments_qa` as separate from production project `long-hat-93822871`. This run verified the allowed QA endpoint and queried `current_database()` and `current_user` before exercising payment logic. The database already contained synthetic historical allocations and real test purchases. No production database was used or migrated.

## Genuine Stripe evidence and application reconciliation

The restricted key and the PaymentIntents were confirmed to be in Stripe test mode. Stripe directly reported both refunds as succeeded:

| Refund | Test PaymentIntent | Amount | Verified QA result |
| --- | --- | --- | --- |
| `re_3Ua7aZFnoS3uqGtr0NeSQZ8Z` | `pi_3Ua7aZFnoS3uqGtr0GcKsrN3` | £5 full | Purchase `f7b1fc65-5304-4759-ab10-c2398d51eb89`: 25 credits revoked, status `revoked` |
| `re_3Ua7bgFnoS3uqGtr0Hju7525` | `pi_3Ua7bgFnoS3uqGtr0YBIcwul` | £1 partial of £9 | Purchase `e5b66832-67d0-4997-85ab-4ccd896e77d0`: 50 credits frozen, status `reversed` |

Both began as paid with zero consumed and zero reserved credits. The application's actual reconciliation fulfillment function fetched and verified expanded Stripe Checkout and PaymentIntent data and recorded each reversal in QA. Running it twice left one grant and one reverse ledger entry per purchase. The full-refund evidence was `full_refund`; the partial was `refund:100`. The customer had other paid packages: aggregate available balance was 150 after the full refund and 100 after the partial freeze. This run does not establish behaviour when credits were consumed before a refund: neither affected purchase had any consumed credits.

The actual Stripe events `evt_3Ua7aZFnoS3uqGtr02nDdLtL` and `evt_3Ua7bgFnoS3uqGtr0YZGa6vy` were fetched from the test API and submitted twice each to the actual webhook handler using a temporary **locally generated** signing secret. Each invocation returned 200, and each event had one reversal record. This is genuine Stripe event data and application signature verification in a local harness, not a new Stripe-signed delivery or a deployed webhook test. The test harness enabled top-up fulfillment only in its dependency injection; tracked sales and fulfillment settings remain disabled.

## Administrator and subscriptions

Stripe directly reported test dispute `du_1Ua7hnFnoS3uqGtrYOPbSjzl` as `won`. The actual review service denied a simulated non-admin and accepted a simulated admin approval for QA purchase `481edd20-703b-4a56-b5c6-41e15f8dc23d`. The database contains the synthetic administrator identity, reason, timestamp and decision `2dd04b8d-734d-4468-b11a-03b0beefd413`. Subsequent reconciliation with current Stripe dispute evidence returned `replay`, retaining the paid status and 25 credits. The harness injected admin identity/authorisation: this is not proof of a real administrator login or deployed authorisation. Automated tests separately cover route authorisation and CSRF.

Subscription and lifetime protection passed automated tests with synthetic fixtures. This run did not create or test a real Stripe subscription or verify a deployed subscription flow.

## Checks and outstanding work

- 42 targeted top-up and lifetime tests passed; 60 subscription and billing tests passed. TypeScript and lint passed.
- Full suite: 504 passed, 10 failed, 2 skipped. The 10 content-generation/hashtag failures were previously documented as reproducing on production; no application code changed in this recovery.
- The QA PostgreSQL checks above exercised actual persisted purchase, reversal, ledger and adjudication state. The standalone disposable-local PostgreSQL migration/concurrency suite was not run: no local PostgreSQL server was found and the Docker daemon was unavailable. Previous migration results are in `pr22-local-stripe-sandbox-2026-11-10.md`, not new execution here.
- Signed Stripe CLI delivery and five genuine test-mode purchases were recorded in the previous report; this recovery did not re-run those purchases. Refunds were verified via real Stripe reads and local application processing, not a live webhook delivery in this run.
- Still required: consumed-credit refund scenario, authenticated administrator end-to-end test, real subscription protection, local PostgreSQL migration/concurrency suite, deployment-specific Preview isolation and signed webhook verification, scheduler and alert delivery, coordinated rotation of previously exposed credentials, and the outstanding AI quality/funding decisions. No assertion is made that all Stripe scenarios or launch requirements have passed.

**NO-GO.** Keep customer-facing lifetime and top-up sales disabled. Preserve the £30 budget, existing subscriptions and production model routing.
