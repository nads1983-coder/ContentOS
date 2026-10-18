# Server-side factual grounding

Status: implemented and locally tested; live semantic accuracy, quality, latency and cost remain unverified. PR #3 stays draft. No new paid calls, temporary benchmark deployments, production writes or migrations were made for this change.

## Delivery boundary

The generation route now runs `groundGeneration` after structural parsing and before `completeTextGeneration`. This is not just a writing-prompt instruction. It also applies to targeted AI refinements. The durable admission, account binding, quota, replay and atomic history/usage completion paths remain unchanged. Unchecked or unresolved packs are not delivered, persisted in history or counted as successful generations.

1. Extract exact sentence/clause source statements from the original brief and the selected brand name, audience and offer. Retain source IDs, origin, field and domain tags. Saved-brand selection already copies those editable fields into the request; the reservation fingerprints this stable snapshot. Do not load unrelated account brands or silently substitute later brand edits.
2. Keep writing style and content goal as constraints, not factual evidence. Existing generated drafts are editing context only. Current brief takes precedence over conflicting brand context; unresolved ambiguity is not permission to invent a fact.
3. Enumerate original-offset text units across every requested format: pack title/summary, section title/platform/body/CTA, every item, email subject lines and nested repurposed assets. No text-bearing generated field is intentionally omitted.
4. Run a separate structured semantic review over the entire pack and source ledger. Every unit needs exactly one decision: source-supported, creative, subjective, structural or unsupported. Source-supported decisions require exact source references. Unsupported decisions carry a typed reason and a neutral/source-backed replacement. The reviewer considers contradictions across assets, not just individual strings.
5. Deterministic checks reject missing/duplicate/unknown decisions, nonexistent or fabricated quotations, certain numeric/currency mismatches, event-duration-to-outcome conversions, recognized engagement CTAs, certain stripped negations and counterfeit structural/subjective labels for concrete claims. Domain tags are not logical proof. Curriculum/capability paraphrases are not rejected merely for using different verbs.
6. Apply at most one correction pass to server-selected original offsets. Model-supplied paths cannot redirect edits. Reparse the whole pack against its format contract, then review the corrected pack afresh. Any remaining unsupported decision or invalid review fails closed; there is no third review or repeated regeneration.

Customer statements are **source-supported**, not independently verified facts. The implementation does not browse, invent evidence, or label customer statements externally verified. Exact quotation proves provenance, not truth or semantic entailment.

## Creativity and instructions

Optional illustrations, hypothetical experiments and subjective marketing language remain available. They cannot become actual curriculum, product capabilities, testimonials or measured outcomes. No CTA blocks engagement/contact/signup/purchase requests across assets, not merely the CTA property. Practical instructional steps and clearly framed self-evaluation are not automatically treated as engagement requests. A quoted product named "No CTA" does not change the selected mode; an explicit directive does.

Regression fixes include written-number versus numeral equivalence, unrelated duration versus price, currency/amount binding, thousands separators, clause-scoped negation, distinct product prices, and source-backed curriculum paraphrases. There is no hard-coded replacement pack or generic boilerplate fallback. A labelled placeholder is permitted by the reviewer only when neutral copy cannot work; it is subject to the same final review and format checks.

## Limits, failure and accounting

- One draft call, maximum 24,000 output tokens; at most two review calls, 16,000 each. Maximum 3 provider calls / 56,000 output tokens per logical attempt. No SDK retry, alternate provider/model or unbounded repair loop.
- All provider stages share at most 90 seconds. The remaining budget accounts for elapsed route time and reserves 20 seconds of the 120-second route window for persistence/cleanup. Aborted or exhausted requests cannot start the next stage.
- At most 500 review units, 240,000 serialized review-input bytes and 180,000 review-response bytes. Existing source, format and result size limits remain. Oversized/truncated/refused/malformed reviews fail closed rather than skip validation.
- Telemetry sums numeric token usage from every completed provider response, including reviews. No source, review, output, credentials or account identifiers are added to logs.
- `GroundingError.reason` distinguishes `review_unavailable` from `unresolved_claims`. Both return 502 / `grounding_failed`, with different safe messages. Provider errors remain 500; timeouts/cancellation remain 504. Operational failures do not blame missing customer facts.
- Failure releases application credit holds through the existing terminal failure path, not provider spend or attempt throttles. Same-ID retries do not dispatch again. Uncertain successful saves retain the reservation for idempotent replay.
- Studio recognizes the terminal grounding failure, retains current edits and offers an explicit new attempt. It does not automatically make another paid request.
- Existing completed replays and historical/manual content are preserved, not retroactively certified or rewritten. Images, subscriptions and Founder entitlements are untouched.

## Executed evidence

- 70 synthetic fixtures: 46 negative (including one structural No-CTA companion) and 24 acceptable examples. They retain provenance from the previous failed benchmark and explicit counterexamples; no customer information or provider credentials.
- 106 grounding tests/subtests execute source extraction, deterministic decisions, structured review validation, all-format traversal, bounded correction, revalidation, ambiguous/conflicting evidence transport, format preservation and refusal paths. Mixed-reference price laundering, factual claims disguised as experimental questions and short engagement prompts have explicit regression tests.
- 27 generation-route tests execute actual orchestration with mocked database/provider dependencies. Ten new route tests cover repair-before-save, review errors, terminal retries, token aggregation, cancellation between stages, elapsed deadlines and distinct failure messages.
- Full `npm test`: 366 passed, 0 failed/skipped. Typecheck, lint, production build and `git diff --check` pass. Production dependency audit: zero. Full audit: seven existing high development-only findings, not concealed as a pass. The closed historical campaign also has an executed no-credentials test refusing live/init/setup/deploy entry points.
- Local production-build Playwright checks: desktop 1440, tablet 768, mobile 390; four intercepted/mock generation responses, no real provider calls. Grounding failure preserves the current draft, explicit new attempt changes request ID, manual edit/undo, refinement, export and reload still work. No unexpected page/console errors. Screenshots: `/tmp/contentos-grounding-browser` (local only).

Semantic decisions in tests are explicitly mocked: accepting an honest unsupported decision and exercising correction is **not** proof that a live model detects that claim. The deterministic checks do not solve arbitrary natural-language inference. A reviewer can miss an assertion, misunderstand a qualification, or misclassify a claim as subjective. More complex identities, negation, dates, multilingual wording and adversarial briefs remain limitations. Conservative checks may also reject acceptable copy. The held-out live evaluation is still a mandatory gate, including usable complete-pack rates under the review limits/deadline.

## Next approval boundary

See [held-out benchmark proposal](grounding-benchmark-proposal.md). The old prompt-only campaign is pinned to its historical candidate, with live/init/setup/deploy entry points disabled. Its spend/audit records remain intact. It must not be described as testing this new multi-stage pipeline. No fresh benchmark authorization is assumed from the previous GBP 5 approval.
