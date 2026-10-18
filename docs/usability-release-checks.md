# Local Usability Release Checks

## Scope and Method

Observed 2026-10-18, approximately 07:00-07:12 UTC, at `http://localhost:3212/studio`. This was the existing isolated server, with an unauthenticated, newly created Chrome profile. It is not a production or authenticated-workspace certification. Other workers were changing the checkout/build during observation; REA does not establish a deployed artifact or commit identity.

Read the installed REA skill and runtime-observation instructions. Used the already installed REA 6.5.0 CLI and cached Playwright, without registration, installation, or configuration changes. Launched owned headless Google Chrome 155.0.8059.84 with a separate temporary profile and loopback CDP endpoint, never the ambient browser. The browser was closed after capture.

An outer Playwright request guard allowed only GET/HEAD on `http://localhost:3212`, excluding generation and billing endpoints. It blocked off-origin requests and write methods. No generation, image, refinement, billing, sign-in, or save action was performed. The final guard log records no API requests and no blocked requests. App-generated device-local draft initialization was not disabled; no server persistence was claimed or tested.

REA passively captured accessibility/DOM information and viewport screenshots. Explicit REA scenarios separately performed navigation to the selected studio page, waits, Tab presses, an account-menu click/Escape, a LinkedIn filter click, and a Formatter navigation click. A local read-only Playwright probe recorded viewport geometry and control attributes. These probes are supplemental observations, not REA actions or evidence IDs. Passive captures were not used to claim earlier network activity.

## Findings Captured Before Corrections

All four findings below were subsequently corrected and checked by the parent against a restarted, stable production build. The original evidence remains a record of the defects, not the final state. See the final validation section.

1. **P2: Formatter navigation does not reveal the formatter.** At desktop width, clicking the rail's `Formatter` button completed, but the screenshot remained at the composer/output area and the accessibility snapshot still lacked the formatter heading and controls. The final DOM retained a closed `Text formatter` disclosure. Source inspection corroborates a scroll to the formatter element inside that disclosure; it does not open the disclosure first. Open the containing disclosure before scrolling, and consider moving focus to its heading/editor for keyboard navigation. Evidence N1, final `settled` step. No UI edits made.

2. **P2: Output filter selection is visual-only.** Selecting `LinkedIn` removed the Instagram/other output cards, but the filter remained an ordinary button without `aria-pressed`, `aria-selected`, or an equivalent announced selection state. A screen-reader user cannot determine the selected filter from its control state. Use an appropriate pressed-button group or tab pattern, with a programmatically exposed active state. Evidence F1 compares `settle` and `linkedin` DOM/accessibility snapshots.

3. **P2: Rendered viewport metadata limits zoom.** All three final geometry probes observed `width=device-width, initial-scale=1, maximum-scale=1`. This can restrict magnification on browsers that honor the cap. Remove the maximum-scale restriction and verify actual mobile pinch zoom and text scaling. This is a markup observation, not a claim that a physical-device gesture was tested. Evidence P1-P3 and their `*-metrics.json` files.

4. **P3: Escape does not dismiss the mobile account disclosure.** After opening the account menu, pressing Escape on the focused toggle left `Close account menu [expanded]` and the `Log in` link present. The toggle retained focus. Add Escape dismissal and preserve/restore toggle focus. Evidence M1, `open` and `escape` steps. The scenario requested 390px, but the interaction screenshot was 500px wide after an attached-browser viewport reset; this demonstrates the mobile breakpoint behavior, not an exact 390px interaction result.

## Checks That Passed Within Scope

- Final passive screenshots and independent geometry agree on 1440x1000, 768x1024, and 390x844. Document `scrollWidth` equals viewport width at each size. The desktop two-column composition becomes a single-column composer with mobile header/action bar. No first-viewport text collisions were observed in these final screenshots.
- Source textarea and format checkboxes have accessible names. Paid-only formats are disabled and announce `paid plan required`. The initial preview is explicitly marked `EXAMPLE CONTENT PACK`.
- Desktop's first seven Tab stops proceed through brand/home/login and the rail controls; the last observed stop is Outputs. Mobile's first three reach the brand link, account toggle, then source textarea. Visible focus rings are present at the sampled stops; the final sampled controls have a computed 2px solid focus outline. Evidence K1/K2. This is a bounded focus-path check, not a full-page keyboard audit.
- Clicking the LinkedIn filter changes the displayed output subset without a provider request. The mobile account toggle exposes expanded state and the login link. These functional observations do not resolve the selection-state/Escape findings above.

## Retained Evidence

Complete REA JSON, embedded screenshot bytes, decoded PNGs, scenario inputs, and supplemental metrics are local in:

`/tmp/contentos-rea-usability-IXq2DD/`

These temporary artifacts are not committed and may be removed by OS cleanup. Retain them elsewhere before cleanup if needed for a release record. Evidence IDs refer to the complete JSON records, not to screenshots alone.

