# Requested hashtag pipeline correction

Date: 2026-10-24. Base: `f7c322bfe69850b007c4933fb842b3b86f01a9c8` (PR #10).
Branch: `fix/hashtag-request-pipeline`. Review only; no deployment authorized.

## Evidence and root cause

The supplied brief is preserved verbatim: "Why are hashtags not working on my posts?"
The reported selection is LinkedIn plus Hashtags. The fixture's brand fields and raw
provider output are explicitly synthetic; the original production provider response was
not available. We cannot establish how many tags that particular model call returned.

The composer routes the additional format correctly as `platformHashtags`. The server
keeps that selection through normalization and its structured provider contract. The
defect was downstream of routing and also affected provider guidance:

1. The old conceptual filter discarded any clause containing `not`, including this
   question. It also lacked social-discovery concepts for this subject.
2. Literal phrase matching admitted `#Hashtags` because the word occurs in the brief.
3. A separate broad omission matcher confused some educational questions such as
   "Why should I avoid hashtags?" with instructions. The exact reported question did
   not itself trigger this omission matcher; it lost conceptual topic evidence.
4. Prompt guidance and filtering did not share candidates, and no completeness step
   repaired empty or generic-only explicitly requested sets.
5. Separate hashtag set labels appeared visually but were omitted from plain-text copy
   and export, losing their platform association.

An offline execution of the actual base `content-quality.ts`, using the exact brief and
the four proposed candidates, retained zero caption tags and retained `#Hashtags` as the
separate output. The candidate retains all four and produces a labelled LinkedIn set.
This proves a reproducible code defect, not a recovered raw production trace.

## Focused correction

- One shared policy interprets explicit omission requests, relevant source concepts,
  individual exclusions and request-scoped brand context for prompts and output checks.
- Questions about ineffective hashtags are subjects, not instructions to remove tags.
  Current explicit no-hashtag instructions win; selecting Hashtags overrides an older
  saved omission preference. Refinement instructions retain precedence.
- Source-supported social-discovery themes authorize platform-appropriate candidates.
  Platform selection alone, saved brand tags and unrelated offers do not authorize them.
  Format-label tags and meaningless standalone generic tags are rejected.
- A local, non-billable assembly pass repairs empty/generic-only requested caption tags
  and builds labelled separate platform sets from accepted candidates. Meaningful
  existing tags are retained without padding to a quota. Existing platform limits and
  explicit counts/layout preferences still apply.
- Unknown subjects without meaningful candidates receive a visible needs-confirmation
  placeholder in the requested set, not a fabricated set or `#Hashtags` success.
- Refinement preserves previous tags only when independently supported by the current
  source policy. It never treats an old unsupported tag as factual evidence.
- Raw publication safeguards remain before cleanup, final safeguards remain after it.
  No-CTA validation additionally runs before hashtag assembly so rebuilding a set cannot
  conceal forbidden CTA text. The full suite caught and verified this interaction.
- Copy/export now retain platform labels for separate sets. Captions still end with one
  plain-text hashtag group; display, clipboard, workspace and export share final content.
- No new provider calls, retries, UI, dependencies, migrations or production settings.

## Executed verification

- `npm test`: **332 passed, 0 failed, 0 skipped**. Includes auth/account isolation,
  subscription/Founder/owner protection, quotas, GBP30 spending controls, image contracts,
  factual fixtures, No CTA, reservation failure handling and replay.
- Seven new pipeline tests cover the exact brief, empty/generic-only outputs, prompt
  parity, unrelated brand/niche/promotional exclusions, explicit no tags, saved preferences,
  all six social platforms and all 14 formats, refinement, copy/save/restore/export.
- One new actual-route orchestration test uses mocked provider/database dependencies:
  one dispatch and settlement, one history/usage entry, final tags persisted, duplicate
  replay causes no additional provider call or financial dispatch.
- `TEST_HASHTAG_PIPELINE=1 node tests/post-format-browser.mjs`: **passed** at 1440, 768
  and 390 px. Actual composer selection and shared parsing/reservation/workspace logic;
  mocked API/storage. Real browser clipboard plus offline paste, labelled set copying,
  text formatter, edit/undo, refinement, Save all, TXT download, second-device restoration
  and account switching all passed. Two mocked generations, zero paid calls, zero page
  errors. Screenshots inspected; no horizontal overflow. Fixture route removed afterward.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: **passed**.
  Local server and build had configured credentials blanked; browser external requests
  were blocked. No live database writes or social-network publishing/paste were performed.

## Recommendation and limitations

Ready for owner review and controlled release approval. Do not automatically merge or
deploy. No migration or data repair is needed; rollback is the prior production deployment.

Concept recognition is bounded and deterministic, not universal semantic understanding.
Unrecognized synonyms can still be conservatively excluded. Missing topic information
can require confirmation rather than a forced quota. Existing historical drafts are not
rewritten. Offline/mocked verification does not prove live-model writing quality or actual
social-platform paste behaviour. Customer review remains required.

Production, customer records, subscriptions, Founder/owner entitlements, credentials,
firewall and the GBP30 spending cap were not changed. No paid AI calls were executed.
