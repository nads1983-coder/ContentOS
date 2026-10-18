# Dependency Security Review

Reviewed 2026-10-18 against PR3 checkout `ec299f8`.

Rechecked during final technical closure on `feat/ai-first-studio`: the dependency tree is unchanged. `npm audit --json` again reports seven high development-only affected nodes (exit 1); `npm audit --omit=dev --json` reports zero (exit 0). `npm view braces dist-tags --json` still returns latest `3.0.3`. No compatible patch, dependency change or audit suppression was introduced. This is an explicitly retained build-tool risk, not an unresolved production-runtime audit finding; the exposure boundaries below still apply.

## Outcome

**No dependency was fixed or upgraded in this review. Seven high-severity npm audit findings remain.**
They all derive from one advisory, [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affecting `braces <=3.0.3`.
The advisory lists no patched version. Direct npm registry queries returned `braces` latest `3.0.3`, with no later published version, and Tailwind 3 latest `3.4.19`; both are already installed.

`package.json` and `package-lock.json` were deliberately left unchanged. No fabricated version, package alias, fork, audit suppression, or new override was added. The existing esbuild and postcss-selector-parser overrides were not changed and are not fixes for this advisory.

## Exact Residual Findings

| Audited dependency | Installed version(s) | Reason |
| --- | --- | --- |
| braces | 3.0.3 | Root advisory: recursive pattern processing can exhaust the call stack |
| micromatch | 4.0.8 | Depends on braces |
| chokidar | 3.6.0 | Depends on braces |
| fast-glob | 3.3.1, 3.3.3 | Depends on micromatch |
| @next/eslint-plugin-next | 16.3.5 | Depends on fast-glob |
| eslint-config-next | 16.3.5 | Depends on the Next ESLint plugin |
| tailwindcss | 3.4.19 | Depends on chokidar, micromatch, and fast-glob |

The two fast-glob installations are one package-level audit finding. These are seven affected package nodes, not seven independent root advisories.

`npm audit --json` returned seven high findings, exit 1.
`npm audit --omit=dev --json` returned zero findings, exit 0.
Every listed installation is marked development-only in the lockfile.

## Risk And Boundaries

The reported risk is denial of service when a process consumes hostile deeply nested brace patterns. Build, lint, and development tooling can still be exposed even though the production-only audit is clean. Do not pass request content, uploaded configuration, or other untrusted patterns to these tools. Run untrusted contributor builds in isolated, resource-limited jobs without production credentials.

The application Tailwind configuration currently uses repository-controlled content globs for `app`, `components`, and `lib`; its PostCSS plugin is build tooling. The checked application source does not directly import the affected glob packages. This narrows observed exposure but is not proof that every framework-internal or bundled path is unreachable. A production-only audit is not a guarantee of runtime safety and does not remove build-system risk.

The upstream maintainer disputes the advisory in [braces issue 84](https://github.com/micromatch/braces/issues/84), but npm still reports it. This review does not treat that dispute as a fix or authorization to suppress the findings.

## Rejected Changes

- `npm audit fix --force` proposes Tailwind `4.3.3` or ESLint config Next `14.2.35`. These are outside the requested compatibility boundary; the Next runtime remains `16.3.8`.
- `brace-expansion` is a different package. Updating or overriding it does not fix `braces`.
- A nonexistent `braces@3.0.4`, an alias to a different API, or a hand-renamed package would not be a verified compatible patch.
- Updating unrelated packages would create lockfile churn without addressing the root advisory.

## Verification

Run the scoped, offline checks with:

```sh
node --test tests/dependency-security.test.mjs
npm run lint
```

The dependency tests check manifest/lockfile agreement, the current Next 16 / Tailwind 3 compatibility boundary, development-only advisory paths, ordinary trusted glob matching, and a real Tailwind/PostCSS compilation using this project's theme. They do **not** assert that malicious patterns are safe or replace npm audit.

No full application build is required to validate an unchanged dependency tree in this bounded review. The isolated CSS compile avoids changing the shared Next build directory while other agents work. No application-wide test total is claimed.

Recheck the registry before attempting remediation:

```sh
npm view braces dist-tags versions --json
npm view tailwindcss@3 version --json
npm audit --json
npm audit --omit=dev --json
```

When an actual compatible upstream patch is published, apply the smallest lockfile update (or a justified exact override), rerun the scoped tests, lint and full application build, and verify the audit before marking this advisory resolved. Do not infer resolution from this document's age or from a passing smoke test.
