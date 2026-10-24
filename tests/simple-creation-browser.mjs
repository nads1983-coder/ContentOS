import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadTs } from "./image-test-helpers.mjs";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3214";
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
const fixture = new URL("../app/image-studio-test/", import.meta.url);
await mkdir(fixture, { recursive: true });
await writeFile(new URL("page.tsx", fixture), await readFile(new URL("fixtures/image-studio-page.tsx.fixture", import.meta.url)), { flag: "wx" });
const { workspaceFromProfile, updateWorkspaceProfile } = loadTs("lib/workspace-contract.ts");
const { normalizeGenerationRequest, parseGenerationOutput } = loadTs("lib/generation-contract.ts");
const { reserveGenerationInProfile, completeGenerationInProfile } = loadTs("lib/generation-reservation.ts");
const rows = new Map(["image-test-account", "image-test-two"].map(id => [id, { id, email: id + "@example.invalid", plan: "pro_studio", subscription_status: "active" }]));
const payloads = [], errors = [];
let failNext = false;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const dir = process.env.TEST_ARTIFACT_DIR ?? "/tmp/contentos-simple-creation-evidence";
await mkdir(dir, { recursive: true });
async function newContext() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const id = req.headers()["x-contentos-account"], row = rows.get(id);
    if (!row) return route.fulfill({ status: 401, json: { error: "Synthetic account required" } });
    try {
      if (url.pathname === "/api/workspace") {
        if (req.method() === "PUT") rows.set(id, updateWorkspaceProfile(row, id, req.postDataJSON()).data);
        return route.fulfill({ json: workspaceFromProfile(rows.get(id), id) });
      }
      if (url.pathname === "/api/generate") {
        if (failNext) { failNext = false; return route.fulfill({ status: 502, json: { error: "Synthetic provider failure. Draft unchanged." } }); }
        const input = normalizeGenerationRequest(req.postDataJSON()); payloads.push(input);
        const reserved = reserveGenerationInProfile(row, id, input.requestId, input); rows.set(id, reserved.data);
        if (reserved.result.status === "replay") return route.fulfill({ json: reserved.result.result });
        const output = parseGenerationOutput(JSON.stringify({ title: "Community milestone", summary: "Synthetic provider response, not live AI evidence.", sections: input.selectedTypes.map(type => ({ id: type, type, title: `Draft - ${type}`, platform: type, body: input.refinement ? "A shorter milestone update for our community. Thank you for being here." : "Gorl Lead has reached 1,000 subscribers. Our giveaway announcement is taking shape. [CONFIRM: prize, date and eligibility]", items: ["#GorlLead"], cta: "" })) }), input);
        const completed = completeGenerationInProfile(rows.get(id), id, input.requestId, reserved.result.fingerprint, output); rows.set(id, completed.data);
        return route.fulfill({ json: completed.result });
      }
      return route.fulfill({ json: {} });
    } catch (e) { return route.fulfill({ status: e.status ?? 500, json: { error: e.message, revision: e.revision } }); }
  });
  return context;
}
let context, page, stage = "initial composer";
try {
  context = await newContext(); page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(base + "/image-studio-test");
  const create = page.getByRole("button", { name: "Create Content", exact: true });
  await create.waitFor();
  const composer = page.locator("#composer");
  const source = page.getByLabel("What would you like to create?");
  assert.equal(await source.inputValue(), "");
  assert.equal(await page.getByLabel("Where will you publish it?").inputValue(), "linkedin");
  assert.equal(await page.getByText("Advanced Options (Optional)", { exact: true }).evaluate(el => el.parentElement.open), false);
  const brief = "Gorl Lead has reached 1,000 subscribers. Announce our giveaway. No CTA.";
  await source.fill(brief);
  await page.getByLabel("Where will you publish it?").selectOption("instagram");
  await create.click();
  await page.locator("#outputs article").waitFor();
  assert.equal(await page.getByText("AI draft · Not independently fact-checked", { exact: true }).isVisible(), true);
  assert.deepEqual(payloads[0].selectedTypes, ["instagram"]);
  assert.equal(payloads[0].automaticSettings.length, 5);
  stage = "brand and explicit controls";
  await page.getByText("Advanced Options (Optional)", { exact: true }).click();
  await page.getByLabel("Brand name", { exact: true }).fill("Gorl Lead");
  await page.getByLabel("Target audience", { exact: true }).fill("Our community");
  await page.getByLabel("Brand colours", { exact: true }).fill("Cream, gold");
  await page.getByLabel(/^Tone/).selectOption("friendly");
  await page.getByLabel(/^Call to action/).first().selectOption("none");
  await page.getByLabel(/^Length/).selectOption("short");
  await create.click();
  await page.waitForFunction(() => !document.querySelector('fieldset[aria-busy="true"]'));
  assert.equal(payloads.at(-1).brandName, "Gorl Lead");
  assert.equal(payloads.at(-1).audience, "Our community");
  assert.equal(payloads.at(-1).tone, "friendly"); assert.equal(payloads.at(-1).ctaMode, "none");
  assert.deepEqual(payloads.at(-1).automaticSettings, ["sharpness", "presetTopic"]);
  stage = "14 formats";
  for (const box of await page.locator('fieldset input[type="checkbox"]').all()) await box.check();
  await create.click();
  await page.waitForFunction(() => document.querySelectorAll("#outputs article").length === 14);
  assert.equal(payloads.at(-1).selectedTypes.length, 14);
  stage = "edit refine undo export";
  const card = page.locator("#outputs article").first();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await card.getByLabel(/Edit .* body/).fill("Manually edited community update.");
  await card.getByRole("button", { name: "Apply edits" }).click();
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  assert.equal(await card.getByText("Manually edited", { exact: true }).count(), 0);
  await card.getByLabel("What would you like to change?").fill("Make it shorter.");
  await card.getByRole("button", { name: "Apply change" }).click();
  await card.getByText("AI refined", { exact: true }).waitFor();
  assert.equal(payloads.at(-1).refinement.action, "custom"); assert.equal(payloads.at(-1).refinement.instructions, "Make it shorter.");
  assert.equal(await page.locator("#outputs article").count(), 14);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download .txt" }).click();
  assert.match((await download).suggestedFilename(), /\.txt$/);
  await page.getByRole("button", { name: "Save all", exact: true }).click();
  stage = "failure recovery and cloud preferences";
  const bodyBefore = await card.innerText(); failNext = true;
  await create.click(); await page.getByRole("alert").filter({ hasText: "Synthetic provider failure" }).waitFor();
  assert.equal(await card.innerText(), bodyBefore); assert.equal(await source.inputValue(), brief);
  await page.waitForTimeout(1200);
  const saved = workspaceFromProfile(rows.get("image-test-account"), "image-test-account");
  assert.equal(saved.preferences.brandColors, "Cream, gold"); assert.equal(saved.preferences.length, "short");
  assert.ok(saved.store.saved.length > 0);
  assert.equal(rows.get("image-test-account").usage_events_json.filter(e => e.event_type === "text_generation").length, 4);
  stage = "responsive";
  await page.getByText("Advanced Options (Optional)", { exact: true }).click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.screenshot({ path: `${dir}/text-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  stage = "independent device and account isolation";
  const second = await newContext(), device = await second.newPage();
  await device.goto(base + "/image-studio-test"); await device.getByRole("button", { name: "Create Content", exact: true }).waitFor();
  assert.equal(await device.getByLabel("What would you like to create?").inputValue(), brief);
  await device.getByText("Advanced Options (Optional)", { exact: true }).click();
  assert.equal(await device.getByLabel("Brand colours", { exact: true }).inputValue(), "Cream, gold");
  await second.close();
  await page.goto(base + "/image-studio-test?account=two"); await create.waitFor();
  assert.equal(await source.inputValue(), "");
  assert.equal(await page.locator("#outputs article").count(), 0);
  assert.deepEqual(errors, []);
  const report = { passed: true, paidCalls: 0, mockedGenerations: payloads.length, formats: 14, viewports: [1440, 768, 390], cloud: "real contract and mocked storage", independentDevice: true, accountIsolation: true, edits: true, undo: true, refinement: true, export: true, failedGenerationPreservesDraft: true, pageErrors: errors };
  await writeFile(`${dir}/result.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) { await page?.screenshot({ path: `${dir}/failure.png`, fullPage: true }).catch(() => {}); console.error({ stage, error: error.message, errors }); throw error; }
finally { await context?.close(); await browser.close(); await rm(fixture, { recursive: true }); }
