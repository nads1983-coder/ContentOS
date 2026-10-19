import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3210";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Browser fixtures may only target a local server.");
const output = process.env.TEST_ARTIFACT_DIR ?? "/tmp/contentos-studio-checks";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const expectedDiagnostics = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", message => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (text.includes("502 (Bad Gateway)")) return; // Deliberately injected failure case.
  if (process.env.TEST_AUTH_UNCONFIGURED === "1" && text.includes("[auth] session lookup unavailable")) { expectedDiagnostics.push("Local auth is not configured"); return; }
  errors.push(text);
});
let calls = 0;
const payloads = [];
let failNext = false;
await page.route("**/api/generate", async route => {
  calls++;
  const input = route.request().postDataJSON();
  payloads.push(input);
  await new Promise(r => setTimeout(r, 250));
  if (failNext) { failNext = false; await route.fulfill({ status: 502, json: { error: "Incomplete pack. Your draft is unchanged.", code: "invalid_generation" } }); return; }
  await route.fulfill({ json: {
    ...input, id: `fixture-pack-${calls}`, createdAt: new Date().toISOString(), title: "Planning pilot", summary: "A small pilot without invented results.",
    sections: input.selectedTypes.map(type => ({ id: `fixture-${type}`, type, title: `${type} draft`, platform: type, body: input.refinement ? "A shorter planning draft. The pilot is still in progress." : "Our weekly planning pilot is underway.\n\nFive designers are testing a checklist. Results are not yet available.", items: [], cta: "What helps you plan?" }))
  } });
});
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/studio`);
  const source = page.getByLabel("What would you like to create?");
  await source.fill("Five freelance designers are testing our weekly planning checklist. Results are not yet available.");
  await page.getByRole("button", { name: "Generate content pack", exact: true }).waitFor();
  const metrics = { buttons: await page.locator("button:visible").count(), fields: await page.locator("input:visible,textarea:visible,select:visible").count(), height: await page.evaluate(() => document.body.scrollHeight) };
  assert.equal(await page.getByRole("button", { name: "Creator", exact: true }).count(), 0);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Generate content pack", exact: true }).click();
  await page.getByRole("heading", { name: "Planning pilot" }).waitFor();
  assert.equal(calls, 1);
  assert.equal(payloads[0].selectedTypes.length, 5);
  assert.match(payloads[0].requestId, /^[a-f0-9-]{36}$/);
  const card = page.locator("#outputs article").first();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await card.getByLabel(/Edit .* body/).fill("My manual change stays in the content pack.");
  await page.getByRole("button", { name: "Generate content pack", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Apply or cancel your manual edits" }).waitFor();
  assert.equal(calls, 1, "Unapplied manual edits must not be replaced by generation");
  await card.getByRole("button", { name: "Apply edits" }).click();
  assert.ok(await card.getByText("My manual change stays in the content pack.", { exact: true }).count());
  assert.equal(calls, 1, "Manual editing must not call AI");
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  assert.ok(await card.getByText(/Our weekly planning pilot is underway/).count());
  await card.getByRole("button", { name: "Refine with AI", exact: true }).click();
  await page.getByText("A shorter planning draft. The pilot is still in progress.", { exact: true }).waitFor();
  assert.equal(payloads[1].selectedTypes.length, 1);
  assert.equal(payloads[1].refinement.action, "shorten");
  assert.equal(payloads[1].source, payloads[0].source);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt", exact: true }).click();
  assert.ok((await download).suggestedFilename().endsWith(".txt"));
  failNext = true;
  await page.getByRole("button", { name: "Regenerate current set", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Incomplete pack" }).waitFor();
  assert.ok(await page.getByText("A shorter planning draft. The pilot is still in progress.", { exact: true }).count());
  assert.equal(await source.inputValue(), payloads[0].source);
  await page.getByRole("button", { name: "Start a new attempt", exact: true }).click();
  await page.getByRole("heading", { name: "Planning pilot" }).waitFor();
  assert.notEqual(payloads[2].requestId, payloads[3].requestId);
  await source.fill("A draft I need to finish tomorrow, with no AI call.");
  await page.waitForTimeout(850);
  await page.reload();
  await page.waitForTimeout(1000);
  assert.equal(await source.inputValue(), "A draft I need to finish tomorrow, with no AI call.");
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${output}/viewport-${width}.png`, fullPage: true });
    await page.screenshot({ path: `${output}/viewport-${width}-top.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${width}px viewport overflows`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, fixtureProviderCalls: calls, metrics, viewports: [1440, 390, 768], pageErrors: errors, expectedDiagnostics, artifacts: output }, null, 2));
} finally { await context.close(); await browser.close(); }
