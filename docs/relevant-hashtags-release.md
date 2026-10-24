# Relevant hashtag correction

Date: 2026-10-24. Base production tree: `c7471f7247c587a2eb07a0ad7e77d955e867a83f`.
Branch: `fix/relevant-conceptual-hashtags`. Review only; no production deployment authorized.

## Root cause and pipeline

The provider receives the platform instructions from `prompts.ts` and `content-config.ts`.
`parseGenerationOutput` validates the structured response and publication safety, then
`applyContentQuality` filters tags before the result is committed to history and successful
usage. The UI, copy and TXT export use the shared output formatter; workspace saves preserve
the resulting section fields rather than choosing hashtags again.

The relevance filter primarily allowed contiguous one-to-four-word source phrases. It
therefore discarded useful conceptual tags whose exact spelling was absent from the brief.
The prompt reinforced literal source phrases and described counts as upper limits, with
inconsistent Instagram and Shorts defaults. This could also encourage under-generation.

An offline comparison against the actual base implementation used the synthetic brief
"Reflect on one year of consistent LinkedIn activity." and the four proposed tags:
`#LinkedInGrowth #Consistency #PersonalBranding #ProfessionalGrowth`.
The base filter retained zero; the candidate retains all four. The original production
provider response was not available, so this does not establish how many tags the model
originally returned in the reported one-tag incident. The reproduction proves a filter
defect, not a recovered live trace.

## Changes

- Bounded source-derived discovery themes and synonyms supplement literal phrase matching.
  Consistent professional posting can support personal branding/professional growth as
  topics, never as evidence of measured achievements. Platform selection alone, generated
  prose, saved style instructions and unrelated brand tokens cannot establish relevance.
- Current refinement subject instructions participate in the same filtering policy.
- Defaults: LinkedIn/Instagram/TikTok 3-5; Facebook 1-3; Shorts 2-3; X 0-2. Prompts prefer
  these ranges when useful; filtering caps excess tags but never fills a minimum quota.
  Recognized labelled hashtag/repurposing sets have independent platform caps.
- Explicit counts, individual exclusions, no-hashtag requests and deliberate line layout
  remain supported. Unrelated saved tag requests no longer disable editorial caps.
- Shorts body hashtags are moved into the existing final hashtag group by the shared
  formatter instead of being repeated in both description and final group.
- No extra provider calls, fallback generation or paid hashtag validation were introduced.
  No changes to prose cleanup, factual/publication safety, auth, billing, quotas, image
  generation, spending policy, dependencies or database schema.

## Executed verification

- `npm test`: 324 passed, zero failed/skipped. Includes all 14 formats, existing captured
  factual failures, brand isolation, account isolation, Founder/owner/subscription safeguards,
  quotas, GBP30 spending protection, image contracts and exactly-once request handling.
- New behavioural regressions: the LinkedIn themes; unrelated Gorl Lead/papercraft/promotion
  exclusions; source relationships vs generated or saved-only context; explicit preferences;
  refinement; all platform caps; no forced minimum; labelled sets; workspace/formatter/copy/
  export consistency; Shorts hashtag deduplication.
- `TEST_HASHTAG_CONTEXT=1 node tests/post-format-browser.mjs`: passed at 1440, 768 and 390 px.
  Actual UI with mocked API responses and actual workspace/reservation contracts verified
  all four tags through clipboard and offline paste, formatter, edit/undo, refinement, save,
  TXT download, second-device restoration and account switching. Zero page errors; two
  mocked generations, zero paid calls. Screenshots inspected. No actual social-network paste
  or live database mutation was performed.
- Typecheck, lint, production build and diff checks passed. The first sandboxed build failed
  because Turbopack could not bind a local port; a clean generated cache and permitted local
  build completed successfully without code/configuration workarounds. Build credentials
  were blanked. Browser non-loopback traffic was blocked and fixture routes removed.

## Release recommendation and limitations

Ready for owner review, not automatically merged or deployed. There is no migration.
Rollback is the previous production deployment with no data reversal required.

Theme recognition remains a bounded deterministic vocabulary, not universal semantic
understanding. Unrecognized synonyms can still be conservatively removed. Sparse source
material may legitimately yield fewer tags, and a one-tag provider response is not padded
automatically. Live model adherence/quality has not been retested; customer review remains
required. Existing stored content is not rewritten. Production customer data, subscriptions,
entitlements, credentials, firewall and the GBP30 spending cap were not modified.
