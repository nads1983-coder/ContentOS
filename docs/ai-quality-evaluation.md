# Generation contract and offline quality evaluation

## Scope and baseline

This is an offline structural and prompt-contract evaluation, not a live model benchmark. No provider calls, credentials, production changes, or customer content were used. No claim is made about improved live writing quality, factual accuracy, conversion, latency, or refusal rate.

The inspected baseline accepted any nonempty subset of requested sections. It could infer a missing type from array position, return duplicate types or empty copy, silently discard malformed items, truncate source/context, and replace deficient Instagram/TikTok captions with source text. Its schema did not constrain the requested type enum or exact count. The route did not set an explicit output token budget, timeout, or retry policy.

## Backward-compatible request additions

Existing valid request fields and the success response shape remain unchanged. Omitted selection still uses the original default formats; an explicitly empty or invalid selection now fails validation instead of choosing other formats. Supplied invalid enums and oversized inputs are rejected instead of silently replaced/truncated.

- `requestId?: string`: UUID for reservation/deduplication orchestration; not prompt material.
- `length?: "short" | "standard" | "detailed"`: defaults to `standard`; adjusts copy depth, not required asset counts.
- `refinement?: { action: RefinementAction; section: GeneratedSection }`: exactly one selected format, matching the section's type. UI actions are `shorten`, `expand`, `simplify`, `professional`, `conversational`, `hook`, `cta`, and `alternative`; the earlier `sharpen` and `change-tone` actions also remain supported. Each has explicit prompt guidance. Keep `source` as the original user source, never replace it with the generated draft. The existing section is editing context, not additional factual evidence. Professional/conversational actions override the selected tone for their replacement; the selected tone governs `change-tone`.

The frontend should retain a request ID for a logical retry and create a new ID for a new generation/refinement. The route's reservation layer owns quota/deduplication semantics; the validation contract only validates the ID's shape. A targeted refinement is a generation request, not a free client-only edit.

## Structural acceptance criteria

All 14 original formats remain supported. Every requested format must occur once, IDs must be unique, and copy must survive plain-text normalization. Caption bodies cannot be just hashtags. Output is reordered into requested order. No missing-copy fallback is synthesized.

Required item contracts:

| Format | Items |
| --- | --- |
| Hooks | Exactly 8 |
| CTA suggestions | Exactly 5, or 0 with a nonempty explanation in No CTA mode |
| X thread | 5-7, each at most 280 Unicode code points |
| Carousel | 5-10 |
| Repurposing pack | Exactly 7, with unique `LinkedIn:`, `Instagram:`, `TikTok:`, `X/Twitter:`, `Carousel:`, `Video:`, `Email:` prefixes and nonempty content |
| Platform hashtags | Exactly 6, with unique `LinkedIn:`, `Instagram:`, `TikTok:`, `X/Twitter:`, `Facebook:`, `YouTube Shorts:` prefixes and nonempty content |

X post bodies are at most 280 Unicode code points. This is a conservative product convention, not an implementation of X's weighted URL/Unicode length algorithm. Other semantic formatting requirements, including three caption alternatives, subject lines, and script beats, remain prompt guidance rather than language-dependent parser heuristics.

Bounds: request body 96,000 UTF-8 bytes, body-read deadline 10 seconds, source 8,000 characters, context fields retain original limits, output JSON 100,000 characters, complete stored result 128,000 UTF-8 bytes, body 24,000 characters, at most 30 items per section and 6,000 characters per item. Inline data/media URLs are rejected to match storage constraints. Provider policy is 24,000 output tokens, 90 seconds, and zero automatic retries, avoiding an implicit second paid attempt. Deployment duration allowance is 120 seconds. Provider charges for failed or malformed attempts are outside this application's control.

## Reproducible fixture evaluation

Run `node --test tests/generation-contract.test.mjs tests/generation-route.test.mjs`. Tests transpile the actual TypeScript modules in memory and exercise their exported behavior. They do not write generated code or make live provider calls. Route tests invoke the actual POST handler with mocked authentication/repository/provider boundaries; an additional installed-SDK test injects a fake fetch to verify zero retries on 429, 500, network failure, and timeout. Stateful tests use real reservation transitions in memory to distinguish a committed save with a lost acknowledgement from a rolled-back save. Replay does not call AI or charge again; failed/pending retries are denied. Missing or mismatched originating-account headers are refused before data access. Database network/locking behavior is not validated by this in-memory harness; separate isolated Neon checks are recorded in the release report.

Fixture source: a weekly planning checklist is being tested with five freelance designers; results are not available yet. Positive fixtures cover each of 14 formats and one reversed-order full pack. Negative fixtures cover missing/duplicate/unknown/null sections, duplicate IDs, empty/hashtag-only captions, corrupt JSON, malformed fields, oversized inputs/outputs, incomplete item counts, missing labeled sub-assets, and X limits. Request fixtures cover legacy defaults, UUIDs, optional lengths, all eight UI refinement actions and two aliases, type mismatches, streamed multibyte JSON, stalled-stream cancellation, and misleading/missing Content-Length bounds. Prompt fixtures check JSON-encoded hostile source text, source-first refinement, action-specific guidance, and explicit factual/instruction boundaries.

These fixtures demonstrate deterministic acceptance/rejection behavior only. The all-format fixture is intentionally structural, not a gold-standard publishable pack; for example, its repurpose assets repeat source wording rather than demonstrating channel-native writing. Prompt assertions establish that instructions are present, not that a model follows them.

## Remaining limitations and next evaluation

