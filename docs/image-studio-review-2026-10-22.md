# Brand-aligned Image Studio: production review candidate

## Scope

Based on released main `81f8bfeb7f1b94d16f14030e2ce9d782bf60851c`.
Feature branch: `feat/brand-aligned-image-studio`. Production is unchanged.
No database migration, new dependency, service, production credential change, billing change or paid AI call. Review-only synthetic accounts and a Preview-only session-signing secret use existing isolated infrastructure.

- Auto selects typography, imagery or mixed composition using bounded local rules.
- Image creates full-frame imagery without a mandatory caption/branding overlay.
- Text uses the deterministic renderer without quoting, reserving or dispatching provider spending. It does not consume successful-image credits, including when those credits are exhausted. Existing Pro Studio eligibility, attempt-rate and concurrency controls still apply.
- Text + Image uses one existing image request and a solid, contrasting deterministic text panel.
- Original creative instructions or supplied content can start a design without generating a content pack first.
- Existing post-to-image actions retain the caption and its hashtags unchanged.
- Brand name, audience and writing preferences come from the existing Studio context. Industry, palette and visual direction are available in the image panel. Explicit palette/direction and `Headline:`, `Supporting text:` and `Brand:` instructions override inferred defaults.
- Headline/support copy is bounded; source paragraphs, metadata labels and hashtag blocks are not pasted into footers. Missing brand names do not create an invented logo or brand.
- Headline, support text, palette, alignment and font edits, undo and PNG export are local and make no generation request.

## Persistence and compatibility

The existing account-locked server reservation ledger still retains bounded replay results, now with an optional design recipe. Omitted new request fields stay omitted in normalization so old request fingerprints remain compatible. New fields are covered by the request fingerprint.

Edited/recent designs are saved **on this device**, account-scoped in IndexedDB, bounded to eight designs and 10 MB. Writes are ordered. Other accounts cannot see them through the Studio. These image edits are **not a new cloud image library** and do not sync across devices. Download PNG for long-term retention. Existing cloud text drafts/history are unchanged. Original server replay retention remains 24 hours and its existing byte/count limits.

## Spending and customer protections

Unchanged model selection: existing environment setting, default pinned `gpt-image-2.5-flare-2026-09-08`. Unchanged high quality, one-image request, provider sizes and output canvas sizes. The existing payload-aware cost quote and atomic commercial ledger wrap every paid image dispatch. No additional briefing/model calls or automatic paid retries.

The GBP30 monthly application ceiling, GBP20/25 private warnings, uncertainty holds, subscriptions, pricing, retired Founder promotion, existing Founder benefits, complimentary owner entitlement and text-generation engine are untouched. The application ceiling is not a project-wide OpenAI spending guarantee.

Text rendering and local edits cost GBP0 in provider usage. Image/mixed modes use at most one provider call per explicit admitted attempt, with the existing policy's payload-dependent reservation and usage settlement. This change does not lower the financial bound or release uncertain spending. Image-only failure returns an error, not a blank image. A mixed-mode provider failure can return a clearly warned free text fallback.

## Executed verification

- `npm test`: **227 passed**, including account/session isolation, billing/Founder/owner protections, image quota/races/replay/failures and commercial-cost tests.
- Final targeted image/client/route suite: **40 passed**, including readable gateway rejections that preserve recovery request IDs.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; no test fixture route in the production build.
- `git diff --check`: passed.
- `npm audit --omit=dev`: **0 production advisories**. Existing development-tool advisories were not changed by this dependency-free feature.
- Local browser checks: **1440, 768 and 390 px**, four modes, edit/apply/undo, PNG download, IndexedDB reload and a second isolated account. **0 page exceptions**, no horizontal overflow. Four mocked application requests, three mocked imagery responses, **0 paid calls**. All external browser requests were blocked by the test harness.
- No live customer accounts, provider requests or Stripe transactions were used. Nine real isolated-Neon concurrency, last-credit, replay, account-isolation and recovery checks passed. The integration command exited 1 during cleanup: the runtime role correctly lacks DELETE permission; eight synthetic profiles remain only in the existing isolated branch. No grants were broadened and no production rows were touched.

## Protected Preview

The feature Preview uses branch-specific isolated Neon configuration and synthetic review accounts. OpenAI, Stripe and mail credentials are disabled. SSO remains enabled. Real Better Auth login and session lookup succeeded. The authenticated image POST was refused by the existing project firewall before application execution: `Block AI dispatch on noncanonical deployments` denies `/api/generate` and `/api/generate-image` outside `getcontentos.co` to protect older uncapped deployments.

No firewall change was made without approval. The PR records the latest Preview verification and any narrowly authorised exception. Until that deployed route check passes, do not call the hosted generation workflow verified. All four modes passed local browser tests with mocked transport. Gateway object errors now display a readable refusal rather than `[object Object]`.

Evidence: [desktop](image-studio-evidence/studio-1440.png), [mobile](image-studio-evidence/studio-390.png), [exported text design](image-studio-evidence/text-design.png), [browser results](image-studio-evidence/result.json).

Browser reproduction: start a credential-free local dev server on `127.0.0.1:3214`, then run `tests/image-studio-browser.mjs` with `PLAYWRIGHT_MODULE` and `CHROME_PATH` pointing to installed tools. The script exclusively targets localhost, creates an untracked synthetic-account page, intercepts all API transport and deletes the fixture afterward. Do not deploy that temporary page. No production bypass or test-auth flag is added.

## Research and limitations

Public [aiCarousels](https://www.aicarousels.com/) research informed compact choices, brand palettes, readable typography and editable exports. No code, templates or proprietary assets were copied. No REA setup or paid tooling was needed.

Auto is deterministic selection, not a separate semantic AI consultation. Named palette recognition is intentionally bounded; hex colours and the colour controls provide exact values. Copy is extracted/shortened, not rewritten by another AI. Users should review shortened wording before publication.

No live-provider image quality or pixel-level absence of hallucinated provider typography is claimed: provider responses were mocked as requested. Prompts forbid visible lettering/logos/hashtags and deterministic overlays strip hashtags, but an image model can still disobey its prompt. Original imagery should be visually checked before publishing. Uploaded brand-asset reconstruction is not added because the existing image route does not support it.

## Release prerequisites and rollback

1. Review this PR and the protected Preview. Preview status and exact commit are recorded in the PR description.
2. Owner must explicitly approve production release. Do not merge/promote automatically.
3. Deploy the reviewed commit with existing production environment/model, auth, database and spending configuration unchanged. No migration or environment change is required.
4. Verify READY, anonymous route rejection, page health and the unchanged billing/budget configuration without chargeable smoke tests.
5. Roll back application code to the previous production deployment if necessary. Preserve all financial/reservation records. Do not regenerate uncertain requests or erase spending holds. The added design metadata is optional and old replay bodies remain readable.

The Preview is for review only. This task does not authorise paid image tests or production deployment.
