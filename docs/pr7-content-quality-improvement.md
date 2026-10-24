# PR7 content quality improvement

Date: 2026-10-24. Base: `abbcd1c668d0291e95870989d911ebebe97e2732`.
Scope: local prompt/output correction and offline tests only. No paid calls,
credentials, database changes, campaign changes, push or deployment.

## Findings and correction

The captured Instagram retest was readable but used generic community/family
language and inferred `#papercraft` from an ambiguous brand. The prompts encouraged
a broad premium/community voice, prescribed paragraph structures and minimum
hashtag counts. Those were plausible contributors, not proof of model causation.
There was no source-based hashtag filter at the delivery boundary.

- All 14 formats now have distinct writing guidance: specific supplied detail,
  natural rhythm, relevant endings and no padding of sparse briefs. Simple mode
  still produces one draft; advanced caption alternatives remain available.
- Hashtag counts are ceilings rather than quotas. No new input is required.
- Server-side cleanup permits source/offer/audience phrase tags, the exact brand
  tag and explicit requested tags. Brand names inside source text are removed
  from topic extraction so their constituent words cannot establish a niche.
  Generated prose cannot independently authorise tags.
- Current hashtag preferences override saved preferences; no-hashtag instructions
  and named exclusions are respected. Duplicate tags are removed without removing
  legitimate repetition across separate platform sets. URL fragments are retained.
- Three exact stock phrases have narrowly bounded cleanup, with explicit wording
  and inspirational preferences preserved. This is not a ban on words such as
  family or journey, nor a general prose rewriting system.
- Raw-output factual validation still runs before cleanup, and final validation
  runs after it. Unsupported high-risk facts cannot be hidden by deleting tags.
  Refinement uses the same guard. No retry, model, quota or cost policy changed.

## Captured evidence replay

`tests/fixtures/pr7-instagram-quality-retest.json` is the exact parsed synthetic
provider output from the previous retest, without provider/account identifiers.
It was compared with the original private provider audit; canonical JSON SHA256:
`2b17ad3e3c6da06b2dc081d114b61a8eb783581eb6764dc178fa5f827d9bd0e5`.
Original private evidence was not edited.

Offline replay preserves the 1,000-subscriber hook and giveaway, removes two stock
phrases and retains `#independentmakers`, `#northbankpaper`, `#1000subscribers`.
It omits `#papercraft` and other tags not grounded in supplied phrases/preferences.
Some generic family/community wording remains; it is not silently rewritten.
The original attic-story capture still fails before delivery or successful usage.

## Verification

- Focused factual, quality and actual mocked-route tests: 40 passed.
- Full `npm test`: 268 passed, zero failures/skips.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `git diff --check`: passed.
- Added 11 tests: exact capture replay, unsupported/confirmed niches, preference
  precedence, Unicode/compound/numeric tags, URL safety, deduplication, natural
  language/voice exceptions, all 14 formats, refinement and route persistence.
- Actual route with mocked provider and in-memory repository transitions saves
  cleaned content once, records one successful usage event and settles provider
  usage once. Duplicate replay calls neither provider nor financial settlement.
- Existing auth, account isolation, Founder/owner/subscription, image, quota,
  monthly spending and QA-gate tests remain passing. Their implementations were
  not changed. No live database or browser session was needed for this server-only
  change. Database/network concurrency was not re-proven by the in-memory tests.
- Existing Node module-type warnings and deliberately simulated workspace
  persistence warnings appeared during tests; no failing checks.

## Limits and next decision

This is conservative lexical hashtag filtering, not semantic verification. It can
omit valid synonyms not present in supplied phrases, and cannot infer whether an
arbitrary supplied phrase is negated, quoted or true. Explicit hashtag preferences
are selections, not verified business evidence. Untagged keyword lists rely on
prompt guidance. Existing factual pattern checks remain finite and can reject
valid factual paraphrases or miss novel unsupported assertions.

Offline replay proves the captured corrections and accounting behaviour, not
improved live-model originality, factual accuracy or platform quality. All 14
formats remain parseable; their new live writing quality has not been measured.

Recommend one separately authorised Instagram request using the unchanged
synthetic brief/brand and previous parameters, with independent comparison against
the preserved raw caption. Assess relevant opening, less formulaic prose, no
invented claims/terms, relevant hashtags and exactly-once saving. A fresh bounded
campaign, newly verified payload quote and separate paid approval would be required;
no old credential or sealed campaign may be reused. Do not repeat the six-test
campaign automatically.

**GO FOR FOUNDER REVIEW - CONTENT QUALITY IMPROVED (offline evidence only).**
PR7 remains unpushed/unmerged by this task; production remains unchanged.