| Ref | File | REA Evidence ID |
| --- | --- | --- |
| P1 | `passive-1440.json` | `ev_919b2d0ba620e141b73d2d1b0536fe2150d7a5020fd9d74370e878bd07f406e3` |
| P2 | `passive-768.json` | `ev_b2a517c7f85a8807a41433da086fdd7b302be78d4afecadb05b142d95baa473f` |
| P3 | `passive-390.json` | `ev_a3e7aff368070a14c6057e4b293e17a4e5c51fcd75d0042ef54ec0b0ceb4ab16` |
| S1 | `passive-1440-screenshot.json` | `ev_518c66c6ed3b5befd50972d5199ff00c7e034e1710808c61661e23051df0fca2` |
| S2 | `passive-768-screenshot.json` | `ev_d2c45f116faa70000077196c1cb7d46269ac372cb2236dc5d12a4b312f104217` |
| S3 | `passive-390-screenshot.json` | `ev_1eab9c95ab91685a8ee2fa4329e4e5368538b1b1a5882c4e08c5f5b59d308b2a` |
| K1 | `focus-1440.json` | `ev_cf732ddbcc0f9d24cbb1610483346b1aaa935ea416e77a9d50adafb6d3dd0904` |
| K2 | `focus-390.json` | `ev_34ac49f8acbecab5bc738aec1011c3c1aaf51853d0e18c132673a562c6293ee6` |
| M1 | `menu-ready-390.json` | `ev_98f67be7e80ce4c1eace258494b690a97c5871b94a2624c09173dbea380d4e77` |
| F1 | `filter-1440.json` | `ev_49dd53fa979204e0baa4a9356ddde63cb56b9d618c5bc28df36f9bc762b28510` |
| N1 | `nav-formatter-1440.json` | `ev_26bfa14e700341ee3747fea99f5fcbd803ae8b994220873b5ead43ec9fe428a5` |

Direct screenshot links: [desktop](/tmp/contentos-rea-usability-IXq2DD/passive-1440-screenshot.png), [tablet](/tmp/contentos-rea-usability-IXq2DD/passive-768-screenshot.png), [mobile](/tmp/contentos-rea-usability-IXq2DD/passive-390-screenshot.png). Full records and `network-guard.json` are alongside them.

## Limitations and Environment Notes

- An initial load failed with a missing Next.js chunk and the app's `This page couldn't load` fallback. It recovered on a fresh observation without app changes by this worker. The final log also contains one local chunk HTTP 500. Concurrent build replacement is a possible explanation, not proven. Treat this as an isolated-server/build-stability warning, not an established production defect.
- The initial failure has retained passive evidence `ev_6b66ba155c2ea2d9de139f6559d48001c200d4978d1d0335986c3d88ee3faf6a` in `/tmp/contentos-rea-usability-2vKGbo/passive-initial.json`.
- An initial scenario attempt conflicted with the outer Playwright service-worker policy. Letting REA manage that policy resolved the tool error; no app authorization was bypassed. Earlier clipped screenshots in `/tmp/contentos-rea-usability-Gr0Da8/` are superseded and must not be treated as mobile layout defects.
- REA's attached-browser scenarios can reset emulated dimensions between actions/disconnect. Post-scenario `studio-*-metrics.json` and other scenario metrics are not reliable responsive geometry. Use final `passive-*-metrics.json`, S1-S3, and their explicit viewport records. Some menu interaction screenshots use the browser's 500px minimum window width.
- Scenario event capture was deliberately omitted, so those records report incomplete event coverage. Passive screenshots report complete within the captured viewport only. Neither establishes a full network history, full-page screen-reader experience, contrast compliance, physical-device touch behavior, zoom behavior, or overall accessibility conformance.
- No authenticated session, onboarding transition, cloud save/CAS conflict, tenant isolation, quota exhaustion, billing, actual generation, or recovery flow was exercised. The parent owns those authenticated browser checks and should append their actual evidence/results below.

## Parent Authenticated Checks

Executed `tests/auth-isolated.mjs --browser --reset-faults` against the final local production build on port 3212 and the existing isolated Neon branch. PASS. Synthetic accounts were removed afterward; no mail, Stripe calls or live AI generations occurred.

- Real login, cloud autosave and independent-device hydration passed. A newly opened passive device performs zero workspace PUTs; a discovered hydration/autosave conflict was fixed. Stale-device revisions reject instead of overwriting newer content.
- All 14 formats were selected and rendered from one explicitly mocked text response; the loading state was observed. This is UI/contract evidence, not AI writing-quality evidence.
- The actual image route persisted a free SVG fallback with the provider disabled. Pixels decoded, PNG downloaded, and no horizontal overflow occurred at 1440, 768 and 390 pixels.
- Image generation now uses a native modal dialog. Escape dismissal passed; browser focus containment comes from native dialog semantics. The screenshot viewport can show only part of the scrollable dialog on narrow screens, not the whole form at once.
- Formatter rail navigation opens the disclosure and focuses its textarea. Output filter buttons expose `aria-pressed`. Viewport metadata no longer caps zoom; physical-device pinch zoom remains untested.
- Mobile account disclosure closes on Escape from a child link and restores focus to its toggle.
- A real session switch rejects a stale account's save with 409 and displays an account-change warning. Reload does not import the previous account's draft or generated pack.
- Zero page exceptions or unexpected console errors. The intentionally induced 409 network diagnostic is excluded explicitly, not hidden as an unexplained error. No missing-chunk error occurred on the stable rebuilt server.

Browser script: `tests/auth-browser.mjs`; local screenshots: `/tmp/contentos-auth-browser/image-1440.png`, `image-768.png`, `image-390.png` and `studio-mobile.png`. These contain synthetic content only. This is not a complete accessibility certification, physical-device test, Core Web Vitals measurement, live AI benchmark or production-account test.
