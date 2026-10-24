# PR #7 security and live AI readiness

Assessed 24 October 2026. Starting commit `69a6a43e4da98090f1c42676fe838dd8317bbb8b`, branch `feat/simple-creation`. No production release or paid-test approval is implied.

## Dependency assessment

The fresh initial production audit reported five affected package entries, not five distinct CVEs: four underlying advisories, with three additional dependent-package findings propagated from Zod.

| Package / installed version before fix | Audit severity | Advisory and dependency chain | Remediation |
| --- | --- | --- | --- |
| next 16.3.8 | Critical (aggregate) | Direct dependency and Better Auth peer; SVG image optimization RCE [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), Server Actions CPU DoS [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), cache-function typed-array RCE [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | Pin first patched 16.x version, 16.4.1; matching Next env/SWC packages updated by lockfile. |
| zod 4.6.2 and nested 4.1.11 | High | Oversized-array validation memory DoS [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); root through Better Auth/core/better-call, OpenAI and ESLint tooling; nested through Vercel CLI config | Override all copies to 4.6.6. |
| @vercel/cli-config 0.2.6 | High, transitive | functions -> oidc -> cli-config -> zod 4.1.11 | Package version retained; vulnerable Zod replaced. |
| @vercel/oidc 3.8.7 | High, transitive | functions -> oidc -> cli-config -> zod | Version retained; patched transitive dependency. |
| @vercel/functions 3.9.7 | High, transitive | Direct production dependency -> oidc -> cli-config -> zod | Version retained; patched transitive dependency. |

Actual exposure assessment:

- The repository already pinned Sharp 0.35.5, the SVG advisory's documented mitigation. No application `next/image` import or SVG opt-in was found. A production Linux environment still makes the framework advisory relevant; absence of an observed request path is not a fix.
- No application `use server` actions were found. The patched production build's server-reference manifest contains zero node and zero edge actions. This limits the identified Server Actions DoS path in this build, not all possible framework risks.
- No `use cache` functions or Cache Components configuration were found. The typed-array exploit's documented prerequisite is absent in this configuration; the vulnerable framework was nevertheless upgraded.
- Zod is not directly imported by application code, but is reachable through authentication/provider dependencies. Request-size bounds reduce exposure, not eliminate every transitive validation path. The Vercel chain is used by database pool attachment and deferred auth mail. No universal non-exploitability claim is made.
- No major upgrade, downgrade, dependency replacement, forced audit repair or application/security/billing configuration change. The nested Zod update is same-major; auth, application, build and browser compatibility checks are recorded below.
- Final installed tree: Next 16.4.1, Sharp 0.35.5, all Zod copies 4.6.6. `npm audit --omit=dev --json` and `npm audit --json`: **0 vulnerabilities**, including development dependencies. This is an advisory-database result, not proof of absence of undiscovered vulnerabilities.
- Production remains on its existing release. Fixing this branch does not patch production; deployment requires separate approval.

## Executed regression checks

| Check | Result |
| --- | --- |
| Complete `npm test` | 234 passed, 0 failed/skipped. Includes auth/security, Stripe checkout/webhooks, Founder and owner lifetime preservation, generation/image quotas, request identity, spending capacity, uncertain calls and workspace isolation. No live provider/Stripe traffic. |
| `npm run typecheck` / `npm run lint` | Passed. |
| Default `npm run build` | Local execution blocked by OS sandbox denying Turbopack CSS-worker port binding, including an escalated attempt. Not a source compilation diagnostic; not reported as a passed default build. |
| `npm run build -- --webpack` | Passed with Next 16.4.1, including TypeScript and route prerendering. No build configuration changed. The Git Preview build will independently verify default Turbopack; its exact result is recorded on the PR. |
| Both npm audits / `git diff --check` | Passed; 0 audit findings. |
| `tests/simple-creation-browser.mjs` | Passed at 1440/768/390 px. Four mocked requests; all 14 formats, automatic settings, brand/explicit overrides, refinement, editing/undo, export/save, failure recovery, device reload and account switching. No horizontal overflow or page errors. |
| `tests/image-studio-browser.mjs` | Passed at 1440/768/390 px. Four modes, three mocked provider calls, colour/type/style payloads, HEX validation, editing/undo, PNG export, reload/isolation. No horizontal overflow or page errors. |
| `tests/simple-creation-isolated.mjs` | Passed on the existing isolated Neon branch. Synthetic preference round-trip, stale-revision/wrong-account rejection, unrelated-field preservation and full transaction rollback. No production data access. |

Screenshots inspected for desktop content, tablet Image Studio and mobile content. Browser fixtures are local-only and removed by the test runners. Provider mocks establish contracts and recovery, **not** generated-content quality, factual accuracy or visual adherence. This phase changes only dependencies and documentation; all 14 formats and existing controls remain present.

The existing protected Preview used an isolated database and empty OpenAI, Stripe and email overrides. Those overrides were reverified read-only before the patch push. Production is still commit `249d90ccf6207abd264afead7628ffcba54a7eb6`, READY deployment `dpl_EojGuj1TbjApssrNFo9QuVpxbDCp`. The exact patched Preview, real isolated login/cloud save and firewall checks are reported on the PR after its build. No production settings, firewall, customers, entitlements, subscriptions, prices, quotas or GBP30 spending controls changed.

## Proposed live scenarios: not executed

Synthetic brand: **Northbank Paper**, warm, plain-English voice; audience independent makers; saved colours cream `#fff7e8` and gold `#b58a30`; luxury graphic preference. No prices, guarantees, giveaway prize/date/eligibility or performance statistics are supplied.

| Call | Minimal input and controls | Pass criteria (any violation fails the scenario) |
| --- | --- | --- |
| T1 | One sentence: "Northbank Paper reached 1,000 subscribers; announce our giveaway on Instagram." Select Instagram; other controls automatic; saved brand loaded. | One usable Instagram draft; accurate 1,000 milestone and brand voice; no invented prize, deadline, entry rules, price or URL. Missing details omitted or clearly marked for confirmation, never presented as established facts. No multi-platform clutter. |
| T2 | One sentence: "Introduce Northbank Paper's weekly planning notebook on LinkedIn without a call to action." Saved brand retained; explicit professional tone, short length, No CTA override. | One LinkedIn-appropriate draft, professional voice despite warmer saved default, <=150 words for this short-post test, no CTA, invented layout/curriculum/availability/outcome promise. Clear line breaks and readable hashtags, if any. |
| T3 | Refine T2: "Make it warmer and shorter, keep the facts and no CTA." | Same selected format and facts, shorter than T2, visibly warmer; no new facts, offers or CTA. Changes saved only to the selected output; original recoverable with undo. |
| I1 | "A simple green announcement graphic for Northbank Paper." Graphic, green swatch, square. | Graphic rather than photograph; green design/background selection respected, recognisable requested subject, readable non-overlapping approved copy; no invented offer or caption hashtags in artwork. Export 1080x1080. |
| I2 | "A notebook beside a plant on a desk." Photograph, explicit custom HEX `#176d51`, landscape. | Photographic scene, notebook/plant/desk present; requested green direction overrides saved cream/gold. No invented label/product claim or visual hashtag. Export 1600x900. The palette control must preserve exact HEX; generated photographic pixels need not all equal a flat HEX colour. |
| I3 | "A luxury cream-and-gold notebook graphic for Northbank Paper." Automatic colours/type/style with saved brand, portrait. | Graphic, cream/gold and luxury styling without detailed prompt engineering; brand spelling intact, no duplicated heading, overlap or unsupported claim. Export 1080x1350. |

For each call record sanitized serialized payload hash, timings, model, usage, reservation and settlement. Independently inspect every returned text/image against the sealed brief and saved settings. Score usefulness, voice, formatting and adherence separately from factual failures. Duplicate the same completed request ID without an additional provider dispatch and verify one success-usage event. Reload/save/edit/undo/export and switch to another synthetic account to verify isolation. Vertical 1080x1920 export can also be checked locally with the returned image without another provider call. Stop on unexpected provider uncertainty, unsafe output, cost-control failure or account leakage; no automatic paid retry.

The current production engine uses instructions and structural validation, not the discarded multi-pass semantic-certification system. Existing prompt/fixture tests prove requested constraints are sent and missing-detail markers are retained; they do **not** establish that a real model never invents facts. That remains an explicit human-reviewed live pass/fail gate. Do not label unchecked content as independently fact-checked.

## Cost estimate and execution boundary

Official pricing checked 24 October 2026: [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1), USD2/M input and USD8/M output; [GPT Image 2.5 Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare), USD5/M text input and USD30/M image output. No cached-input savings assumed. GPT-4.1 is marked deprecated; recheck availability before dispatch, without silently substituting a model. Production text model was previously verified as GPT-4.1; its current Vercel value is a hidden Secret, so that historical evidence is not a fresh runtime observation.

Offline calculation executed the unchanged `quoteAI()` with the **maximum accepted serialized payload sizes**, not merely the short example inputs:

| Type | Payload bytes | Input token bound | Output bound | Conservative GBP/request |
| --- | ---: | ---: | ---: | ---: |
| Text | 128,000 | 132,096 | 24,000 | 0.547431 |
| Image (pinned Flare, high, n=1, text-only input) | 16,000 | 20,096 | 6,250 | 0.345576 |
| Three text + three images | | | | **2.679021** |

Proposed approval ceiling: **GBP2.68 / six paid calls**, retaining full reservations for failed or uncertain dispatches and never recycling released estimates to buy additional calls. The policy uses GBP1.20 per USD as a conservative conversion, not a spot FX quote, and expires 19 November 2026. Image output reservation is the existing conservative policy estimate, not an API-configurable token ceiling. Reverify documented image-token exposure for the exact high-quality sizes at preflight; do not claim an unconditional provider billing guarantee from an application reservation. No amount is spent or authorised by this report.

### Safe proposed method and the unresolved gate

1. Use the existing local checkout, a loopback-only app and the existing isolated Neon branch with synthetic accounts. Run the **existing** authenticated `/api/generate` and `/api/generate-image` routes, not an alternate deployed endpoint. Keep production/Preview untouched; no Vercel firewall exception, preview credential activation, production DB or Stripe connection.
2. Before paid execution, require owner approval and secure availability of the **existing** OpenAI credential to that private operator-controlled process. No key in chat, source, command arguments, screenshots or logs. Do not generate a new key or copy production configuration wholesale. Load only isolated DB/auth configuration and approved model settings; disable mail/Stripe and preview-fixture generation.
3. Enforce a single operator run, six fixed request identities, a private durable pre-dispatch reservation journal and the normal isolated application ledger/quota/idempotency controls. At most GBP2.68 of conservative reservations; no parallel test operator or automatic retries. Record uncertainty before any recovery; never repeat a potentially dispatched request. The normal GBP30 production ledger is not read, reset or mutated, and is not a project-wide cap on other applications.
4. Egress only to OpenAI and the allowlisted isolated Neon endpoint; browser stays on loopback. No production customer inputs. Persist only to synthetic profiles. Remove temporary local execution access at the end, retaining sanitized results and spending evidence privately.

**This method is a proposal, not a provisioned live environment.** The local checkout has no OpenAI credential. Vercel confirms the existing key is a write-only Secret; the connector's environment listing is denied, while CLI metadata/branch-safe checks succeeded. [Vercel's documented Secret rules](https://vercel.com/docs/environment-variables/sensitive-environment-variables) do not permit recovering that value through a normal environment pull. No secret extraction or circumvention was attempted.

Minimum owner action before a GO: approve the private local test method and securely make the already-existing key available to its process from your existing secret record, without sending it in chat; then approve the six-call GBP2.68 budget only after credential isolation and cost preflight pass. If the existing key is unavailable outside Vercel, this task cannot safely supply a live execution path under the current no-Preview-credentials/no-new-endpoint restrictions. Do not create another key, relax protection or spend by inference.

## Decision

**NO-GO for live testing under the currently available credential access.** Dependency findings are remediated in this branch and local regressions pass; the default local Turbopack build has the recorded host limitation, to be checked independently on Git Preview. Live quality and factual adherence remain untested. No material application regression was found. PR #7 remains draft/unmerged, with zero paid calls and no production changes.
