# Held-out grounding benchmark proposal

**Not authorized or executed.** Request one protected temporary build-only Preview in the existing `content-os` project and a **new maximum GBP 9 API budget**, separate from the closed previous campaign. No endpoint, production writes, customer data, new account/key/service or deployment-protection change. Do not activate a ledger or dispatch until explicit approval and secure preflight pass.

## Frozen evaluation design

An independent reviewer prepared three fresh synthetic briefs, IDs H1/H2/H3, with ground truth and a scoring rubric outside the repository. The implementation author has not read them. Sealed artifact SHA-256: `882551de16ba114b2d748bbcf11acf6de8e31d72a5974f64cf5a4c65b53fc8b2`. Local file: `/tmp/contentos-grounding-heldout.md`; preserve it before temporary-file cleanup. The file hash is a freeze marker, not access control. If it is lost, have the independent evaluator supply a fresh sealed set before running.

Coverage: event duration versus outcomes, current-instruction/brand conflicts, missing facts, No CTA, realistic creative latitude, and consistency across all 14 formats. The known pilot/launch/sparse fixtures remain regression data, not held-out evidence.

- Three actual previous-production baseline packs (`6c75fab8e995e94c53bec400aed01991e1ee0642`) and three full candidate packs, all 14 formats each. Freeze candidate commit/source hashes before revealing the briefs to the execution runner.
- Six draft calls plus at most six candidate review calls: **12 provider calls maximum**. Candidate executes the same extraction, unit enumeration, validation, correction and revalidation helpers as the application. A draft-only prompt benchmark is not an acceptable substitute.
- Use existing gpt-5.2/default-tier credential in Vercel memory, `store: false`, no tools/images, no SDK/network retry. Preserve the application deadline and output caps. No additional paid model judges.
- Independently blind and shuffle baseline/candidate output pairs; score all 84 asset rows before unblinding. Usefulness/platform fit, originality, voice, source fidelity and CTA compliance each scored 0-4. Ground truth includes exact source support and explicit nonclaims.
- Candidate gate: all 42 assets structurally usable; zero observed critical unsupported facts, source contradictions or No-CTA engagement violations; no material quality regression versus paired baseline. Examine whether correction removes useful content or creates repetition/boilerplate. Aggregate score improvement never overrides a critical defect.
- Record draft/review/correction/final-review latency, provider usage/cost, failure/refusal/truncation, repair counts and final delivery status. No inferred per-format cost/latency allocations. Three cases cannot estimate population reliability or guarantee factuality. A failed/truncated candidate is not replaced by an unreviewed draft.

## Conservative spending envelope

Official [gpt-5.2 pricing](https://developers.openai.com/api/docs/models/gpt-5.2) was checked on 2026-10-18: USD 1.75/M input and USD 14/M output; cached input is cheaper but the reservation assumes no cache. Recheck rates/model/tier and GBP conversion before dispatch. The following is a deliberately pessimistic bound, not a predicted invoice:

| Stage | Maximum calls | Serialized request bytes | Framing allowance | Output-token cap | Per-call reservation (GBP) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline/candidate draft | 6 | 64,000 | 4,096 tokens | 24,000 | 0.568960 |
| Candidate review | 6 | 256,000 | 4,096 tokens | 16,000 | 0.848960 |

Reserve one token per serialized UTF-8 byte plus framing; GBP 1 per USD 1 plus 25% safety margin. Maximum **GBP 8.507520**, inside a proposed GBP 9 ceiling. Refuse any oversized/unpriced payload. Reserve the entire possible candidate pipeline atomically before its draft, or equivalently enforce a durable campaign cap at every stage with no unsafe partial retry. A later review payload depends on the draft: bind it to the frozen candidate, source manifest, prior response digest and stage ID before admission.

Use a new narrowly scoped ledger campaign on the existing temporary Neon branch. Retain the closed old campaign, its nine rows and **GBP 4.804294** permanent reservation unchanged. Do not recycle the difference between that reservation and historical measured spend. Every failed, timed-out or uncertain request permanently consumes its worst-case reservation; no automatic release/retry. Unknown outcome or missing cost evidence stops execution. The proposed GBP 9 is a fresh authorization, not permission already granted or an increase applied to billing settings.

Before any paid dispatch: adapt and mock-test the operator runner for this multi-stage pipeline; verify exact existing Vercel project/Preview protection, existing credential presence without export, exact isolated branch, restricted ledger role, atomic concurrent admission and cleanup. No production auth/customer tables may be read. A failed preflight stops with zero calls.

Auto-disable on completion/error/expiry; remove the temporary deployment and stage, revoke the runner role and retain the audit. Publish measured results and limitations in PR #3. Keep production unchanged; release approval is separate. If the new quality gate fails, report it instead of spending beyond the authorized envelope.
