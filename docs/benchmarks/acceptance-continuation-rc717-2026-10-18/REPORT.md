# Existing Acceptance Continuation: NO-GO

Exact application RC: `717b4dfb9f7fcd3257ac9c0750fbc9bcb74bffa8`.
Prior report: `286e935c34d2aba3c7318794511a019683a6e33f`.
Separate authorization: combined GBP3.08 / 15 calls, including the completed draft.

## Completed Work

Recovered the exact 307-unit, 14-format draft and checkpoint. Original manifest,
source-file hashes against the RC, module hashes, request payload, provider output,
checkpoint and published evidence were verified. A fresh read of isolated Neon
matched the original campaign, job and profile hashes. The original campaign was
not reopened or edited. No draft-generation call was made.

A fresh restricted continuation ledger retained the original GBP0.419173 as its
starting balance and stored its immutable origin link/snapshot. A new synthetic
profile received the exact checkpoint; only account identity and campaign marker
were rebound. Source, output, request ID, fingerprint, completed metric, USD usage
reservation and original timestamps were preserved. The original 45-minute
checkpoint deadline was not extended.

The seven full initial-review requests were 54,323 / 54,625 / 54,469 / 54,639 /
54,620 / 55,275 / 50,089 bytes, all under 56,000. Fourteen maximum-size review
reservations plus the prior reservation total **GBP3.073643**, within GBP3.08.
Transport and SQL prohibit draft calls and cap new calls at fourteen. No context
truncation, automatic paid retry or omitted unit was permitted.

## Live Outcome

The first review completed in **15.855 seconds** and returned all **48 assigned
decisions**. Server validation rejected one certificate, so the entire batch was
refused and the campaign stopped before a second review call.

| Measurement | Actual result |
| --- | --- |
| New / combined provider calls | 1 / 2 |
| New review tokens | 11,592 input; 1,316 output; 0 cached; 12,908 total |
| New API usage-priced cost | USD0.03871000 |
| Combined API usage-priced cost | USD0.10920525; GBP0.0818918068 at the verified reference rate |
| New / combined conservative reservations | GBP0.186377 / GBP0.605550 |
| Initial review returned / accepted | 48 / 0 of 307 units |
| Proposed / applied local repairs | 2 / 0 |
| Fresh revalidation | Not reached |
| Validated delivered packs | 0 |
| Final history entries / successful usage events | 0 / 0 |
| Provider uncertainty / paid retries | None / none |
| Independent final-14-asset assessment | Not reached; no final validated pack exists |

Costs are calculated from actual provider token receipts, not an invoice or tax
statement. Current GPT-5.2 pricing and ECB rates were rechecked before execution.
All reservations remain retained; no earlier paid work was repeated.

## Exact Material Blocker

Unit `u47`, in the Instagram body:

> The range includes 12 catalogue patterns (4 Arc, 8 Bond).

The model correctly classified it as supported by source `s7`:

> The new range has twelve catalogue patterns: four patterns belong to the Arc zip-cover range and eight belong to the Bond fixed-cover range.

Independent source review confirms this is a legitimate paraphrase, not a claim
about stock, sales, production capacity or another product feature.

`lib/claim-scope.ts`'s `object()` parser splits at the first comma, including the
comma inside parentheses. It therefore parses the claim as quantity **12** with
object **Arc**, rather than **12 catalogue patterns** with a separate **4/8**
breakdown. The source parses as object **pattern**. This generates
`relationship_scope`, surfaced as `missing_evidence`, and refuses the supported
certificate. Removing the parenthetical in a diagnostic probe removes the flag.
The original draft and captured decision were not edited.

The model also proposed two replacements for other units. They were not applied
because the batch failed validation. No claim is made that the rest of the pack
is factually safe or publication-ready.

Minimum correction: preserve the main quantified noun phrase while separately
assessing parenthetical breakdowns. Do not ignore parentheses, whitelist counts,
or exempt numeric claims. Valid and wrong-total/wrong-product breakdowns need
focused regression coverage. No application fix or further benchmark was initiated
under this failed-run instruction.

## Isolation, Persistence And Cleanup

The actual candidate resumed at review, not generation. Before any paid call, the
restricted role was verified unable to read auth/customer schemas or ledger tables
directly; cross-account writes and wrong campaign access were refused. The draft
and failed-review checkpoint are preserved. There is no successful-usage charge or
unvalidated final history entry. Successful final persistence/recovery remains
unverified, rather than being inferred from offline tests.

One protected Preview ran in the existing project. It reached READY; unauthenticated
access received a protected 302. Cleanup disabled the new ledger, revoked role
login/privileges, terminated sessions, verified revocation, exported the audit and
deleted the exact Preview with verified deletion. Temporary credential state and
staging directory were removed. Both audit records remain. A post-cleanup read
verified that the original campaign, job and profile are unchanged.

## Focused Checks

- Three local operator preflight tests passed: exact origin/bounds, forbidden
  generation and recovery into review with retained accounting on uncertainty.
- Eight isolated SQL checks passed: original evidence integrity, restricted
  permissions, two-connection atomic admission, no generation/cross-account
  writes, combined budget, total call limit, uncertainty closure and original
  campaign preservation. No paid calls were used in these tests.
- Three portable evidence tests passed: cumulative accounting, exact reproduction
  of the known false positive, and permanently closed execution entry points.
  Reproducing this defect is explicitly not a semantic-accuracy pass.
- Whitespace/diff checks passed. Existing application build/lint evidence is reused
  because application code was not changed. No broad historical benchmark repeated.

PR #3 remains draft. No production deployment, merge, customer-data mutation,
Stripe change or Founder retirement occurred. The public Founder offer was not
altered. Production preparation cannot be marked complete while this blocker remains.

**NO-GO — SPECIFIC MATERIAL BLOCKER**
