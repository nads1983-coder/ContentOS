# PR #22 local Stripe sandbox verification — 10 November 2026

**NO-GO.** These tests used a temporary, loopback-only copy of the app with checkout, fulfillment, and the unfunded-lifetime allocation gate overridden in that copy. The tracked source and production offer switches were not changed. No OpenAI or email credentials were present. The £30 spending policy was not changed; this test does not establish that lifetime sales are funded.

The local runtime checked its database name, role, endpoint and restricted test-key prefix. Neon control-plane checks confirmed QA project `quiet-fog-56852665`, branch `br-hidden-recipe-b9yqeimn`, database `pr22_payments_qa`, is distinct from production project `long-hat-93822871`. The QA database was empty. The existing migration runner applied the recorded migrations after the existing externally managed `0003_commercial_spending.sql` prerequisite was applied explicitly; ten migrations were recorded. No production migration was run.

An official Stripe CLI test listener forwarded genuinely signed test events to the local app. Genuine Checkout payments and database outcomes:

| Scenario | Stripe test PaymentIntent | Observed QA result |
| --- | --- | --- |
| £99 lifetime | `pi_3Ua7Z7FnoS3uqGtr1uNjtl1u` | completed; slot 1; lifetime purchase entitlement present |
| £149 lifetime | `pi_3Ua7eTFnoS3uqGtr02cdnPph` | completed; no early-bird slot; lifetime purchase entitlement present |
| £5 / 25 credits | `pi_3Ua7aZFnoS3uqGtr0GcKsrN3` | paid; one 25-credit grant |
| £9 / 50 credits | `pi_3Ua7bgFnoS3uqGtr0YBIcwul` | paid; one 50-credit grant |
| £15 / 100 credits | `pi_3Ua7cZFnoS3uqGtr1NYurJyV` | paid; one 100-credit grant |

The £149 transition used 24 explicitly synthetic completed historical allocations in the QA database in addition to the genuine £99 test payment; it is not evidence of 25 genuine purchases. The lifetime entitlement records coexist with `plan: free` as designed.

A retrieved genuine test event `evt_1Ua7abFnoS3uqGtrl7L3q3me` was replayed locally with a locally generated signature; the webhook returned 200 and the three paid packages still had exactly three grant entries totalling 175 credits. This replay was not a second delivery by Stripe. Unpaid session `cs_test_a1taMAjvhrCRonEsLLqeDm4eLhP2Kk0fMbBRqpSDUpFjqFxgxUHV8TA9WE` was expired via Stripe and the signed event changed the corresponding QA purchase to expired with no grant.

Stripe's synchronous test-dispute card produced test dispute `du_1Ua7hnFnoS3uqGtrYOPbSjzl` on PaymentIntent `pi_3Ua7hkFnoS3uqGtr0oQuyE9y`. The QA purchase was reversed with dispute evidence and no grant. After Stripe accepted test winning evidence and reported the dispute won, the QA purchase remained reversed and had no grant, so it did not automatically reinstate. Administrator reinstatement was not verified.

The owner approved two protected Stripe test refund requests. Stripe reported successful full refund `re_3Ua7aZFnoS3uqGtr0NeSQZ8Z` for 500p and partial refund `re_3Ua7bgFnoS3uqGtr0Hju7525` for 100p. Their genuine test events are `evt_3Ua7aZFnoS3uqGtr02nDdLtL` and `evt_3Ua7bgFnoS3uqGtr0YZGa6vy`, respectively. **Refund processing has not passed:** after a local test-server restart failure, both QA purchase rows still showed paid and no reversal evidence. The local listener is stopped. A subsequent isolated run must retrieve or redeliver these exact events, verify full revocation and partial freeze, and reconcile before relying on these QA balances. This is an interrupted test, not proof of an application defect.

The local server could not be restarted for the synthetic administrator scenario; local source/Git and test processes also stalled during the final checks. Relevant automated tests, TypeScript and lint were attempted but did not finish in this pass. The last completed prior run reported 49 targeted tests, TypeScript and lint passing; do not treat that as verification of these live test transactions. Actual paid-subscription protection, administrator reinstatement, refund event processing, and deployment-specific Preview isolation and webhooks remain outstanding. Previously exposed credentials still require coordinated rotation.

The local listener was stopped and temporary credential and session files were removed. QA records, including the 24 synthetic historical allocations and interrupted refund cases, remain in the disposable QA database for follow-up; they must not be interpreted as real customers or production records.
