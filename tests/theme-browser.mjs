import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadTs } from "./image-test-helpers.mjs";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const withStudio = process.env.TEST_STUDIO_FIXTURE === "1";
if (withStudio) assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const dir = process.env.TEST_ARTIFACT_DIR ?? "/tmp/contentos-theme-evidence";
await mkdir(dir, { recursive: true });
const fixture = new URL("../app/image-studio-test/", import.meta.url);
if (withStudio) {
  await mkdir(fixture, { recursive: true });
  await writeFile(new URL("page.tsx", fixture), await readFile(new URL("fixtures/image-studio-page.tsx.fixture", import.meta.url)), { flag: "wx" });
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const errors = [], checks = [];
const { workspaceFromProfile } = loadTs("lib/workspace-contract.ts");
const generation = { id: "theme-synthetic", createdAt: "2026-11-17T12:00:00Z", source: "A planning checklist for creators.", tone: "professional", selectedTypes: ["linkedin"], title: "Theme preview", summary: "Synthetic theme fixture.", sections: [{ id: "theme-post", type: "linkedin", title: "LinkedIn Post", platform: "LinkedIn", body: "One idea becomes a clear post.\n\nLeave room to edit.", items: ["#Planning"], cta: "" }] };
let workspace = workspaceFromProfile({ id: "image-test-account", generation_history_json: [{ payload: generation }] }, "image-test-account");
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark", ...options });
  await ctx.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== new URL(base).origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (withStudio && url.pathname === "/api/workspace") {
      if (req.method() === "PUT") workspace = { ...workspace, ...req.postDataJSON(), revision: workspace.revision + 1 };
      return route.fulfill({ json: workspace });
    }
    if (withStudio && url.pathname === "/api/generate") return route.fulfill({ status: 502, json: { error: "Synthetic theme verification failure", code: "provider_error" } });
    return route.abort(); // No real writes, generations, payments or email.
  });
  ctx.on("page", page => {
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (/hydration|didn't match|server rendered/i.test(message.text())) errors.push(message.text()); });
  });
  return ctx;
}
async function theme(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, expected);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), expected);
}
async function select(page, value) {
  await page.getByLabel("Colour theme", { exact: true }).first().selectOption(value);
  await page.waitForFunction(value => [...document.querySelectorAll('select[aria-label="Colour theme"]')].every(el => el.value === value), value);
}
async function layout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow: ${page.url()}`);
  const rect = await page.getByLabel("Colour theme", { exact: true }).first().boundingBox();
  const width = page.viewportSize().width;
  assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44, `selector touch target: ${page.url()}`);
}
try {
  // The inline head script must work with all React bundles blocked.
  for (const [saved, device, expected] of [["light", "dark", "light"], ["dark", "light", "dark"], ["system", "light", "light"], [null, "dark", "dark"], ["invalid", "light", "light"]]) {
    const ctx = await context({ colorScheme: device });
    await ctx.addInitScript(({ value, origin }) => { if (value !== null && location.origin === origin) localStorage.setItem("contentos-theme", value); }, { value: saved, origin: new URL(base).origin });
    await ctx.route("**/*.js*", route => route.abort());
    const page = await ctx.newPage(); await page.goto(base); await theme(page, expected);
    checks.push(`Before hydration: ${saved}/${device} → ${expected}`); await ctx.close();
  }
  const ctx = await context(), page = await ctx.newPage();
  await page.goto(base); await theme(page, "dark");
  assert.deepEqual(await page.getByLabel("Colour theme").first().locator("option").allTextContents(), ["Light", "Dark", "System"]);
  await select(page, "light"); await theme(page, "light");
  assert.equal(await page.evaluate(() => localStorage.getItem("contentos-theme")), "light");
  await page.reload(); await theme(page, "light");
  assert.equal(await page.getByLabel("Colour theme").first().inputValue(), "light");
  const returning = await context({ storageState: await ctx.storageState() });
  const returned = await returning.newPage(); await returned.goto(base); await theme(returned, "light"); await returning.close();
  const second = await ctx.newPage(); await second.goto(base);
  await select(page, "dark"); await theme(second, "dark");
  await select(page, "system"); await theme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" }); await theme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" }); await theme(page, "dark");
  await select(page, "light"); await page.emulateMedia({ colorScheme: "dark" }); await theme(page, "light");
  await second.evaluate(() => localStorage.removeItem("contentos-theme")); await theme(page, "dark");
  assert.equal(await page.getByLabel("Colour theme").first().inputValue(), "system");
  await second.close(); checks.push("Switching, every selector synchronized, reload, returning visit, cross-tab changes/removal, live System changes and explicit override");

  const paths = ["/", "/features", "/pricing", "/workflows", "/blog", "/login", "/signup", "/reset-password", "/onboarding", "/dashboard", "/theme-not-found"];
  for (const mode of ["light", "dark"]) {
    await select(page, mode);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of paths) {
        await page.goto(base + path); await theme(page, mode); await layout(page);
        if (["/", "/login", "/features"].includes(path)) await page.screenshot({ path: `${dir}/${mode}-${width}-${path === "/" ? "home" : path.slice(1)}.png` });
      }
    }
    await page.goto(base);
    for (const width of [320, 768, 1024]) { await page.setViewportSize({ width, height: 900 }); await layout(page); }
    await page.getByLabel("Colour theme").first().focus();
    await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    assert.equal(await page.getByLabel("Colour theme").first().evaluate(el => getComputedStyle(el).outlineStyle), "solid");
    checks.push(`${mode}: 11 public/auth/error pages at 375 and 1440px; homepage at 320/768/1024px; keyboard focus`);
  }
  const blocked = await context({ colorScheme: "light" });
  await blocked.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } }); });
  const blockedPage = await blocked.newPage(); await blockedPage.goto(base); await theme(blockedPage, "light"); await select(blockedPage, "dark"); await theme(blockedPage, "dark"); await blocked.close();
  checks.push("Storage unavailable: device fallback and manual switching still work");

  if (withStudio) {
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(base + "/image-studio-test");
    await page.locator('#outputs article').first().waitFor();
    for (const mode of ["light", "dark"]) {
      await select(page, mode); await theme(page, mode); await layout(page);
      await page.screenshot({ path: `${dir}/${mode}-studio-desktop.png` });
      await page.getByRole("button", { name: "Image Studio", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Image Studio" }); await dialog.waitFor();
      assert.equal(await dialog.evaluate(el => getComputedStyle(el).backgroundColor), mode === "light" ? "rgb(246, 242, 249)" : "rgb(11, 10, 16)");
      const swatches = await dialog.locator('button[style]').evaluateAll(els => els.map(el => el.style.backgroundColor));
      assert.ok(swatches.length > 0);
      await page.screenshot({ path: `${dir}/${mode}-image-dialog.png` });
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 375, height: 812 }); await layout(page);
      await page.getByRole("button", { name: "Open account menu" }).click();
      assert.equal(await page.locator("#studio-account-menu").evaluate(el => getComputedStyle(el).backgroundColor), mode === "light" ? "rgb(255, 255, 255)" : "rgb(7, 5, 13)");
      await page.screenshot({ path: `${dir}/${mode}-studio-mobile-menu.png` });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "History", exact: true }).click();
      await page.getByRole("dialog", { name: "Recent work" }).waitFor();
      await page.screenshot({ path: `${dir}/${mode}-history-mobile.png` }); await page.keyboard.press("Escape");
      await page.getByText("Text formatter", { exact: true }).click();
      assert.equal(await page.locator("[data-social-preview]").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(244, 242, 238)");
      await page.getByText("Text formatter", { exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByLabel("What would you like to create?").fill("A planning checklist for creators.");
    await page.getByRole("button", { name: "Create Content", exact: true }).click();
    await page.getByText("Synthetic theme verification failure", { exact: false }).first().waitFor();
    for (const mode of ["light", "dark"]) { await select(page, mode); await page.screenshot({ path: `${dir}/${mode}-notification.png` }); }
    checks.push("Studio: output cards, forms, disabled controls, account menu, history and image dialogs, swatches, platform preview, failure notification; synthetic transport only");
  }
  assert.deepEqual(errors, []);
  checks.push("No browser exceptions or React hydration warnings");
  await writeFile(`${dir}/results.json`, JSON.stringify({ base, checks, errors }, null, 2));
  console.log(JSON.stringify({ base, checks, errors }, null, 2));
} finally {
  await browser.close();
  if (withStudio) await rm(fixture, { recursive: true, force: true });
}
