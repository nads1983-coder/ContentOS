# AI-first Studio implementation and release review

Date: 2026-10-18. This branch is a reviewable preview, not a production rollout. Current launch verdict and executed evidence: [release gates](release-gates-2026-10-18.md). The authorized live benchmark and corrected-prompt recheck ran; persistent factual-grounding defects keep the verdict NO-GO.

## Verified baseline and boundaries

- Repository: `nads1983-coder/ContentOS`, based on main `6c75fab8e995e94c53bec400aed01991e1ee0642`.
- Vercel production was verified READY at that commit before implementation. Work is on `feat/ai-first-studio` in an isolated clone; the older local checkout was not overwritten.
- Existing Next.js, React, Tailwind, Neon Postgres, Better Auth, OpenAI and Stripe stack retained. No new runtime dependency or paid service.
- Production inspection used schema and aggregate-only SELECT queries. No customer records, credentials, content or identifiers are included here. No production writes, schema changes, live checkout, emails or provider generations were performed.
- Founder claim coordination, exact promotion enforcement, entitlement activation, webhook retry handling and lifetime cancellation protections are preserved. Additional signature-freshness, delayed recurring-subscription deletion and privacy-safe logging protections are tested.

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

The image path retains explicit generation, four supported formats, style/brand controls, regenerate and download. Images are not generated automatically. A bounded server-side replay cache now supports idempotency; image bodies are excluded from workspace/history payloads and projected out of ordinary profile reads. This is not a durable visual gallery. See [image reservations](image-generation-reservations.md) for retention, resource limits and tradeoffs.

## Persistence and recovery

- No migration required. Existing profile JSON stores `studio_state_json`, text/image reservation/replay metadata, durable successful-usage counters and attempt budgets. Existing row locking coordinates application instances; provider calls occur outside transactions.
- Workspace writes project only allowed content/preferences. They cannot write another account ID, billing, usage or brand ownership. Server revisions reject stale writes with 409, including another tab/device.
- Workspace reads/writes and text/image generation require an originating-account header that must match the authenticated session. The header never selects the account. This prevents a stale tab from loading/saving/generating under a different account after a shared-cookie login switch. Workspace queues are disposed on unmount and Studio remounts when account identity changes. Older open clients must reload before generation.
- Local drafts are written before debounced cloud saves. In-flight cloud saves serialize and coalesce newer edits. A failed/uncertain save blocks further writes until a fresh load; it never silently advances its revision.
- Device backup export includes current work and up to three pre-hydration recovery copies. It is a recovery export, not an automatic import/merge tool. Legacy unscoped browser data remains untouched and is not assigned to an account without ownership evidence.
- An unrenderable legacy history entry is omitted from the rendered list with an explicit warning count; its original database record remains intact. Malformed container/state data fails closed rather than replacing it with an empty workspace.
- Successful generation stores output, history and successful usage atomically. A lost commit acknowledgement can replay the committed result. A rollback leaves an uncertain reservation; it never automatically repeats a provider call. User-facing errors distinguish successful save from uncertainty.
- Text response replay lasts up to 30 days, subject to a 4 MB/2,000-response cache bound. Image replay lasts up to 24 hours, eight results and 10 MB. Terminal request hashes prevent old IDs from regenerating after eviction. Abandoned reservations expire terminally after 15 minutes; an explicit new request is required, and late completion is refused. Images fail closed at 10,000 identities. Text tombstones still need long-term capacity planning.
- Passive device hydration no longer autosaves an unchanged snapshot or advances its cloud revision. Real edits still use compare-and-swap; conflicts require reload/recovery instead of overwriting the other device.
- Auth hooks share the active adapter transaction connection. Password reset revokes sessions inside token consumption before credential mutation and again after mutation; revocation failure rolls back token consumption. A later credential write failure can still require a fresh reset, with old sessions already invalidated. The entire Better Auth reset endpoint is not one transaction.
- Recent history limits are inherited from the existing application. This change does not add an unlimited archive or a durable version-history product. Undo is in-session only.

## Quality and cost evidence

[Offline evaluation](ai-quality-evaluation.md) records strict structural tests across every format and factual/source-preservation prompt guidance. Fixtures are not real provider outputs. No measured claim is made that writing quality, originality, factuality, latency, cost or conversion improved.

The text route uses zero automatic provider retries, a 90-second deadline, a 24,000-token output ceiling, request/output size limits and stable logical request IDs. Manual edits, undo, copy and downloads make no AI call. A targeted rewrite requests one format rather than a whole pack. Invalid output is rejected instead of silently repaired through another charged call. Providers can still charge for unsuccessful attempts.

Local browser baseline at 1440x1000: 107 visible buttons, 8 visible fields and 5,894px document height. Candidate before final copy adjustments: 48 buttons, 21 fields (including familiar format checkboxes), 3,429px height. These are interface inventory measurements under local fixtures, not customer task-time or Core Web Vitals results. The source-to-generation flow remains one primary action with defaults; no measured speed claim is made.

## Validation and release gates

The suite executes generation/workspace/billing routes with mocked provider boundaries, real state transitions, simulated persistence failures, tenant rejection and quota concurrency. Opt-in integration scripts additionally execute real Neon row locks and the installed Better Auth implementation on the existing isolated branch, using synthetic accounts only. Verification/reset messages are captured in memory, not sent. Existing Founder and SEO regression suites are retained.

Authenticated browser checks use the local production build with isolated Neon and real login/cloud persistence. Text-provider output is mocked; the actual image route runs its credential-free template fallback. All 14 format selections, two-device hydration, stale-account rejection, responsive image rendering and download are exercised. These tests do not establish live AI quality or email delivery. Final command totals, accessibility follow-up and preview status are recorded in the release report rather than inferred from earlier 115-test checkpoints.

The authorized paired live AI evaluation completed six requests plus three separately approved corrected-candidate requests with the existing Vercel Secret in one-shot protected Preview builds, without local key export. All 14 formats were returned in every pack; all six original/corrected candidate outputs passed the strict structural contract. Usage-derived total cost was USD 0.50587425 (about GBP 0.38); the GBP 5 ceiling was not increased. The isolated ledger permanently retains GBP 4.804294 of conservative reservations. Both temporary deployments/staging were removed, runner access revoked, and all nine audit rows preserved. No production change or customer data access occurred.

Blind editorial review found unsupported claims/offers and an engagement question in No CTA content despite successful generation and schema validation. Prompt mitigations strengthen numerical/offer/source grounding, audience-ready copy and No CTA precedence. Two instruction-delivery tests and the 249-test suite pass, but the live follow-up still invented class curriculum and converted class duration into a completion promise. No quality pass is claimed from schema or test success. Further grounding work and a newly authorized bounded evaluation are required; PR #3 remains draft. See the release and quality reports for measured performance and remaining blockers.

Seven development-only dependency findings share an unpatched `braces` advisory; production dependency audit is clean. No unsafe major upgrade, incompatible downgrade, audit suppression or fake version override was applied. Image JSON mutation amplification, bounded identity capacity, text tombstone growth, email deliverability and production ingress behavior remain documented limitations.

Keep PR #3 in draft. No production promotion is requested until these gates are resolved and the owner explicitly approves deployment.