- Schema validity cannot prove factuality, usefulness, originality, platform fit, or prompt-injection resistance. Labeled assets can still be thin or repetitive. No CTA body/items semantics are prompt-enforced, while the dedicated CTA field is cleared deterministically.
- A malformed provider response is rejected rather than repaired or retried automatically. This may increase visible failures, which should be measured before release.
- A large all-format pack may hit the output/time budget. It must fail as incomplete, not return or count a partial pack as successful.
- No live baseline or candidate samples were scored. A future authorized evaluation should use the same model/settings and blind paired review of source fidelity, unsupported claims, format completeness, channel adaptation, repetition, CTA fit, and refinement meaning preservation.
- Include sparse notes, qualified results, multilingual sources, embedded hostile instructions, No CTA mode, and all-format packs in that evaluation. Track acceptance rate, token cost, and latency alongside human quality scores. Human review remains necessary before publication.

## Focused release audit

- Fixed output normalization expanding a previously valid field past its storage limit. Limits now apply both before and after normalization.
- Fixed timeout classification using installed SDK error classes: SDK timeout/abort errors do not necessarily set a distinct `name` property. Genuine SDK timeout fixtures now return 504, with exactly one fetch.
- Text-generation analytics emit `text_generation_success`, `text_generation_failure`, or `text_generation_replay` with only numeric `duration_ms`, `output_count`, and available valid `input_tokens`, `output_tokens`, `total_tokens`. Metrics cover admission failures and admitted outcomes, not every early HTTP rejection. Replay does not claim fresh tokens. Metrics failures do not alter successful persistence. These are future operational measurements, not measured AI cost or evidence of writing-quality gains.
- Text-route error logs use a fixed message and whitelisted route/event/error-class fields. Raw provider/repository messages, account IDs, request IDs, email, brand, source, and generated copy are excluded. SDK logging is disabled for this client so a debug environment setting cannot enable prompt logging. Other application/framework logs are outside this audit.
- Image admission now uses a durable row-locked hold, UUID/fingerprint deduplication, attempt budgets and successful-usage accounting before HTTP success. Uncertain completion retains the hold and replays the same ID; it never re-dispatches automatically. Real isolated Neon tests cover last-credit concurrency, rollback, replay, expiry, tenant isolation and failure release.
- Image provider calls have bounded request/response sizes and deadlines, with no model/network retry. Explicit template fallback consumes an attempt but no successful image credit. This is not a provider refund: the provider can charge even when its result cannot be retained. Live image quality and provider success rate remain unverified.
- Text recovery requires retaining the same request ID. Older clients omitting it cannot reliably replay after losing the response. The reservation worker's current policy retains replay bodies up to 30 days subject to cache limits and expires abandoned slots after 15 minutes into terminal identities, not automatic retry leases. Reconciliation and explicitly starting a new attempt remain separate user/operator decisions.

## Authorized Live Benchmark Status

**Not run. Actual calls: 0. Actual API spend: GBP 0.** The existing Vercel OpenAI Secret is configured but unavailable through the supported local execution path. The owner declined making it available locally; no new key, account or service was created. Offline fixture passes are not live quality, reliability, timing or cost results.

`scripts/benchmark-content.mjs --dry-run` prepares three synthetic briefs (qualified pilot, fictional priced launch, sparse notes/No CTA), each once against production baseline `6c75fab8e995e94c53bec400aed01991e1ee0642` and once against this branch. Every request includes all 14 formats. Six total requests is a small smoke comparison, not a statistically reliable failure-rate or originality study. Prompt/schema source hashes and exact payload hashes accompany the plan.

The guard fixes `gpt-5.2`, `service_tier: default`, 24,000 maximum output tokens, at most 64,000 serialized UTF-8 input bytes plus a conservative 4,096-token framing allowance, no tools/images/retries, and six durable attempts. Unknown outcomes count at their worst-case price. Exclusive ledger initialization, process locking, fsynced reservations before transport, exact-body validation and fail-closed corrupt/stale state prevent accidental rerun overspend. The ledger is outside Git, never includes the key, and has not been initialized for live use.

At the checked standard rates of USD 1.75/million input tokens and USD 14/million output tokens, reserving one input token per UTF-8 byte and applying GBP 1 per USD 1 plus 25% headroom gives a **GBP 0.568960 per-attempt bound, GBP 3.413760 for all six**, below the owner's GBP 5 ceiling. These are conservative reservations, not actual generation costs. See [official model pricing](https://developers.openai.com/api/docs/models/gpt-5.2) and [Bank of England exchange-rate reference](https://www.bankofengland.co.uk/boeapps/database/Rates.asp?into=USD&rateview=A), checked 2026-10-18. Rates and the guarded model must be rechecked before a later execution. A future key-enabled run must keep the same ledger, not initialize replacement budgets.

| Formats covered by the prepared plan | Baseline/candidate live output | Quality, time, reliability, cost |
| --- | --- | --- |
| LinkedIn, Instagram, TikTok, X post, Facebook, YouTube Shorts | Not run | Not measured |
| X thread, short-video script, carousel, email newsletter | Not run | Not measured |
| Repurposing pack, hooks, CTAs, platform hashtags | Not run | Not measured |

Compare blind paired outputs for factual/source fidelity, useful originality (not plagiarism certification), relevance, brand/tone consistency, channel adaptation, repetition, CTA fit and completeness. Report token usage, acceptance/errors and latency per pack; shared-pack latency/cost cannot honestly be attributed to individual formats without additional calls. Baseline uses the same explicit token/deadline/retry budget for a controlled comparison, not its former unbounded operational settings. No AI judge calls are budgeted. The launch verdict remains NO-GO while this requested gate is blocked.
