# AI-first Studio implementation and release review

Date: 2026-10-18. This branch is a reviewable preview, not a production rollout.

## Verified baseline and boundaries

- Repository: `nads1983-coder/ContentOS`, based on main `6c75fab8e995e94c53bec400aed01991e1ee0642`.
- Vercel production was verified READY at that commit before implementation. Work is on `feat/ai-first-studio` in an isolated clone; the older local checkout was not overwritten.
- Existing Next.js, React, Tailwind, Neon Postgres, Better Auth, OpenAI and Stripe stack retained. No new runtime dependency or paid service.
- Production inspection used schema and aggregate-only SELECT queries. No customer records, credentials, content or identifiers are included here. No production writes, schema changes, live checkout, emails or provider generations were performed.
- Founder claim coordination, exact promotion enforcement, entitlement activation, webhook retry handling and lifetime cancellation protections are unchanged.

## REA and research

Official `morluto/rea` README, installation, browser observation and security guidance were inspected. Node 24.15.0 meets the documented runtime requirement. REA 6.5.0 was installed through its official Codex setup command, separately from this app. Setup reported ready and the matching skill installed. Codex must restart to discover the newly registered MCP server; successful CLI observations were used in this session instead.

REA observed Buffer's public Create page through an isolated Chrome debugging session. Target discovery and accessibility inspection succeeded (889 nodes, 13,406 text bytes). Observed concepts included Board view, Content Management, Social Media Templates, AI Assistant and Content Tagging. No authenticated competitor workflow, protected source code, account or paid service was accessed.

Evidence references: `ev_db47b475514b6234b7a6040513f5600cecc9f2089c1efeffa4674973c6624bca` (discovery), `ev_aa2e8a6cdc47d7b193bf003e221911947597b82c51c9869f933ac600662b60b3` (page inspection). Detailed official-source comparison of Buffer, Publer, Metricool, Planable, Jasper, Copy.ai and Canva: [competitor evidence](ai-first-competitor-evidence.md). No independently verified rating or ranking is claimed.

## Prioritized audit and implemented changes

| Priority | Confirmed baseline issue | Implemented response |
| --- | --- | --- |
| P0 | Client-selectable paid plan; text route lacked durable quota admission | Remove local plan switching; authenticated, server-derived entitlement checks and atomic quota reservations |
| P0 | Partial/duplicate/empty model outputs could be accepted; missing captions could silently fall back to source | Exact requested-format schema, complete-pack validation, bounded input/output, explicit failure without fabricated fallback |
| P0 | Browser history was unscoped and account history was not hydrated | Account-specific local keys; authenticated workspace GET/PUT; history hydration; CAS revisions and serialized saves |
| P0 | Concurrent saves/retries could duplicate work or overwrite content | Row-locked generation admission and atomic result/history/usage persistence; stable request IDs, stored replay and explicit uncertain-result handling |
| P0 | Refinement actions changed clipboard text rather than editing the pack | Real single-asset AI actions, direct manual editing, apply/cancel, in-session undo and export of edited content |
| P0 | Image usage lookup failure permitted paid work anyway | Fail closed with a temporary error; retain existing entitled image generation and template rendering |
| P1 | Dense composer, persistent side panels and too many visible buttons | Source-first composer, early primary action, familiar format checkboxes, optional settings, modal history and responsive output layout |
| P1 | Brand/onboarding values were not used reliably in creation | Load account brand profiles and onboarding preferences; persist current preferences/draft; saved-brand selection feeds prompts |
| P1 | Dashboard led with billing instead of useful work | Create-with-AI action and recent packs linking back to Studio; onboarding continues into creation |
| P1 | Homepage messaging was abstract | Literal AI content-generator metadata and idea-to-platform-ready content copy; existing useful SEO pages retained |

All 14 existing formats remain: LinkedIn, Instagram, TikTok, X post, Facebook, YouTube Shorts, X thread, short-video script, carousel, email newsletter, repurposing pack, hooks, CTAs and platform hashtags. Unsupported URL ingestion and new blog/YouTube-description formats are not advertised as implemented.

The image path retains explicit generation, four supported formats, style/brand controls, regenerate and download. Images are not generated automatically. Durable image-library storage is not implemented: existing inline images remain session-local and are deliberately excluded from profile JSON.

## Persistence and recovery

