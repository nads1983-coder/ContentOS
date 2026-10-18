# Generation contract and offline quality evaluation

## Current grounding implementation

Latest runtime: [durable staged delivery](staged-grounding-delivery-2026-10-18.md). Offline replay covers all 719 captured units and completes all three packs through actual-route mocked reviews and isolated Neon persistence. This establishes protocol/coverage/recovery behavior, not new live semantic quality or model speed. There are no new live quality scores. Final HTTP 200 shape remains unchanged, but clients must drive HTTP 202 stage continuations; older one-shot clients need a reload.

The [server-side grounding report](factual-grounding-2026-10-18.md) supersedes prompt-only mitigation as the implementation. Its extraction, structured semantic review, deterministic guards, one correction pass and fresh revalidation run before successful persistence/delivery. The newly authorized [held-out live campaign](controlled-grounding-benchmark-2026-10-18.md) captured 84 drafts but stopped after an uncertain first review at the shared deadline. No candidate pack completed grounding; the verdict is NO-GO. Seven calls were admitted against the fresh GBP9 ledger, then execution/access were disabled and the Preview deleted. The historical live results below belong to the separate closed GBP5 campaign, not this pipeline.

## Scope and baseline

The original sections below describe offline structural/prompt-contract evaluation. The live evaluation adds six paired requests and three separately authorized corrected-candidate requests with synthetic briefs on 2026-10-18. Production and customer content were not used. The small sample does not certify conversion, originality, factual accuracy or population failure rates.

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
- The live evaluation below covers three paired briefs. Refinement meaning preservation and broader multilingual/adversarial behavior still need a larger evaluation; do not generalize this smoke sample to those cases.
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

**Original paired run: six of six completed; zero failed, uncertain or retried requests.** Run window: 2026-10-18 07:47:02-07:51:04 UTC. Usage-derived cost: USD 0.3297035, approximately GBP 0.2487943. Including the separately approved follow-up below, **nine of nine completed; total USD 0.50587425, approximately GBP 0.3817327**, excluding account-specific tax/FX adjustments. This is measured token usage priced at published rates, not an independently verified invoice. The GBP 5 authorization was not increased.

### Execution and safeguards

The owner approved one temporary protected Preview in the existing `content-os` project. A one-shot Vercel build used the existing OpenAI Secret in memory; it was never exported locally or committed. The deployment contained no execution endpoint or application/customer repository. Public access redirected to Vercel SSO; protection settings were unchanged.

An Ed25519-signed three-hour manifest fixed the six exact payloads. The dedicated isolated Neon ledger used atomic row-locked reservations, unique job IDs, null-safe payload/plan hashes and a restricted role with no access to auth/application schemas or direct ledger tables. Each call permanently reserved GBP 0.568960 before dispatch; total **GBP 3.413760** remains recorded, with no refunds. Unknown outcomes stop the campaign; no automatic retry/reset or network-spanning transaction exists. Twelve real isolated PostgreSQL checks and 31 combined benchmark unit tests passed before launch.

Completion automatically disabled the campaign. Operator cleanup revoked function/schema access, disabled login and terminated runner sessions. The sole temporary deployment was removed, confirmed by Vercel 404. Staging files and the revoked connection file were removed; disabled audit rows and private synthetic output/usage evidence remain. No production configuration, database, credential, customer record or billing setting changed.

### Method and measured results

Three synthetic briefs: a qualified pilot with no measured results, a fictional priced class with no signup URL, and sparse prelaunch notes in No CTA mode. Each requested all 14 formats once from baseline `6c75fab8e995e94c53bec400aed01991e1ee0642` and once from candidate `2cfceccf0b193c186d6c7c089479a85ab2c752d1`. Actual prompt/schema modules were extracted, not approximated. Plan SHA-256: `c55ee7e11312f964fa4c8fb430c7c0a88a2f94425cde91f9d49cb89ab1526508`.

Both used `gpt-5.2`, explicit default service tier, 24,000 output-token maximum, 90-second timeout, zero retries, no tools/images and `store:false`. Baseline therefore uses matched operational bounds, not its former unbounded runtime settings. Total measured usage: 14,386 input and 21,752 output tokens; cached input was zero. There were no additional API judge calls.

