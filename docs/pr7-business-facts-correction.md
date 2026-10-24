# PR7 captured business-fact correction

## Evidence and root cause

The single authorised live QA request at local commit bb15d810 generated an Instagram caption asserting that the synthetic business began in an attic. The source supplied a subscriber milestone and giveaway announcement; saved context supplied a name, audience and writing preferences, not an origin story.

The old prompt already said not to invent facts, but also asked for specific, warm, human content. Storytelling category guidance mentioned personal stories and customer moments without an explicit source condition. The captured request did not select that category, so it is not established as the cause of this particular output. We cannot infer the model's internal reasoning. The verified enforcement gap was the output parser: it checked completeness/format, not factual grounding. Consequently a structurally valid invented anecdote reached persistence.

The permanent synthetic fixture preserves the exact parsed provider JSON (including the original caption, punctuation and whitespace). It was deep-compared to the private original provider response. Provider identifiers, account identifiers and credentials are excluded. Historical evidence and the stopped campaign remain untouched.

## Focused changes

- Explicit source-grounding instructions cover origins, personal experience, testimonials, credentials, figures, product specifications, prices, guarantees, giveaway terms and endorsements. Creative hooks and subjective language remain allowed. Missing nonessential facts should be omitted; essential omissions use a labelled confirmation placeholder.
- Voice, goals, audience and previous AI drafts are not factual evidence. Saved offer information remains user-supplied context, not independently verified truth. Current instructions take priority in the prompt.
- Added a bounded deterministic backstop for recognizable high-risk assertions. It compares complete source sentences rather than matching isolated keywords/quantities. It does not infer support from writing style or a refinement instruction. It checks all delivered fields across all 14 formats, both before normalization/fallback and after it.
- Recognized unsupported assertions produce HTTP 502 with `unsupported_business_facts`. The route preserves the existing draft, does not complete successful usage/history, does not regenerate and does not retry. Actual provider usage is settled before validation, so rejected output is not treated as a free provider request. Logs include only an error category, not the customer's claim.
- Existing terminal request identity, authentication, financial controls, image generation and entitlement logic are unchanged. No migration or additional service/model/review call is introduced.

## Executed offline verification

- `npm test`: 257 passed, zero failed. Includes generation, actual mocked route orchestration, authentication, account isolation, quota/QA campaign accounting, image contracts, subscriptions, Founder and owner entitlements, and shared cost controls.
- Focused final rerun: 29 business-fact and generation-route tests passed, including explicit provider settlement before rejection.
- `npm run typecheck`: passed.
- `npm run lint`: passed after fixing one lint-only regexp escape.
- `npm run build`: passed; 51 static pages generated.
- `git diff --check`: passed.

Regression coverage includes the exact captured response; supported founder sentences; style/goal contamination; invented testimonials, awards, pricing, product features, giveaway terms and partnerships; changed quantities/dates/locations/qualifiers; placeholders; refusal during refinement; no successful usage/history on rejection; and same-ID rejection without another provider call. All 14 formats receive the guard. Natural Instagram/LinkedIn examples are retained unchanged in deterministic tests. These examples demonstrate acceptance behaviour, not live-model writing quality.

## Limitations and decision

This is not a semantic fact-checking service or a guarantee of factual accuracy. Pattern coverage is finite; novel paraphrases, implied claims, multilingual claims, instruction-like text inside purported source facts and source contradictions can escape deterministic checks. Conversely, the exact-sentence support rule can reject legitimate paraphrases of recognized high-risk claims. Source information itself is user-supplied, not independently verified. General numerical milestones are not blanket-blocked merely for containing a number.

No new provider calls, model metadata requests, credential changes, database operations, deployment or firewall changes were performed for this correction. The revoked key remains revoked; the sealed QA campaign was not reopened or reset. No push or merge is authorised.

GO for founder review of the targeted offline correction, not production readiness or paid execution. Recommend a separately authorised, bounded recheck of the failed Instagram scenario before continuing remaining live scenarios. Do not reuse the stopped campaign or revoked credential. No budget or new paid campaign has been initiated by this change.
