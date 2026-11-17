import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { loadTs } from "./image-test-helpers.mjs";

const { themeInitScript, normalizeThemePreference, THEME_STORAGE_KEY } = loadTs("lib/theme.ts");

for (const systemDark of [false, true]) {
  for (const saved of [null, "system", "light", "dark", "invalid"]) {
    test(`pre-paint theme: saved ${saved}, device ${systemDark ? "dark" : "light"}`, () => {
      const document = { documentElement: { dataset: {} }, querySelector: () => null };
      vm.runInNewContext(themeInitScript, {
        document, matchMedia: () => ({ matches: systemDark }),
        localStorage: { getItem: key => { assert.equal(key, THEME_STORAGE_KEY); return saved; } }
      });
      const preference = saved === "light" ? "light" : "system";
      assert.equal(normalizeThemePreference(saved), preference);
      assert.equal(document.documentElement.dataset.themePreference, preference);
      assert.equal(document.documentElement.dataset.theme, preference === "system" ? (systemDark ? "dark" : "light") : preference);
    });
  }
}

test("blocked storage falls back to the device before hydration", () => {
  const document = { documentElement: { dataset: {} }, querySelector: () => null };
  vm.runInNewContext(themeInitScript, {
    document, matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => { throw new Error("Storage blocked"); } }
  });
  assert.deepEqual(document.documentElement.dataset, { theme: "light", themePreference: "system" });
});