- No migration required. Existing profile JSON stores `studio_state_json`, reservation/replay metadata and durable text-usage counters. Existing row locking coordinates application instances; provider calls occur outside transactions.
- Workspace writes project only allowed content/preferences. They cannot write another account ID, billing, usage or brand ownership. Server revisions reject stale writes with 409, including another tab/device.
- Local drafts are written before debounced cloud saves. In-flight cloud saves serialize and coalesce newer edits. A failed/uncertain save blocks further writes until a fresh load; it never silently advances its revision.
- Device backup export includes current work and up to three pre-hydration recovery copies. It is a recovery export, not an automatic import/merge tool. Legacy unscoped browser data remains untouched and is not assigned to an account without ownership evidence.
- An unrenderable legacy history entry is omitted from the rendered list with an explicit warning count; its original database record remains intact. Malformed container/state data fails closed rather than replacing it with an empty workspace.
- Successful generation stores output, history and successful usage atomically. A lost commit acknowledgement can replay the committed result. A rollback leaves an uncertain reservation; it never automatically repeats a provider call. User-facing errors distinguish successful save from uncertainty.
- Completed response replay lasts up to 30 days, subject to a 4 MB/2,000-response cache bound. Terminal request hashes prevent old IDs from regenerating after eviction. Abandoned reservations expire terminally after 15 minutes; an explicit new request is required, and late completion is refused. These policies bound large response storage without silently forgetting old request identity.
- Recent history limits are inherited from the existing application. This change does not add an unlimited archive or a durable version-history product. Undo is in-session only.

## Quality and cost evidence

[Offline evaluation](ai-quality-evaluation.md) records strict structural tests across every format and factual/source-preservation prompt guidance. Fixtures are not real provider outputs. No measured claim is made that writing quality, originality, factuality, latency, cost or conversion improved.

The text route uses zero automatic provider retries, a 90-second deadline, a 24,000-token output ceiling, request/output size limits and stable logical request IDs. Manual edits, undo, copy and downloads make no AI call. A targeted rewrite requests one format rather than a whole pack. Invalid output is rejected instead of silently repaired through another charged call. Providers can still charge for unsuccessful attempts.

Local browser baseline at 1440x1000: 107 visible buttons, 8 visible fields and 5,894px document height. Candidate before final copy adjustments: 48 buttons, 21 fields (including familiar format checkboxes), 3,429px height. These are interface inventory measurements under local fixtures, not customer task-time or Core Web Vitals results. The source-to-generation flow remains one primary action with defaults; no measured speed claim is made.

## Validation and release gates

Tests execute generation/workspace routes with mocked auth/provider/database boundaries, real contract/state logic, simulated commit failures, tenant rejection and quota concurrency. Repository locking tests use a transaction mock, not a live Postgres concurrency benchmark. Existing Founder and SEO regression suites are retained.

Final local commands: `npm test` passed 111/111; `npm run typecheck`, `npm run lint`, `npm run build` (51 generated pages) and `git diff --check` passed. The test runner retains pre-existing module-type warnings from direct TypeScript imports. Browser fixtures passed at all three viewport sizes with four intercepted provider responses and no page exceptions.

The same browser suite also passed against the local production build on port 3211 with zero console errors, zero page exceptions and no diagnostic exclusions. Its inventory was 45 visible buttons, 21 fields and 3,429px document height; the development toolbar accounts for three extra buttons in the development comparison. This remains a mocked-provider browser check, not live generation or authenticated persistence validation.

Browser fixtures use only localhost and intercept AI calls: manual editing without AI, undo, targeted rewrite, source preservation, TXT export, failure recovery, explicit new attempts, local draft reload and 1440/768/390px overflow checks. Local auth is intentionally unconfigured; its two expected diagnostics are reported separately, not hidden as a production success. No authenticated live signup/reset/email flow or real provider call was tested.

Production release gates still required:

1. Authenticated isolated-environment end-to-end tests for brand creation, cloud autosave/reload/conflict, onboarding and image entitlements; live database transaction/concurrency validation with synthetic records.
2. Authorized paired baseline/candidate AI evaluation, including all-format packs, sparse inputs, qualified claims and brand consistency. Strict validation can increase rejected-pack frequency; measure before promotion.
3. Review image concurrency/idempotency and retention separately. This branch closes the usage-read fail-open but does not add persistent image reservations or a durable visual gallery.
4. Review remaining dependency advisories. Compatible Sharp/libvips patches reduce the baseline eight high reports to seven. Remaining reports share the `braces` dependency in build/lint tooling. npm suggests a Tailwind major upgrade or incompatible Next ESLint downgrade; neither was forced into this product change.
5. Review gradual growth of compact generation tombstones and monthly counters in profile JSON. Long-term normalized archival may eventually be justified; no new database structure is introduced here.

No production promotion is requested until these release gates are reviewed. Preview readiness is not equivalent to verified production readiness.
