# Subject-scoped brand context and Image Studio platform correction

Date: 2026-10-24. Base: `1f9bd839137296c664d212980202b1dbe34af91e`.
Branch: `fix/subject-scoped-brand-context`. Review only; production approval required.

## Root causes

- Text prompts inserted every saved brand, audience and offer and instructed the model to use them. Saved offer wording was also treated as factual evidence without current-request authorization.
- Hashtag filtering automatically admitted the saved brand tag, offer/audience terms and saved hashtag instructions, even for an unrelated subject.
- Current and legacy image paths reused saved identity/audience automatically; the legacy prompt also passed saved commercial offers.
- The standalone Image Studio action hard-coded a LinkedIn section and did not initialize its platform from the selected content format. Saved designs did not retain their platform.

## Changes

- A shared, bounded request-scoping policy separates author identity from the current subject. Explicit brand references/requests opt identity in; explicit omissions and refinement overrides are respected. Merely identifying the author does not opt in promotion.
- Unrelated brand identity, industry/audience and offers are withheld from provider inputs. Ordinary voice and visual aesthetics remain usable. Saved promotional style instructions are filtered.
- Saved offer facts require explicit reuse in the current request; brand mention or Product CTA alone is insufficient. Uncertain facts and contradictory current instructions remain refused.
- Tags are grounded in the current subject and explicit current tag instructions. Saved tags cannot add an unrelated brand or promotion.
- All 14 formats and refinement use the same server-side output guard. Unrelated saved-brand prose is refused before successful persistence, not silently rewritten into a different factual claim. Confirmed promotional existence does not authorize prizes, deadlines or eligibility.
- Both image prompt paths scope saved context. Captions remain unchanged; image model, dimensions, quality and credits are unchanged.
- Standalone Image Studio initializes from the selected format, with General for ambiguous/non-image selections. Explicit platform overrides reach the request. New device-saved designs retain their platform; older designs without platform metadata show General rather than guessing LinkedIn.

## Evidence and executed verification

- `npm test`: 318 passed, 0 failed, 0 skipped. Includes authentication/account isolation, subscriptions, Founder and owner entitlements, quotas, shared spending controls, image routes, publication safety and duplicate replay.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: passed.
- New synthetic Codex/Gorl Lead regression: unrelated tag removal; unrelated brand/competition rejection; prompt context projection; saved preferences unchanged; explicit brand promotion; authorized saved facts; negative/uncertain terms; all 14 formats/all delivered fields; refinement; current and legacy image paths.
- Actual generation-route orchestration with mocked provider/storage: rejected brand contamination records provider spending but creates no successful usage/history; duplicate retry dispatches nothing. Accepted subject-only content persists and charges successful usage exactly once; replay makes no second provider call.
- Local `post-format-browser.mjs`, with `TEST_BRAND_CONTEXT=1`: Codex caption with saved Gorl Lead preferences, actual clipboard/offline paste, formatter, save, edit, undo, refinement, TXT export, second-device restoration and account switching passed at 1440/768/390 px. No page errors.
- Local `simple-creation-browser.mjs`: all 14 formats, legitimate explicit brand announcement, publication notices, edit/undo/refinement/export, failure recovery, cloud contract and account isolation passed at 1440/768/390 px. No page errors.
- Local `image-studio-browser.mjs`: Instagram selection initializes the header; Pinterest override reaches request and survives saved-design restoration. Four image modes, text-design edit/undo, keyboard modal, account-scoped restoration and four exact PNG dimensions passed at 1440/768/390 px. Three provider responses were mocked; zero paid calls.

The Codex fixture is explicitly a synthetic reconstruction of the reported defect, not an exact captured production response. Existing historical fixtures were not modified. Browser persistence used the actual workspace/reservation logic with synthetic in-memory storage; it was not a production or live-Neon test. All browser network traffic outside loopback was blocked and API responses were intercepted. The local server and build used blank configured credentials. Temporary fixture routes were removed before the build.

## Limitations and release decision

- No paid AI calls, fresh provider quality assessment, real Instagram paste, production mutation or live database writes were performed. Offline checks do not prove live-model creativity or universal factual accuracy.
- Brand relevance, style filtering and recognized-claim checks are bounded deterministic policies, not semantic fact-checking. Ambiguous requests can be conservative; normal customer review remains required. Unrecognized inventions remain a residual model risk.
- Explicitly supplying facts authorizes their use but does not independently verify their truth. Existing customer-review and confirmation notices remain intact.
- No billing, subscription, entitlement, authentication, firewall, environment, model or GBP30 spending-ledger implementation changed. No dependency/schema changes or migration are required.

Recommendation: ready for owner review and a separately authorized release. Do not merge or deploy automatically. Rollback is the previous production deployment/commit, with no database rollback needed. Old designs remain readable because added device metadata is optional.