| Brief | Version | Seconds | Input / output tokens | USD cost | Current strict contract |
| --- | --- | ---: | ---: | ---: | --- |
| Pilot | Baseline | 39.692 | 1,987 / 3,893 | 0.05797925 | Fail |
| Pilot | Candidate | 43.474 | 2,789 / 3,701 | 0.05669475 | Pass |
| Launch | Baseline | 37.797 | 2,020 / 3,914 | 0.05833100 | Fail |
| Launch | Candidate | 44.544 | 2,820 / 3,902 | 0.05956300 | Pass |
| Sparse | Baseline | 35.506 | 1,986 / 3,254 | 0.04903150 | Fail |
| Sparse | Candidate | 39.079 | 2,784 / 3,088 | 0.04810400 | Pass |

Every response returned all 14 formats: 42 baseline and 42 candidate sections. Candidate strict acceptance was 3/3; baseline was 0/3 under the **new** contract, not a claim that its old production parser would reject these responses. Candidate median latency was 43.474 seconds versus 37.797 baseline, 15.0% slower in this sample. Aggregate candidate cost was USD 0.16436175 versus USD 0.16534175 baseline, 0.59% lower. Cost/time are per all-format pack; no individual-format cost or latency was independently measured.

Prices checked 2026-10-18: [OpenAI model rates](https://developers.openai.com/api/docs/models/gpt-5.2), USD 1.75/million input, 0.175 cached input, 14 output. GBP estimates use [Bank of England](https://www.bankofengland.co.uk/boeapps/database/Rates.asp?into=USD&rateview=A) USD 1 = GBP 0.7546 (15 October). The much larger reservation uses GBP 1/USD plus 25% headroom; actual cost does not replenish it.

### Blind editorial review

Before outputs were reviewed, the rubric fixed five 0-4 dimensions per format: source fidelity, useful platform fit, useful originality, brand voice and CTA compliance, total /20. Randomized A/B files withheld variant identity, provenance, timing and cost. Review is model-assisted editorial assessment, not independent human research or plagiarism detection.

Predefined material regressions: overall candidate mean at least 1/20 lower; any brief at least 2 lower; a format at least 3 lower in two briefs; or any new material fabrication, qualification reversal, missing format or No CTA violation. Shared critical defects also block release.

The reviewer froze all 84 scores before unblinding; no rows were missing. [Full synthetic-only scores and excerpts](ai-benchmark-blind-scores-2026-10-18.json). Mapping: pilot A=candidate/B=baseline; launch and sparse A=baseline/B=candidate. A second blind reviewer independently confirmed the principal factual/CTA defects and reviewed all 14 formats qualitatively.

| Format | Baseline mean /20 | Original candidate mean /20 |
| --- | ---: | ---: |
| LinkedIn | 12.33 | 13.67 |
| Instagram | 12.33 | 13.33 |
| TikTok | 11.33 | 12.67 |
| X post | 14.33 | 15.33 |
| Facebook | 13.00 | 13.00 |
| YouTube Shorts | 15.00 | 15.00 |
| X thread | 13.00 | 13.33 |
| Short video script | 12.33 | 13.67 |
| Carousel | 10.33 | 13.33 |
| Email/newsletter | 11.67 | 15.33 |
| Repurposing pack | 8.00 | 9.33 |
| Hooks | 11.00 | 10.33 |
| CTAs | 14.00 | 17.33 |
| Platform hashtags | 13.67 | 14.67 |
| Overall | 12.31 | 13.60 |

The higher average did **not** pass the quality gate. The reviewer recorded 11 baseline and 10 original-candidate critical findings (not independent transaction/failure counts). Candidate examples included an invented five-minute versus fifty-minute planning claim, a ten-second reading setup, an unsupported two-hour comparison, personal-advice/tailoring promises, invented class zone assignments, and a reader-response question in No CTA Facebook copy. Both versions had defects. Candidate structure, email drafts and CTA suppression improved; hooks still tended toward unsupported punchy claims. Repurposed assets repeated earlier copy and lacked strong channel differentiation. Hashtags were relevant starting sets, not measured discovery-performance improvements. These are editorial judgments on synthetic drafts, not causal/statistical quality estimates.

The subsequent prompt patch preserves numerical meaning and source qualifications, prohibits invented experience/offer fulfillment, labels optional illustrations, removes assistant-to-operator offers, and explicitly gives No CTA precedence over platform engagement guidance. Two new tests assert delivery of those instructions, not model compliance. The owner separately approved one follow-up protected Preview for three corrected candidate packs within the same GBP 5 ledger; results must be reported separately, never substituted for the original scores.

This six-request smoke sample cannot estimate production failure rates, causal latency improvements or general originality. It exercises actual prompt/schema generation but not a live authenticated production API route. Refinements, multilingual/adversarial inputs, email delivery and live image generation remain outside this small text benchmark.

### Authorized Follow-up: NO-GO

The owner approved one additional protected Preview within the unchanged GBP 5 ceiling. It appended three exact corrected-candidate jobs to the same ledger, retaining all original evidence/reservations. New worst-case reservations were GBP 0.463359 / 0.463591 / 0.463584, using exact payload bytes plus the same framing/output/currency headroom. Total permanently recorded reservation: **GBP 4.804294**. Thirty-seven benchmark unit tests and eighteen real PostgreSQL checks passed, including old-job replay refusal, prior-audit preservation, concurrent admission and cumulative cap enforcement.

Corrected plan SHA-256: `4df9fe78d5325b8a792585fac439958c84cf2022700e98a4c3ea2480f87cba12`. The same model, tier, timeout and token cap were used. All three returned all 14 formats and passed the strict contract, with no retry or uncertainty.

| Corrected brief | Seconds | Input / output tokens | USD cost |
| --- | ---: | ---: | ---: |
| Pilot | 52.135 | 3,161 / 4,340 | 0.06629175 |
| Launch | 49.024 | 3,191 / 3,958 | 0.06099625 |
| Sparse | 40.635 | 3,189 / 3,093 | 0.04888275 |

Follow-up cost USD 0.17617075, 6.55% above the original baseline sample. Median latency 49.024 seconds, 29.7% above baseline. These are sequential observations, not controlled speed claims. The follow-up repeats the same three briefs after inspecting failures; it is a regression recheck, not a held-out quality evaluation. Two reviewers inspected all 42 sections without numerical rescoring and with the corrected-version identity known.

Observed improvements: the earlier template/personal-advice fulfillment promises, five-minute/ten-second inventions and No CTA Facebook engagement questions were absent. Repurposed emails contained actual drafts. All format types remained intact.

**Material launch blockers remain despite the prompt correction:**

- Email subject: "Organize your craft workspace in 45 minutes, live online". A CTA option similarly promises organizing the workspace in 45 minutes. The source only establishes class duration, not a completion time.
- The X thread assigns zones to "active making" and "storage or overflow", then says the workshop teaches this. The script/carousel/repurposed carousel repeat those unprovided assignments without presenting them as optional examples.

Additional editorial issues: pilot hooks/repurpose CTA fields still instruct the publisher to choose/post assets instead of addressing the audience. Sparse hooks/LinkedIn contain categorical population claims, such as "Most reading goals fail for one boring reason"; reviewers differed on whether these were blocking, so they are retained as a fidelity/voice risk rather than silently discarded.

**Final quality verdict: NO-GO.** Stronger prompts alone did not establish sufficient grounding. The implementation contains the tested prompt mitigation, not a claimed complete fix. Further work needs a verified grounding/claim-validation approach and a fresh controlled evaluation; do not blindly repeat the same prompts or count schema success as factual success. Only GBP 0.195706 of conservative reservation capacity remains, even though measured cost is lower. No third Preview or additional provider call is authorized by these results.

Both temporary deployments reached READY and were deleted, each confirmed 404 afterward. The runner role is NOLOGIN, function/schema access revoked and sessions terminated; staging and revoked credential files were removed. All nine audit rows plus the continuation authorization remain on the existing isolated branch. No production account/content/entitlement, credential, billing setting or deployment changed.
