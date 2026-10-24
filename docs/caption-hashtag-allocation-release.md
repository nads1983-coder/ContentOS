# Caption hashtags and additional suggestions

## Scope and evidence

Based on main `3ae60bd7145f02c54e411af07ce45a385bb56203` (PR #11).
The supplied production screenshot shows the brief "Why I love youtube", with
Facebook, X/Twitter, LinkedIn and Hashtags selected. Captions show only #YouTube;
the separate section repeats #YouTube and includes #WhyILoveYouTube.
The requested regression also includes YouTube, so both selections are covered.

No original provider response was available. The fixture preserves the reported
source and hashtag symptoms, but its prose and provider-shaped response are
explicitly synthetic. It does not establish how many candidates the live model
originally emitted or discarded.

## Confirmed causes and correction

- Assembly returned immediately when a caption already contained one accepted
  tag. Completion was skipped without a hashtag request/additional selection.
  Captions now allocate independently and automatically, preserving accepted
  model candidates first, then prior refinement candidates and bounded,
  source-supported conceptual alternatives.
- The optional section reused caption pools as six labelled sets, with no
  exclusion of used caption tags. It now allocates one additional unique set
  after captions, excluding their combined tags. Selecting, removing or
  reordering the optional section cannot consume caption allocations.
- Facebook and YouTube capped at three. Both now allow five, as do LinkedIn,
  Instagram and TikTok. X retains its existing two-tag default. Explicit count,
  exclusion and no-hashtag preferences remain supported.
- Sparse YouTube-subject context had no useful deterministic alternative pool.
  Bounded video/discovery concepts now derive from the authorized source topic,
  not platform selection, generated prose or unrelated saved-brand fields.
- The platform-heading parser treated #YouTubeVideos as a YouTube heading and
  discarded preceding tags. Headings now require actual label boundaries and
  Markdown headings require whitespace after the hash marker.
- Caption tags are grouped below the post with a blank line. The optional set
  uses the same plain-text copy/export formatter. Refinement carries existing
  caption tags as exclusion-only context. Local edit/refinement merges remove
  any overlap from additional suggestions before saving, without removing tags
  from captions; undo preserves the previous pack.

The reported fixture now produces five caption tags per Facebook, LinkedIn and
YouTube post, and five other unique suggestions. Tags may overlap between
captions about the same subject; additional suggestions never overlap captions.
Insufficient source evidence yields fewer suggestions or a clear empty-set
message, never irrelevant padding. Prose is not rewritten by this allocation.

## Executed verification

- `npm test`: 339 passed, zero failed/skipped. Includes all application tests,
  authentication/account isolation, subscriptions, Founder/owner entitlements,
  image contracts, generation quotas, spending controls, request replay and
  exactly-once usage. The new route test runs the actual generation orchestration
  with mocked provider/database dependencies: one dispatch/settlement, one
  persisted result/usage event, and no dispatch or charge on duplicate replay.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `git diff --check`: passed.
- `tests/hashtag-allocation-browser.mjs`: passed at 1440, 768 and 390 pixels.
  Actual clipboard text, caption allocation, distinct extra set, editing/undo,
  caption and extra-set refinement, save, text export, restored saved-pack copy
  from a second browser context, and account switching passed. Zero page errors.
- `tests/post-format-browser.mjs`: passed separately with
  `TEST_HASHTAG_PIPELINE=1`, `TEST_HASHTAG_CONTEXT=1`, and
  `TEST_BRAND_CONTEXT=1`. Each checked desktop/tablet/mobile, real clipboard and
  offline paste, text formatter, save/restore, edit/undo/refine/export and account
  switching. Zero page errors. No unrelated brand or promotional tags survived.

Browser tests used localhost, synthetic accounts, mocked transport and the actual
workspace/reservation contracts. External browser requests were blocked. No
live database, customer session, paid generation or actual social-network
publishing was used. Screenshots and JSON reports are retained locally in
`/tmp/contentos-hashtag-allocation-browser`,
`/tmp/contentos-hashtag-pr11-regression`,
`/tmp/contentos-hashtag-pr10-regression`, and
`/tmp/contentos-hashtag-brand-regression`.

## Release recommendation and limits

Ready for owner review of a focused release. No merge or production deployment
is authorized by this task. No migration, environment change, dependency update,
new provider call, model change or additional generation charge is introduced.
Production billing, entitlements, customer data, firewall and the GBP30 monthly
spending controls are untouched.

Offline tests establish allocation and persistence behaviour, not future live
model quality or exhaustive semantic relevance. Hashtag concepts are bounded;
unknown/sparse topics may legitimately produce fewer than five tags. Manually
adding a caption tag already in the optional set removes that extra choice and
does not invent a replacement. Existing saved records are not bulk rewritten.
After separate deployment approval, verify the approved commit, READY rollback,
existing production safeguards and non-chargeable fixture/copy checks. Roll back
to the prior READY deployment if a critical regression is found; no data rollback
or billing change is required.
