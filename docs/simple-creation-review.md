# Simple creation review

Date: 24 October 2026. Base: production `249d90ccf6207abd264afead7628ffcba54a7eb6`.
Review branch: `feat/simple-creation`. Not a production deployment approval.

## Changes

- Empty, prompt-first composer with one selected platform and Create Content. All 14 formats remain selectable; multiple formats and detailed controls live in collapsed Advanced Options.
- Automatic tone, length, directness, category and CTA direction. Explicit controls and legacy saved preferences remain explicit. Existing brand voice and audience are reused; colours and visual preferences now round-trip through the same account-scoped workspace.
- One platform draft instead of repeated caption alternatives in the simple flow. Missing essential business details must be labelled for confirmation; the prompt explicitly forbids inventing giveaway terms, URLs, prices or guarantees.
- Bounded natural-language refinement through the existing generation route. Custom changes and automatic controls participate in request identity; older omitted-field fingerprints remain compatible.
- Image description, image type, visual style, colour swatches, custom HEX and familiar format names. Explicit controls reach the existing image request without another briefing/model call. Per-creation palettes override saved colours. Old Text/Image/Mixed modes and template settings remain in Advanced Options.
- Less output framing, collapsed format metadata, Copy/Edit/Regenerate/Create Image and existing save/export/undo. No example pack masquerading as a customer's initial output.
- Account changes reset the new controls before restoring the matching workspace. No schema migration, models, prices, quotas, entitlement rules or spending limits changed.

## Executed checks

- `npm test`: 234 passed, zero failed, including existing auth, subscription, Founder/owner lifetime protection, spending policy, quotas, replay and uncertain-call suites.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: passed.
- `tests/simple-creation-browser.mjs`: one-sentence input, one platform, all 14 formats, explicit override payloads, editing/undo, custom refinement, export, save, failed generation recovery, second-device hydration and account switching. Desktop 1440, tablet 768 and mobile 390 pixels: no horizontal overflow or page errors. Provider and storage mocked; real normalizers, reservation/completion and workspace contracts executed.
- `tests/image-studio-browser.mjs`: all four existing modes, type/style/colour payloads, invalid HEX rejection, deterministic editing/undo, PNG download, device reload and account isolation. Same three widths, no page errors. Mocked image transport only.
- `tests/simple-creation-isolated.mjs`: new preferences written/read in a transaction on one synthetic profile in the existing isolated Neon branch; wrong-account and stale-revision rejection, unrelated-field preservation and complete rollback verified. No production database access.
- Test fixture pages are created only by local browser runners and removed in `finally`; they are not part of a deployment.

## Limits and review requirements

- Zero paid AI requests. Mocked generation proves request handling, formatting, recovery and persistence, not live writing quality or visual adherence. This does not add the retired experimental factual-review system or claim model output is independently fact-checked. Customers must confirm missing facts before publication.
- Brand profiles themselves are not rewritten by creation overrides. Workspace preferences are saved automatically. Existing profile fields remain supported; no logo upload or new brand-management service was introduced.
- Image overlays can be edited locally and undone. Changing a generated scene requires an explicit regeneration and does not guarantee an exact local edit.
- Preview must remain SSO protected, use only the existing isolated branch, and have OpenAI/Stripe/email credentials disabled. The production noncanonical-host firewall remains unchanged: generation routes may be blocked on Preview. Browser workflow evidence above is local/mocked, not a claim that the protected Preview makes AI calls.
- The original audit at `69a6a43` reported five affected package entries (four high, one critical). The scoped follow-up upgrades Next.js to 16.4.1 and overrides all Zod copies to 4.6.6. Both production-only and complete audits now report zero findings. See [security and live-test readiness](pr7-security-live-readiness.md) for exposure, regression evidence, build-environment limits and the remaining credential-access gate. Production has not received these patches.

## Release boundary

Prepared for owner UX review, not automatically promoted. Production application, firewall, billing, customer data, subscriptions, retired public Founder promotion, existing Founder benefits, owner complimentary access and the GBP30 application spending cap remain untouched.
