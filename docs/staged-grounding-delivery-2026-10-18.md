# Durable factual-validation delivery

## Verdict

**NO-GO for production; local delivery gates pass, live end-to-end delivery remains unverified.** This work replaces the single-request delivery bottleneck, not the factual-quality requirement. No paid calls, temporary benchmark deployments, production writes, customer access or merge are authorized or performed by this change. PR #3 stays draft until live end-to-end validation and separate production approval.

## Evidence and diagnosis

The frozen H1 candidate used 45.151 seconds for its draft, leaving 44.849 seconds of a shared 90-second provider budget. Its only review ended uncertain after 44.852 seconds. There is no returned review body, review token usage or definitive remote error, so neither an OpenAI outage nor a known review throughput can be inferred. H2/H3 reviews were not sent. Their remaining budgets would have been 34.551/37.094 seconds.

The monolithic reviewer was asked to emit decisions, source quotes and possible replacements for 228/267/224 units (719 total), with a 16,000-token output cap. Its serialized requests were 45,618/51,377/45,895 bytes. This combined a variable-length draft with a variable-length exhaustive review under one deadline; even a successful review would leave little/no time for correction and revalidation. Independent blind draft quality did not make those drafts deliverable.

## Implemented architecture

1. A normalized input snapshot is bound to the existing account-scoped request ID and fingerprint. Admission still enforces paid formats, effective Founder/subscription entitlement, monthly holds, minute/day attempt budgets and concurrent pack limits.
2. The existing profile row lock atomically admits exactly one stage before provider networking. The transaction closes before the network call. No migration, queue service, scheduler or production configuration change is required.
3. A POST performs at most one provider call, with its own maximum 90-second provider deadline inside the unchanged 120-second route limit. Route parsing/admission time reduces that stage's available budget, leaving persistence headroom. Completed earlier stages do not consume a later stage's deadline.
4. The draft checkpoints privately, never into user-visible history or successful usage. Review uses at most 48 units per batch, with 4,800 output tokens per call. Every batch receives **all original source statements and all output fields** for surrounding context and cross-format contradictions. No lossy fact extraction or selective-source filter is allowed.
5. Review references use source IDs instead of repeated quotes. The server expands them to their complete original statements, retaining negation and qualifications, and applies the existing structured evidence, numeric, price, duration, No-CTA and annotation guards. No model/client-provided annotation can create a deterministic exemption.
6. Every unit must have exactly one valid decision. Missing, duplicated, invented or counterfeit decisions stop delivery. No output unit is skipped as merely "probably creative". The original 719 unit texts and offsets remain unchanged in the capture regression.
7. If any initial decision is unsupported, one separately measured local correction stage applies reviewed replacements at original offsets. The corrected pack must pass the strict format contract and a **fresh review of every unit**, again with the entire corrected pack visible. Unchanged units are rechecked too because their context may have changed. A second-pass violation is terminal; no regeneration loop.
8. Only a fully covered, accepted checkpoint reaches the atomic final save. Its exact output must match the validated draft; completion writes history and successful usage once, preserving unrelated profile data and lifetime entitlements. The completed reservation retains stage metrics/coverage/spend audit, not a second oversized unchecked journal.

### Alternatives assessed

- **Sequential bounded batches (implemented):** smaller output burden per call, easy durable ordering, one in-flight call and unambiguous failure accounting. Repeated full context costs more input tokens and total wall time may exceed 90 seconds; this is explicitly supported by the continuation architecture.
- **Two parallel batches:** could reduce wall time, but would require per-batch concurrent leases, independently persisted receipts and accounting for requests still running when a sibling fails. No measured reviewer timing exists to justify that extra risk yet. Offline scenario comparisons are retained, not claimed as achieved speedups.
- **Model-extracted fact/claim whitelist:** rejected as the sole evidence source. Extraction could omit a negation, superseded offer or instruction before review. Current source statements are losslessly segmented, not semantically filtered.
- **Review only changed units:** rejected for final revalidation. Corrections can change cross-format meaning; full revalidation is retained.
- **Larger shared timeout/raw-draft fallback:** rejected. They do not solve durable recovery and would weaken the delivery boundary.

## Recovery and spending guarantees

