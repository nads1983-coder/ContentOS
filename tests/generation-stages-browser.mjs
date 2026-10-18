import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { grounding } from "./grounding-capture-helpers.mjs";
import { draft } from "./classification-capture-helpers.mjs";
const validatedFixture = JSON.parse(readFileSync(new URL("../docs/benchmarks/classification-2026-10-18/offline-corrected-pack.json", import.meta.url), "utf8"));
const originalUnits = grounding.groundingUnits(draft).length, finalUnits = grounding.groundingUnits(validatedFixture).length;

export async function runAuthenticatedBrowser({ alice, passwordA }) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [], calls = [], artifacts = "/tmp/contentos-staged-browser";
  await mkdir(artifacts, { recursive: true });
  let stage = "login", key, serverStage = "draft", interrupt = true, releaseReview;
  const gate = new Promise(resolve => { releaseReview = resolve; });
  page.on("pageerror", () => errors.push("page exception"));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("net::ERR_FAILED")) errors.push(m.text()); });
  await page.route("**/api/generate", async route => {
    const payload = route.request().postDataJSON(), token = route.request().headers()["x-contentos-stage"];
    calls.push({ id: payload.requestId, token, source: payload.source });
    assert.equal(route.request().headers()["x-contentos-account"], alice.id);
    assert.equal(payload.selectedTypes.length, 14);
    key ??= payload.requestId; assert.equal(payload.requestId, key);
    const progress = (nextStage, reviewedUnits, phase = "review") => route.fulfill({ status: 202, json: {
      status: "pending", requestId: key, nextStage, stage: phase, running: false, totalUnits: ["revalidation", "save"].includes(phase) ? finalUnits : originalUnits, reviewedUnits
    } });
    if (serverStage === "draft") { serverStage = "1:review:0:0"; return progress(serverStage, 0); }
    if (interrupt) {
      await gate; interrupt = false; serverStage = "1:review:0:1";
      return route.abort("failed"); // Server checkpoint succeeded; HTTP acknowledgment lost.
    }
    if (token !== serverStage) return progress(serverStage, 48);
    if (serverStage === "1:review:0:1") { serverStage = "1:correction:0:6"; return progress(serverStage, originalUnits, "correction"); }
    if (serverStage === "1:correction:0:6") { serverStage = "1:revalidation:1:0"; return progress(serverStage, 0, "revalidation"); }
    if (serverStage === "1:revalidation:1:0") { serverStage = "1:save:1:6"; return progress(serverStage, finalUnits, "save"); }
    return route.fulfill({ json: { ...validatedFixture, source: payload.source, id: "staged-browser-complete", title: "Validated staged fixture" } });
  });
  try {
    await page.goto("http://localhost:3212/login");
    await page.getByLabel("Email", { exact: true }).fill(alice.email);
    await page.getByLabel("Password", { exact: true }).fill(passwordA);
    await page.getByRole("button", { name: "Log in", exact: true }).click(); await page.waitForURL("**/dashboard");
    await page.goto("http://localhost:3212/studio");
    const source = page.getByLabel("What would you like to create?");
    await source.fill("Synthetic staged browser test. A planning pilot has no measured results yet.");
    for (const checkbox of await page.locator("fieldset input[type=checkbox]").all()) await checkbox.check();
    stage = "bounded stage progress and preserved draft";
    const oldBody = await page.locator("#outputs").innerText();
    await page.getByRole("button", { name: "Generate content pack", exact: true }).click();
    await page.getByRole("status").filter({ hasText: `Checking facts: 0 of ${originalUnits}` }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Validated staged fixture" }).count(), 0);
    assert.ok(oldBody.includes(await page.locator("#outputs h2").first().innerText()));
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const status = page.getByRole("status").filter({ hasText: `Checking facts: 0 of ${originalUnits}` });
      await status.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${artifacts}/progress-${width}.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok(await status.evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth; }));
    }
    releaseReview();
    await page.getByRole("button", { name: "Resume saved attempt", exact: true }).waitFor();
    assert.equal(calls.length, 2, "network failure must not automatically repeat the paid stage");
    stage = "reload and durable same-attempt recovery";
    await page.reload();
    await page.getByRole("button", { name: "Resume saved attempt", exact: true }).waitFor();
    await page.getByRole("button", { name: "Resume saved attempt", exact: true }).click();
    await page.getByRole("heading", { name: "Validated staged fixture", exact: true }).waitFor();
    assert.equal(new Set(calls.map(c => c.id)).size, 1); assert.equal(new Set(calls.map(c => c.source)).size, 1);
    assert.equal(calls[2].token, "1:review:0:0", "lost checkpoint resumes by checking the old token");
    assert.equal(await page.locator("#outputs article").count(), 14);
    assert.equal(await page.getByRole("button", { name: "Resume saved attempt", exact: true }).count(), 0);
    await page.screenshot({ path: `${artifacts}/completed-mobile.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: "PASS", mockedHttpRequests: calls.length, paidCalls: 0,
      checks: ["real isolated login", "accessible stage progress at desktop/tablet/mobile widths", "no unchecked delivery", "no automatic network retry", "same-ID/payload recovery after reload", "14 validated-fixture formats visible", "zero unexpected browser errors"], artifacts }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
    console.error(JSON.stringify({ diagnostic: { stage, serverStage, calls: calls.length,
      error: error instanceof Error ? error.message.split("\n").slice(0, 3).join(" ") : "unknown",
      resumeButtons: await page.getByRole("button", { name: "Resume saved attempt", exact: true }).count() } }));
    console.error(JSON.stringify({ status: "FAIL", stage, assertion: error instanceof assert.AssertionError ? error.message.split("\n")[0] : "browser interaction failed" }));
    throw new Error("Staged browser validation failed");
  } finally { releaseReview(); await context.close(); await browser.close(); }
}
