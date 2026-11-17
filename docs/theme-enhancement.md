# Light, dark and system themes

The original dark palette and gradients remain the dark theme. The alternative uses warm white and pale violet surfaces, dark text and readable gold/violet text accents. Shared Tailwind tokens cover page chrome, cards, forms, menus, dialogs, notifications, output cards and preview containers. Violet/gold fills, image swatches, generated images, favicons and Open Graph artwork retain their original colours. The formatter's intentionally light target-platform mockup is also preserved.

The native Light / Dark / System select appears in the homepage header, public-page header, studio toolbar, account-entry forms and shared footer. It has an accessible name, keyboard support, a 44px touch target and visible focus. The selector waits for hydration before accepting input. Header wrapping accommodates narrow viewports without changing navigation links.

The preference is stored in `contentos-theme` in localStorage. System is the default; device preference changes are followed live. Selectors and other open tabs stay synchronized. Missing/invalid preferences and cleared storage resolve to System. If storage is blocked, switching still works for the current visit.

A synchronous head script resolves the theme before first paint. Only the expected root attribute mismatch is suppressed; selector server snapshots match hydration. The runtime re-reads storage after attaching listeners to handle changes made by another tab during hydration. No server cookie reads, dynamic rendering, new dependency, network request or account-data mutation is required for theming.

## Verification

Baseline: main commit `1359ab175fe5a4cb06dd503e6ef0bfc6ddef8bb0`.

- Baseline lint and TypeScript: pass.
- Baseline unit suite: 438 pass, 10 fail, 2 skipped.
- Theme suite: 449 pass, the same 10 fail, 2 skipped. All 11 new bootstrap tests pass.
- Pre-existing failures: six in `content-quality.test.mjs` (lines 15, 33, 42, 51, 62, 93), three in `post-format.test.mjs` (25, 59, 70), one in `simple-creation.test.mjs` (17). They concern hashtag/content expectations, not theme code.
- Chromium browser suite: switching, selector synchronization, saved preferences, new browser context/return visit, reload, cross-tab changes/removal, live device changes, explicit overrides, invalid preferences and unavailable storage.
- Pre-hydration verification blocks all React bundles and checks saved light/dark against the opposite device preference, System and missing/invalid storage.
- Both themes: 11 public/auth/error pages at 375px and 1440px; homepage also at 320px, 768px and 1024px. No horizontal overflow, selectors fit, keyboard focus visible.
- Studio uses the existing temporary fixture and synthetic intercepted transport only: output cards, forms, disabled controls, mobile account menu, image dialog, history drawer, platform mockup, swatches and failure notification. The fixture is removed before the production build.
- No browser exceptions or React hydration warnings.
- Final lint, TypeScript and optimized production build: pass. The production route list contains no temporary studio fixture.
- Main text token contrast exceeds 4.5:1 and form boundaries exceed 3:1 against their relevant base surfaces. Brand violet with white button text is 5.13:1.

Run `node --test tests/theme.test.mjs` for the bootstrap matrix. Run `tests/theme-browser.mjs` with `PLAYWRIGHT_MODULE` and `CHROME_PATH` pointing to the installed Playwright module and Chromium. Set `TEST_STUDIO_FIXTURE=1` only against a local dev server; it creates/removes the existing fixture route. `TEST_BASE_URL` selects the server. Screenshots and JSON results are written under `TEST_ARTIFACT_DIR` (default `/tmp/contentos-theme-evidence`). Without the studio flag the same public theme checks can verify a production build or the live domain.

Pricing, checkout/payment behavior, sales configuration, AI models, credits and account functionality are unchanged, as clarified by the owner during this task.
