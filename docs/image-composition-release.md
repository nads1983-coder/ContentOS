# Image comparison composition

## Cause and scope

The existing Image Studio forwarded the original description and selected
appearance but had no comparison-planning step. Its default provider instruction
requested one clear focal point. There was no explicit requirement to give both
options visual prominence or keep an undecided choice open. This code-level gap
is verified; without the original provider trace we cannot establish the model's
internal reason for favouring Syria in the reported image.

## Correction

- A bounded, deterministic relationship planner recognises explicit alternatives,
  versus/vs comparisons, before/after transformations, stay/leave, this/that and
  pros/cons. It adds instructions to the existing image call, never another call.
- Preserve the entire relationship clause and shared subject instead of guessing
  boundaries inside proper names. The current model still interprets the nouns.
- Default to balanced paired composition and recognisable cues for both sides.
  Customer-specified layouts, ordering and emphasis take priority. Explicit
  exclusions or a request to show only one subject suppress inferred comparison.
- Colour/format/platform choices, incidental expressions, negative instructions
  and ordinary single-scene requests do not automatically trigger the planner.
- Both modern and legacy image prompt paths receive composition guidance. The
  selected type, palette, style, dimensions and text restrictions stay unchanged.
- Before/after visuals remain conceptual unless facts are supplied; alternatives
  do not imply a winner, confirmed move, endorsement or invented personal history.

## Original example evidence

Input: `Create a Syria or Canada Foodie Beauty graphic.`

Actual mocked route payload contains:

```text
Composition relationship: alternatives. Exact customer context: Create a Syria or Canada Foodie Beauty graphic
Default to a balanced two-panel or side-by-side composition with comparable visual area and detail for BOTH sides.
```

The same payload instructs preservation of the shared subject, recognisable cues
for each option, crop-safe placement and an open choice. Tests assert selected
illustration/graphic/photograph types, playful style and purple/white or custom
HEX palettes. The browser independently checks the exact original description
and selected purple/white/playful controls reaching the mocked provider.

Unchanged provider contract: pinned Flare model, one image, high quality, PNG,
existing source dimensions and export canvases. The complete added prompt passes
the existing financial quote calculation; no spending cap is bypassed.

## Executed verification

- Full application suite: 353 passed, zero failures/skips.
- Focused image suite: 39 passed; final planner regressions: five passed.
- Typecheck, ESLint, production build and diff checks passed.
- Dependency audit: zero reported vulnerabilities; no dependency changes.
- Mocked Image Studio browser: 1440, 768 and 390px, no page errors or horizontal
  overflow. Comparison request, four existing modes, editing, undo, device
  restoration, keyboard modal behaviour and account separation passed.
- PNG export dimensions verified: 1080x1080, 1536x864, 1080x1350, 1080x1920.
- Actual route mocks verify one provider dispatch and one successful usage event
  after duplicate replay, and commercial dispatch/settlement remain in place.
- Existing authentication, quota, uncertainty, subscription, Founder, owner and
  GBP30 spending-control tests are preserved in the full regression suite.
- Zero paid calls, no production access or mutation, no credentials added.

Browser artifacts: `/tmp/contentos-image-composition-browser`. They use a tiny
fixture PNG, not a real generated comparison. Temporary local fixture route was
removed before the production build. The development server was stopped.

## Limits and release recommendation

GO for founder review, not a live visual-quality certification. Mocked tests prove
request construction, routing and accounting, not that the image model renders
both destinations accurately or matches precise colours. Detection is bounded
English syntax, not universal semantic parsing: ambiguous, complex, very long or
multi-option briefs can retain the existing unplanned prompt path. Selected
Text-only mode remains free typography, not a paid image comparison.

No UI redesign, migration, environment, model, subscription, entitlement, quota,
firewall or billing changes. Production is unchanged. Merge/deployment requires
separate owner approval; rollback requires only the previous READY deployment.