The journal lives inside `generation_reservations_json`, excluded from ordinary SQL read projections. A stable stage key includes pipeline version, phase, pass and batch. The durable metric binds the exact provider payload hash, token limits, reservation and timestamps. Repeating an old HTTP stage key returns progress; it cannot implicitly dispatch the next stage. The client sends a new stage key only after an acknowledged checkpoint.

An interrupted browser can reload and explicitly resume its saved account-scoped request ID and frozen payload. Accepted server work finishes under its own bounded deadline even if the browser disconnects; it checkpoints but never launches the next stage on its own. A changed session stops client continuation and is refused by the route before body/database access. Existing editable drafts are not replaced on failure. A recovered refinement whose original pack is not open is saved in recent history instead of overwriting the current draft.

After a committed checkpoint with a lost HTTP/database acknowledgment, the same request discovers progress without repeating completed provider work. A final save rollback resumes the validated checkpoint; a lost final-save acknowledgment replays the one committed result. A process crash after provider dispatch but before checkpoint persistence is **not automatically recoverable** without provider-side stored-response retrieval: after 120 seconds it becomes terminal uncertainty. No lease takeover or automatic paid retry is permitted. This is an explicit safety limitation, not a claim of exactly-once provider execution across the external crash window.

Bounds per logical attempt: 500 units; 23 paid calls maximum (one draft plus at most two rounds of 11 batches); 24,000 draft and 4,800 per-review output tokens; 160,000 serialized request bytes; 180,000 receipt bytes; 750,000 journal bytes; 8 MB active/failed journals per account; 45-minute logical expiry. Failed/expired IDs cannot regenerate. Failed attempts release their application credit hold but never refund provider reservations or attempt budgets. Original request-ID tombstones remain durable.

