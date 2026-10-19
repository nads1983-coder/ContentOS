import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function runAuthenticatedBrowser({ alice, bob, passwordA, passwordB }) {
  const base = "http://localhost:3212";
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
  const browser = await chromium.launch({ headless: true });
  const artifacts = "/tmp/contentos-auth-browser";
  await mkdir(artifacts, { recursive: true });
  const errors = [], checks = [], workspaceResponses = [];
  let stage = "login and hydration";
  const runAddress = Math.floor(Math.random() * 255);
  const first = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, extraHTTPHeaders: { "x-vercel-forwarded-for": `198.19.${runAddress}.1` } });
  const second = await browser.newContext({ viewport: { width: 768, height: 1024 }, extraHTTPHeaders: { "x-vercel-forwarded-for": `198.19.${runAddress}.2` } });
  const page = await first.newPage(), device = await second.newPage();
  let passiveDeviceWrites = 0;
  device.on("request", request => { if (request.url().endsWith("/api/workspace") && request.method() === "PUT") passiveDeviceWrites++; });
  page.on("response", r => { if (r.url().endsWith("/api/workspace")) workspaceResponses.push({ method: r.request().method(), status: r.status() }); });
  for (const p of [page, device]) {
    p.on("pageerror", () => errors.push("page exception"));
    p.on("console", m => { if (m.type() === "error" && !m.text().includes("409 (Conflict)")) errors.push("console error"); });
  }
  async function signIn(p, user, password) {
    await p.goto(`${base}/login`);
    await p.getByLabel("Email", { exact: true }).fill(user.email);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Log in", exact: true }).click();
    await p.waitForURL("**/dashboard");
    await p.goto(`${base}/studio`);
    await p.getByRole("button", { name: "Generate content pack", exact: true }).waitFor();
  }
  try {
    await signIn(page, alice, passwordA);
    const source = page.getByLabel("What would you like to create?");
    const saved = page.waitForResponse(r => r.url().endsWith("/api/workspace") && r.request().method() === "PUT" && r.status() === 200);
    await source.fill("A synthetic studio pilot with five participants. No results have been measured yet.");
    await saved;
    await signIn(device, alice, passwordA);
    assert.equal(await device.getByLabel("What would you like to create?").inputValue(), await source.inputValue(), "second device must hydrate the saved draft");
    await device.waitForTimeout(1000);
    assert.equal(passiveDeviceWrites, 0, "passive second device must not autosave or advance the cloud revision");
    checks.push("real UI login and independent-device cloud draft hydration");
    assert.doesNotMatch(await page.locator('meta[name="viewport"]').getAttribute("content"), /maximum-scale|user-scalable=no/);
    await page.getByRole("button", { name: "Formatter", exact: true }).click();
    assert.equal(await page.locator("#formatter").evaluate(element => element.closest("details").open), true);
    assert.equal(await page.locator("#formatter textarea").evaluate(element => element === document.activeElement), true);
    await page.getByRole("button", { name: "Outputs", exact: true }).click();
    const linkedIn = page.locator("#outputs").getByRole("button", { name: "LinkedIn", exact: true });
    await linkedIn.click();
    assert.equal(await linkedIn.getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Outputs", exact: true }).click();
    assert.equal(await linkedIn.getAttribute("aria-pressed"), "false");
    checks.push("formatter disclosure opens and focuses editor; filters expose selection; zoom cap removed");

    let generations = 0;
    await page.route("**/api/generate", async route => {
      generations++;
      const input = route.request().postDataJSON();
      assert.equal(input.selectedTypes.length, 14, "request includes all 14 formats");
      assert.equal(route.request().headers()["x-contentos-account"], alice.id);
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ json: { ...input, id: "isolated-browser-pack", createdAt: new Date().toISOString(), title: "Isolated planning pilot", summary: "Synthetic browser fixture, not AI quality evidence.",
        sections: input.selectedTypes.map(type => ({ id: `isolated-${type}`, type, title: `${type} pilot`, platform: type, body: "Five participants are trying a weekly planning checklist. Results are not yet available.\n\nChoose three priorities, reserve focus time, and review the week.", items: [] })) } });
    });
    for (const checkbox of await page.locator("fieldset input[type=checkbox]").all()) await checkbox.check();
    await page.getByRole("button", { name: "Generate content pack", exact: true }).click();
    await page.getByRole("button", { name: "Creating your content...", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Isolated planning pilot", exact: true }).waitFor();
    assert.equal(generations, 1, "one text provider fixture call");
    assert.equal(await page.locator("#outputs article").count(), 14, "all 14 output cards visible");
    checks.push("all 14 formats render with mocked text provider; loading state visible");
    await page.locator("#outputs article").first().getByRole("button", { name: "Generate Image", exact: true }).click();
    await page.getByRole("button", { name: "Generate visual", exact: true }).click();
    const image = page.getByAltText(/Generated visual for/).last();
    await image.waitFor();
    assert.ok(await image.evaluate(img => img.complete && img.naturalWidth > 0), "image pixels decoded");
    await page.getByText("AI backgrounds are not configured. A template background was used. No image credit was used.", { exact: false }).last().waitFor();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG", exact: true }).last().click();
    assert.match((await download).suggestedFilename(), /\.png$/);
    checks.push("real image route stores free template with provider disabled; visible asset and PNG download");
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: `${artifacts}/image-${width}.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok(await image.evaluate(img => img.getBoundingClientRect().width <= innerWidth));
    }
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "Close image generation" }).isVisible(), false, "Escape dismisses image modal");
    checks.push("desktop/tablet/mobile image layout and keyboard Escape dismissal");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.locator("#studio-account-menu").getByRole("link", { name: "Account", exact: true }).focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#studio-account-menu").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Open account menu", exact: true }).evaluate(element => element === document.activeElement), true);
    checks.push("mobile account menu Escape closes and returns focus");
    await page.screenshot({ path: `${artifacts}/studio-mobile.png`, fullPage: true });
    stage = "switch account via real login";
    const switched = await first.request.post(`${base}/api/auth/login`, { headers: { origin: base }, data: { email: bob.email, password: passwordB } });
    assert.equal(switched.status(), 200);
    stage = "stale account save must reject";
    const rejection = page.waitForResponse(r => r.url().endsWith("/api/workspace") && r.request().method() === "PUT" && r.status() === 409);
    await source.fill("An unsaved draft from the previous signed-in account.");
    await rejection;
    stage = "stale account warning must be visible";
    await page.getByRole("status").filter({ hasText: "signed-in account changed" }).waitFor();
    stage = "reload changed account";
    await page.reload();
    await page.getByRole("button", { name: "Generate content pack", exact: true }).waitFor();
    assert.notEqual(await source.inputValue(), "An unsaved draft from the previous signed-in account.");
    assert.equal(await page.getByRole("heading", { name: "Isolated planning pilot", exact: true }).count(), 0);
    checks.push("real account switch blocks stale-tab save and does not import another account's draft/results");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ browser: "PASS", checks, viewports: [1440, 768, 390], mockedTextCalls: generations, liveAiCalls: 0, errors, artifacts }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
    console.error(JSON.stringify({ browser: "FAIL", stage, completedChecks: checks, errorClass: error?.name, assertion: error instanceof assert.AssertionError ? error.message.split("\n")[0] : "browser operation timed out or failed", workspaceResponses, statusText: await page.getByRole("status").allTextContents(), errors }));
    throw error;
  } finally { await browser.close(); }
}
