import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const base = "https://content-5z2e94um5-nads1983-9570s-projects.vercel.app";
const { users: [user] } = JSON.parse(readFileSync(process.env.PREVIEW_ACCOUNTS_FILE, "utf8"));
assert.match(user.email, /^premium-preview-.*@example\.invalid$/);
assert.ok(process.env.VERCEL_OIDC_TOKEN);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
await context.route(base + "/**", route => route.continue({ headers: { ...route.request().headers(), "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN } }));
let generationRequests = 0;
await context.route(base + "/api/generate**", route => { generationRequests++; return route.abort(); });
const page = await context.newPage(), errors = [], checks = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const out = "/tmp/contentos-premium-final-review";
mkdirSync(out, { recursive: true });
const brandLabels = ["Brand name", "Target audience", "Offer", "Voice preferences"];
const brandField = label => page.getByRole("textbox", { name: label, exact: true });
let original;
async function openBrand() {
  const summary = page.locator("summary").filter({ hasText: "Brand voice & audience" });
  if (!await summary.evaluate(s => s.parentElement.open)) await summary.click();
}
async function setBrand(values) {
  const saved = page.waitForResponse(r => r.url() === base + "/api/workspace" && r.request().method() === "PUT" && r.status() === 200);
  for (let i = 0; i < brandLabels.length; i++) await brandField(brandLabels[i]).fill(values[i]);
  await saved;
  await page.waitForTimeout(1000);
}
try {
  await page.goto(base + "/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(base + "/studio");
  await page.getByRole("button", { name: "Generate content pack", exact: true }).waitFor();
  await openBrand();
  original = await Promise.all(brandLabels.map(label => brandField(label).inputValue()));
  const values = ["Synthetic release-review brand", "Synthetic independent planners", "Undated planning pad", "Calm, clear, useful; no exaggerated promises"];
  await setBrand(values);
  await page.reload();
  await page.getByRole("button", { name: "Generate content pack", exact: true }).waitFor();
  await openBrand();
  assert.deepEqual(await Promise.all(brandLabels.map(label => brandField(label).inputValue())), values);
  checks.push("brand, audience, offer and voice survive real cloud save and reload");
  const library = page.locator("section").filter({ has: page.getByRole("heading", { name: "Organized Outputs", exact: true }) });
  const articles = library.locator("article");
  const count = await articles.count(); assert.ok(count > 0, "Reuse previously saved synthetic pack");
  await page.getByLabel("Search my content", { exact: true }).fill("zz-no-match-synthetic-release-review");
  assert.equal(await articles.count(), 0);
  await page.getByLabel("Search my content", { exact: true }).fill("Preview");
  assert.equal(await articles.count(), count);
  await articles.first().getByRole("heading").getByRole("button").click();
  const card = page.locator("#outputs article").first();
  await card.getByRole("button", { name: "Copy", exact: true }).click();
  assert.ok((await page.evaluate(() => navigator.clipboard.readText())).length > 20);
  checks.push("saved library search rejects nonmatches, finds saved pack and copies content");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${out}/review-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.getByRole("button", { name: "Open account menu", exact: true }).click();
  await page.locator("#studio-account-menu").getByRole("link", { name: "Account", exact: true }).focus();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#studio-account-menu").count(), 0);
  assert.ok(await page.getByRole("button", { name: "Open account menu", exact: true }).evaluate(e => e === document.activeElement));
  checks.push("three responsive viewports; keyboard Escape closes account menu and restores focus");
  await openBrand(); await setBrand(original); original = undefined;
  assert.equal(generationRequests, 0);
  assert.deepEqual(errors, []);
  const report = { result: "PASS", checks, generationRequests, paidCalls: 0, errors, restoredSyntheticPreferences: true };
  writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error("Primary check failure:", error);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  try {
    if (original) {
      await page.goto(base + "/studio");
      await page.getByRole("button", { name: "Generate content pack", exact: true }).waitFor();
      await openBrand(); await setBrand(original);
    }
  } finally { await browser.close(); }
}