Before dispatch, each exact payload reserves its worst-case token cost using one UTF-8 byte per input token plus 4,096 framing tokens, capped output, no cache discount and a 25% buffer. Cumulative admission stops at USD4 per pack; it cannot silently select another model or pricing tier. Only configured/default `gpt-5.2` is accepted. Default-tier [published rates](https://developers.openai.com/api/docs/models/gpt-5.2), checked 18 October 2026: USD1.75/M input and USD14/M output. These versioned assumptions need rechecking before any live release; this is not an OpenAI account billing limit or a replacement for the separately authorized benchmark ledger. Missing/malformed/over-bound reported usage stops continuation and retains the entire reservation. Zero automatic provider retries.

The 45-minute logical retention is not a longer-running function: every call remains bounded and each transition is independently committed. The browser drives acknowledged continuations; there is no unattended job worker. Recovery on another device requires the original request identity/input; automatic cross-device job discovery is not implemented. Device storage may be unavailable, but server accounting remains authoritative.

Deploy the route and client together when eventually authorized. The final HTTP 200 result contract is unchanged, but older one-shot clients cannot drive the new HTTP 202 protocol and must reload. Legacy in-flight reservations are never restarted through the new pipeline. A rollback is not permission to deliver an unchecked checkpoint or erase request identities.

## Offline evidence

[Machine-readable replay](benchmarks/grounding-2026-10-18/offline-delivery.json) executes the actual route, planner, parser, journal transitions and repository transaction interface using captured drafts and explicitly mechanical mock review certificates. It does **not** perform an independent semantic review. The separate frozen blind judgments remain unchanged.

| Case | Covered units | Initial review batches | Calls without repair | Calls with one full revalidation | Original serialized review | Largest serialized batch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| H1 | 228 | 5 | 6 | 11 | 45,618 B | 33,779 B |
| H2 | 267 | 6 | 7 | 13 | 51,377 B | 36,153 B |
| H3 | 224 | 5 | 6 | 11 | 45,895 B | 35,848 B |

All 719 units are covered without omission or overlap; all 14 formats remain. All 24 previously diagnosed format-number false positives remain resolved. Batch input-only sizes peak at 26,132/28,342/28,035 bytes; these must not be compared directly with serialized envelope sizes above. Aggregate review request bytes grow to 164,705/210,178/172,585 because full context repeats.

The local mocked complete execution is approximately 0.1 seconds per pack; exact wall-clock observations and source hashes are in the JSON. This excludes live provider/network/database latency and is **not** customer latency. No actual revised-review latency, throughput, reliability rate, final model quality or cost has been measured.

The separate [real isolated Neon replay](benchmarks/grounding-2026-10-18/isolated-delivery.json) completed the same H1/H2/H3 packs in 1.553/1.652/1.413 seconds using real row locks, commits and network calls, but mechanical mock provider reviews. Each produced exactly one history entry and successful usage event. Those timings include warm isolated database overhead, not live model latency or production load. Only run-scoped synthetic profiles were created and removed; the existing validation branch and benchmark audit remain intact.

Illustrative one-pass costs, combining the recorded draft charge with review requests/mock decisions estimated at four UTF-8 bytes per token: USD0.1994/0.2447/0.2098. These are scenarios, not billed usage or tokenizer measurements; real decisions/reasoning and repairs can differ. Conservative actual initial-pass reservation calculations are USD1.290169/1.482450/1.307173. Per-pack admission remains bounded by USD4 even if corrections expand the pack.

For an assumed 20-second reviewer batch, sequential draft-plus-review wall time would be 145.151/175.449/152.906 seconds, excluding persistence; this assumption is not derived from a successful live review. The architecture allows it safely across requests. It does not claim faster total delivery than the historical draft alone.

## Validation

No paid transport is used by these tests. The original one-request route tests were rewritten for the continuation protocol while retaining auth, quota, paid-format, SDK-no-retry, malformed output, save uncertainty, correction and privacy cases. New checks cover cross-instance admission, exact stage keys, all 719 captured units, full-pack context, corruption, expiry, compact source references and client recovery.

| Check | Executed result |
| --- | --- |
| `npm test` | 457 total: 456 passed, 0 failed, 1 opt-in isolated SQL test skipped. Existing Founder, image, auth, usage, format and grounding coverage remains included. |
| Focused route/pipeline/client tests | 46/46 passed: 26 actual-route orchestration cases, 15 pipeline/capture cases, 5 client cases. |
| `npm run typecheck` / `npm run lint` / `npm run build` | All passed; Next.js 16.3.8, 51 generated pages. |
| `git diff --check` | Passed. |
| Offline captured replay | 3/3 actual-route mocked completions, 719/719 original units, all 14 formats, zero deterministic flags. Not semantic certification. |
| `tests/generation-stages-isolated.mjs` | 10 real-Neon checks passed, including all three captured packs, separate pooled concurrent admissions, checkpoint replay, SQL rollback, concurrent final save, account isolation and terminal crash uncertainty. |
| `tests/auth-isolated.mjs --staged-browser` | Passed against real isolated Better Auth/Neon and the local production build. Synthetic signup/verification/login/reset/cloud isolation/logout checks and the staged UI recovery workflow completed without provider calls or email delivery. |
| Browser recovery | Desktop 1440, tablet 768, mobile 390; seven mocked HTTP responses; reload after lost acknowledgement, same-ID/input resume, correction/revalidation/final delivery, all 14 format cards, no horizontal overflow and no unexpected console/page errors. |

The browser initially exposed a real hydration race: the Resume control was clickable before its mounted guard allowed action. It is now disabled until mounted; the rerun passed. Screenshots are local-only in `/tmp/contentos-staged-browser`.

Observed existing local warnings: pg SSL-alias deprecation, Better Auth missing trusted client-IP fallback in the local harness, and a migration-email module-type warning. No production configuration was changed. Dependency manifests are unchanged; the previously documented seven development-only advisories are not claimed newly resolved or rescanned by this delivery work.

## Minimal live proposal (not authorized or executed)

After local gates pass: **one new synthetic brief, all 14 formats, one fresh draft through final save**, with a maximum **GBP4 cumulative API budget**, at most 23 calls, no retry, and stop immediately on uncertainty or a material factual defect. No baseline rerun: this validates the changed delivery architecture, not a new comparative quality claim. Independently evaluate the 14 final assets and any corrections against sealed source facts, including No CTA and duration versus promised results.

This would require separate approval for one protected, operator-only, isolated non-production execution using the existing Vercel credential and temporary Neon infrastructure, with a fresh atomic GBP ledger. Reverify rates/FX and the exact payload bounds before dispatch; refuse if GBP4 cannot be guaranteed. Remove temporary execution/access afterward. The prior GBP5/GBP9 campaigns remain closed. No deployment or paid call has been created by this proposal, and success would still not authorize production release.
