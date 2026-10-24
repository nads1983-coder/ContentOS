# Failed-generation feedback release

## Confirmed cause and scope

The reported contentos.co request failed validation while Studio continued to
show a previously successful plan.com result from the same account. The retained
result was not clearly identified as earlier content. The inspected records did
not identify cross-account contamination. The rejected provider body was not
retained, so this change does not claim to diagnose its actual rejected sentence.

This is a presentation/recovery fix, not a subject-fidelity or AI prompt change.
No generation, parsing, factual-grounding, repository, quota, billing, spending,
image, or entitlement implementation is changed. No migration is required.

## Correction

- Keep a separate failure snapshot identifying the failed brief and refinement.
- Collapse earlier output after failure. No output copy/save/export controls are
  shown until the customer explicitly opens the earlier draft.
- Preserve earlier content and saved records. Label the retained result with its
  original brief and earlier-generation status; label its output actions too.
- Keep the failure notice visible when copying or editing an earlier draft.
- Offer a deliberate fresh attempt for known terminal errors, including factual
  rejection. Unknown delivery/save outcomes retain the existing request identity.
  No automatic retry is added; the UI explains that new requests may incur costs.
- Ignore generation responses from a previous account lifecycle, including an
  account A -> B -> A transition.
- Browser testing found a hydration race: autosave could write the old in-memory
  draft into the newly selected account's local storage before reset. Gate local
  and cloud autosave until the current account epoch is hydrated. This is an
  independently reproduced client race, not evidence of the production incident
  being cross-account contamination.

## Executed verification

- `npm test`: 343 passed, zero failed/skipped.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; fixture routes removed before production build.
- `git diff --check`: passed.
- New mocked browser test at 1440, 768 and 390 CSS pixels: success followed by
  rejection, separate failed/original briefs, preservation of saved content,
  hidden output actions, earlier-draft clipboard/edit/undo/export, deliberate
  retry, failed-request replay without dispatch, refinement rejection, account
  switching and ignored late responses. Zero page errors or horizontal overflow.
- Existing hashtag-allocation browser regression at the same three widths:
  caption/additional hashtags, actual clipboard, edit/undo, refinement,
  save/restore/export and account isolation all passed; zero page errors.
- Route-level regression executes the real route with mocked provider/database
  dependencies: rejected attempts settle provider accounting without successful
  usage/history, preserve previous records, and successful retry/replay is
  exactly once. Existing authentication, subscriptions, Founder/owner entitlement,
  request reservation and spending-control tests passed in the full suite.

Both browser tests use local synthetic in-memory accounts and block external
requests. They make no paid AI calls and do not access production credentials.
The exact reported latest prompt is tested; rejected output in the new sequence
is explicitly synthetic, alongside the existing captured factual-failure fixture.

## Limitations and release recommendation

Ready for owner review, not deployed. This fixes result attribution and recovery;
it does not prove live model quality or eliminate all factual errors. The failure
notice is session state; after reload, a retained result whose original brief
differs from the composer remains labelled as an earlier generation. Earlier
drafts remain customer-editable and exportable, not automatically revalidated.

Production customer records, subscriptions, Founder benefits, owner access,
firewall, environment and GBP30 spending cap are unchanged. No paid generation,
production writes, merge or deployment was performed. Deployment requires owner
approval; rollback is the previous production deployment because no schema or
data changes are required.
