import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const affectedTooling = ["braces", "chokidar", "micromatch", "fast-glob", "tailwindcss", "eslint-config-next", "@next/eslint-plugin-next"];

// These are compatibility/exposure guards, not a substitute for a fresh registry audit.
test("documented advisory tooling remains outside the production dependency graph", () => {
  for (const name of affectedTooling) {
    assert.equal(manifest.dependencies[name], undefined, `${name} must not become a direct runtime dependency`);
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (!path.endsWith(`node_modules/${name}`)) continue;
      assert.equal(entry.dev, true, `${path} now reaches production dependencies; reassess GHSA-vfj7-8cjw-p6xm`);
    }
  }
});

test("dependency manifest and lockfile agree without a Tailwind 4 migration or Next downgrade", () => {
  assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[""].devDependencies, manifest.devDependencies);
  assert.match(lock.packages["node_modules/tailwindcss"].version, /^3\./);
  assert.match(lock.packages["node_modules/next"].version, /^16\./);
  assert.match(lock.packages["node_modules/eslint-config-next"].version, /^16\./);
});

test("trusted application file globs still match supported source extensions", () => {
  const micromatch = require("micromatch");
  const candidates = ["app/page.tsx", "app/api/workspace/route.ts", "components/nested/item.jsx", "lib/prompts.ts", "docs/example.md"];
  assert.deepEqual(micromatch(candidates, ["app/**/*.{js,ts,jsx,tsx,mdx}", "components/**/*.{js,ts,jsx,tsx,mdx}", "lib/**/*.{js,ts,jsx,tsx,mdx}"]), candidates.slice(0, 4));
});

test("Tailwind 3 and PostCSS compile real theme colors and responsive utilities", async () => {
  const ts = require("typescript");
  const source = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Function("module", "exports", outputText)(module, module.exports);
  const config = { ...module.exports.default, content: [{ raw: '<div class="grid bg-ink md:grid-cols-2"></div>', extension: "html" }] };
  const result = await require("postcss")([require("tailwindcss")(config), require("autoprefixer")]).process("@tailwind utilities;", { from: undefined });
  assert.match(result.css, /\.grid\s*\{\s*display: grid/);
  assert.match(result.css, /\.bg-ink\s*\{/);
  assert.match(result.css, /rgb\(5 5 9/);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.equal(result.warnings().length, 0);
});
