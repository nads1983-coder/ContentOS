# Final Live Acceptance: NO-GO

Application candidate: `717b4dfb9f7fcd3257ac9c0750fbc9bcb74bffa8`, PR #3.
One authorized campaign, GBP2.70 and 13 paid calls maximum. No production changes.

## Result

Generation completed in **61.253 seconds**, producing all **14 formats** and
**307 required review units**. The campaign stopped at `coverage_budget` before
the first review call. The fixed candidate reviews 48 units per batch: this pack
needs seven initial batches, and seven fresh batches if correction is necessary.
One draft plus both complete passes would require **15 calls**, exceeding the
authorized 13. The campaign's pre-reserved envelope allowed six batches per pass
(288 units); it correctly refused to skip units, shorten context or spend beyond
that envelope.

This is a **campaign capacity mismatch**, not a timeout, invalid model certificate
or demonstrated application inability to review 307 units. The application's
unchanged limit is 23 calls. Eight total calls would suffice if all initial review
decisions passed without correction, but that outcome cannot be assumed in advance.
The new draft is not fact-checked or suitable for delivery yet.

## Actual Spend And Coverage

| Measurement | Result |
| --- | --- |
| Paid calls | 1; known successful provider response; no uncertainty |
| Tokens | 4,275 input, 4,501 output, 0 cached; 8,776 total |
| Usage-priced API cost | USD0.07049525; GBP0.0528636068 at the verified ECB reference |
| Conservative nonrefundable reservation | GBP0.419173 |
| Preflight maximum 13-call envelope | GBP2.698945 |
| Actual draft payload | 21,656 serialized UTF-8 bytes, full source retained |
| Initial accepted factual coverage | 0 / 307; no review requested |
| Corrections / fresh revalidation | Not run |
| Validated delivered packs | 0 |
| History entries / successful usage charges | 0 / 0 |
| Draft | Preserved in isolated checkpoint and exported evidence |
| Independent final-content assessment | Not run: no validated final output exists |

GBP cost is a usage-priced estimate, not a provider invoice or tax statement.
Reservations use GBP1.10/USD, about 46.69% above the verified reference, without
cached discounts; the exact candidate's USD admission padding remains separate.
Failed or uncertain calls would retain their entire reservation. No paid retry,
second campaign, shortened input or incomplete delivery occurred.

Read-only serialization after the stop measured seven full initial-review bodies:
54,323 / 54,625 / 54,469 / 54,639 / 54,620 / 55,275 / 50,089 bytes. All fit the
56,000-byte cap. The immediate blocker was **number of review batches**, not bytes.
No model review was simulated or presented as a live semantic pass.

## Safety And Execution

Rechecked exact local and remote PR head, draft status, existing Preview key
metadata and Vercel SSO protection before execution. No key was exported. Fresh
atomic ledger on the existing isolated branch; signed exact-RC modules, restricted
expiring role, bound synthetic profile and no public execution endpoint. Independent
review caught a one-micro-pound floating-point receipt edge case; rational arithmetic
and its boundary test corrected it before the paid call.

On resumption, private execution directories and the new campaign schema were
confirmed absent: no earlier call was restarted. Later execution used one Preview
only. The artifact reached READY and unauthenticated access returned a protected
302. After the stop, the ledger was disabled, role login/privileges revoked, sessions
terminated and revocation verified. The exact temporary Preview was deleted and
deletion verified. Audit remains; temporary credential state was removed. Prior
campaign ledgers and captures were not overwritten.

## Focused Validation

Nine local runner tests pass, including real frozen transitions with fixture-only
provider responses, bounded correction/fresh review, exactly-once save, checkpoint
recovery, currency arithmetic, signed policy, uncertainty, isolation, closure and
the new 307-unit captured-stop regression. These are not live semantic evidence.

Ten real isolated SQL checks pass: restricted privileges, two-connection atomic
admission, stage binding, unknown-outcome reservation retention/rollback, account
binding, fixture-only 13-call delivery/recovery, closed campaign, money ceiling,
call ceiling and expiry. Disposable test rows/schema/role were cleaned up. Previous
application release checks are reused because no application source changed.

Live final persistence/recovery/usage success is **not verified**: only the preserved
draft and absence of an erroneous successful-usage charge are established here.

## Minimum Next Action

Preserve and resume this exact draft in any separately authorized continuation;
do not purchase draft generation again. Before another dispatch, reconcile the
continuation's call/reservation envelope with its seven initial and up to seven
fresh batches. Do not modify the product's batch size merely to fit this one sample
or silently carry the old authorization into another deployment. A new execution
authorization would be needed; no continuation has been initiated or approved here.

No factual-quality pass, production-readiness pass, merge, production deployment,
customer change, Stripe action or Founder retirement is claimed. PR #3 stays draft.
The public Founder offer has not been altered.

**NO-GO — SPECIFIC BLOCKER REMAINS.**
