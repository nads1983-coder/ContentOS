# Grounded hashtag release evidence

Date: 25 October 2026. Base: `e7865f541ef1a3517a64f2fd170959d9ecc895a8`.
Scope: source-grounded hashtag candidates, filtering and allocation only.

## Root cause and pipeline

1. `buildStudioInput` supplies `hashtagPromptContext` and the original brief to
   the existing provider request. No additional provider call is introduced.
2. `parseGenerationOutput` applies `applyContentQuality`. Before this fix the
   hashtag policy relied on literal contiguous source tokens and a finite
   conceptual catalogue. `RoomLighting`, for example, was rejected against
   "coloured lights in my room" even though the caption could express that topic.
3. The allocator had no fallback for unfamiliar topics when model tags were
   absent. Its optional-set empty state incorrectly asked for a specific subject.
4. Allocation and final cleanup now share one source-grounded policy. Generated
   prose can propose topic phrases, but cannot introduce new substantive source
   vocabulary. Spelling, inflection and source-word compound variants survive.
5. Caption-first allocation remains independent of the optional set; extras
   exclude the union of caption tags. Existing platform caps, exclusions and
   explicit preferences remain authoritative.
6. Shared formatting/copy, workspace save/restore and TXT export preserve the
   final accepted tags. No evidence in these deterministic paths showed tags
   being lost in clipboard transport or persistence.

The room-lighting filter/fallback defect was reproduced locally. The YouTube
and hashtag-effectiveness examples already pass the current base's earlier
conceptual repairs under deterministic fixtures. No raw provider captures for
the owner's latest reports were supplied, so this work does not claim to prove
where those particular live A/B responses diverged. All three briefs are now
permanent allocation/formatting regressions.

## Focused correction

- New small lexical topic helper, not another topic-specific dictionary.
- Caption phrases are grounded in the original brief/refinement instructions;
  unknown generated nouns cannot authorize niches, promotions or business facts.
- Formatting directives, saved brand identity, partial proper names and domain
  fragments cannot supply the new fallback. A browser regression exposed and
  fixed the `plan.com` -> `#Plan` fallback edge case.
- Existing conceptual synonyms remain available. Source-word fallback only fills
  topics without an existing conceptual set or explicit curated tags.
- Removed the inaccurate missing-subject confirmation. Fewer alternatives or an
  honest empty additional set is preferable to irrelevant padding.
- No provider/model, API route, billing, quota, spending-ledger, entitlement,
  authentication, database-schema or production-configuration changes.

## Executed verification

| Check | Result |
| --- | --- |
| Full application suite, final code | 348 passed, 0 failed |
| Focused topic regression file | 5 passed, including all three reported briefs and unfamiliar subjects |
| Typecheck | Passed |
| ESLint | Passed |
| Production build | Passed, 51 static pages; temporary browser fixture absent |
| npm audit | 0 reported vulnerabilities |
| Room-lighting browser flow | Passed, 1440/768/390px, 0 page errors |
| YouTube browser flow | Passed, 1440/768/390px, 0 page errors |
| Failed-generation browser flow | Passed, 1440/768/390px, 0 page errors |
| Paid provider calls | 0 |

Browser flows use real Studio components and clipboard APIs with mocked network
responses and synthetic in-memory account storage. They verify independent
caption allocation, distinct extras, edits/undo, caption and additional-set
refinement, cloud-contract save/restore, TXT export and account switching.
Failure regression verifies previous content stays hidden/labeled, saved drafts
are unchanged, rejected output adds no successful usage, duplicate replay does
not dispatch, and late account responses are ignored. These are not live Neon
or provider tests. Existing authentication, billing/Founder/owner, image,
spending and quota regression tests are included in the 348-test suite.

See [actual mocked outputs](grounded-hashtag-samples.md). Private local browser
artifacts are under `/tmp/contentos-room-lighting-browser`,
`/tmp/contentos-youtube-browser` and `/tmp/contentos-failure-regression`.

## Remaining limitations and release recommendation

GO for owner review of this focused change; not deployed or merged. No migration
or environment changes are needed. After separate release approval, verify the
approved commit and preserve the previous READY production deployment for rollback.

Lexical grounding is deliberately conservative, not a semantic accuracy
guarantee. It does not infer every possible synonym or guarantee five additional
tags from an impoverished response. Example B's minimal mock provides four
supported caption tags and no unused alternatives. No tags are invented to
inflate that result. Unfamiliar proper names and complex phrasing may still yield
fewer suggestions. Customer review and existing factual protections remain in
place; this offline work does not prove live model quality or Instagram paste
behaviour beyond the verified exact clipboard text.

Production customer data, billing, firewall, subscriptions, Founder benefits,
owner Premium and the GBP30 spending cap were not accessed or modified.
