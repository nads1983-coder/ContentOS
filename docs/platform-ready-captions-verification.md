# Platform-ready captions: verification

24 October 2026. Branch `fix/platform-ready-captions`, based on production merge
`ba40a10205870f74ed38da436a3922a3639784a1`. No production release is authorized.

## Corrections

- A shared plain-text post normalization path removes paired Markdown emphasis,
  exact repeated sentences and duplicated CTA text. Distinct wording is not
  silently deleted using fuzzy semantic similarity. Existing deliberate line
  breaks and lists remain; only long, unformatted prose receives bounded
  sentence-based paragraph breaks.
- The social post preview renders the same caption string as copy/export.
  Hashtags are grouped by default, with an explicit separate-line preference
  retained through cloud serialization. Editorial tag limits are upper bounds,
  not quotas or claims about platform-enforced limits. Explicit requested counts
  take precedence, subject to the existing supported-tag checks.
- Short captions are no longer replaced by the source brief at display time.
  Literal URL fragments and C# identifiers survive hashtag handling. Text
  attached to a hashtag item is not discarded along with the tag.
- Generation instructions call for a specific hook, distinct useful paragraphs,
  one appropriate closing action, plain text and no invented details. Prompt
  instructions alone are not evidence of improved live model quality.
- Tentative saved context is not factual evidence. Recognizable promotion,
  entry-mechanic, discount and deadline assertions require supporting source
  facts. An explicit giveaway announcement supports existence only, not invented
  terms. Confirmed supplied facts and existing milestone paraphrases remain
  supported; current contradictions are rejected.

## Executed verification

| Check | Result |
| --- | --- |
| Application regression suite | 308 passing tests; mocked providers only. Includes authentication, billing, Founder/owner entitlements, quotas, uncertainty, replay, image contracts and shared spending controls. |
| New caption regressions | 8 tests covering exact clipboard text, spacing, Markdown removal, duplicates, lists, short captions, hashtag limits/layout, persistence and promotional grounding. |
| Final focused grounding/caption replay | 23 passing tests, including previously captured failures and positive supported wording. |
| Dedicated browser workflow | Passed actual clipboard read and keyboard paste into an offline textarea, formatter preview/copy/download, edit/undo, mocked refinement, save/restore, separate-device restoration, account switching and exactly-once successful usage. Two mocked generations. |
| Existing creation browser regression | Passed all 14 formats, advanced controls, four mocked generations, refinement, export, draft preservation and account-scoped save/restore. |
| Responsive UI | 1440, 768 and 390 pixel widths passed overflow checks. Full captions can be scrolled above mobile controls; clipboard strings match at every width. Screenshots inspected. No page exceptions. |
| Typecheck, ESLint, production build | Passed. Build contains 51 pages and excludes the temporary browser fixture. |
| Diff check | Passed. No dependency, migration, billing, entitlement or spending-ledger implementation changes. |

Browser artifacts are local under `/tmp/contentos-post-format/` and
`/tmp/contentos-post-format-full/`. Provider, payment, email and database
credentials were disabled in the local server; browser requests used synthetic
accounts, actual application contracts and mocked transport/storage. No real
database writes, provider requests or Stripe transactions were performed.

## Limits and release recommendation

The owner withdrew the originally mentioned example; synthetic formatting cases
and existing synthetic captured-response regressions were used instead.

Clipboard and offline paste preserve identical LF paragraph spacing. Instagram's
own composer/app was not accessed, so its platform-specific paste behavior is
not certified. Browser persistence used the real workspace contract with mocked
database storage, not a new live Neon test. The existing production data remains
unchanged.

No paid quality evaluation was run. Prompt improvements and exact-duplicate
removal do not guarantee originality, engaging prose or exhaustive factual
accuracy; differently worded repetition and unknown semantic inventions can
remain. Content remains a customer-reviewed draft with existing confirmation
notices, not independently fact-checked output.

**Recommendation: ready for owner review of the targeted formatting correction.**
Merge/deployment requires separate approval. Before claiming Instagram-specific
paste compatibility, manually paste the supplied plain-text test caption into
Instagram's composer without publishing. No paid AI test is necessary for that
check. Rollback is a code-only rollback; the optional hashtag-layout field needs
no database migration and does not change historical entitlements or spending.
