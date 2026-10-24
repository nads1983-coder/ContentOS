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
const brandScenario = process.env.TEST_BRAND_CONTEXT === "1";
if (brandScenario) {
  const row = rows.get("image-test-account"), snapshot = workspaceFromProfile(row, row.id);
  const { request } = JSON.parse(await readFile(new URL("fixtures/codex-brand-contamination.json", import.meta.url), "utf8"));
  Object.assign(snapshot.preferences, Object.fromEntries(["brandName", "audience", "offer", "writingStyle", "contentGoal"].map(key => [key, request[key]])));
  rows.set(row.id, updateWorkspaceProfile(row, row.id, { revision: snapshot.revision, store: snapshot.store, preferences: snapshot.preferences }).data);
}
const errors = [], requests = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const dir = process.env.TEST_ARTIFACT_DIR ?? "/tmp/contentos-post-format";
await mkdir(dir, { recursive: true });
const caption = brandScenario ? "A coding idea worth exploring.\n\nTry a fresh perspective with Codex.\n\nWhat would you build?\n\n#Codex #CodingIdeas" : "A little room to think.\n\nTry putting one idea on paper.\n\nWhat would you write?\n\n#Planning #Ideas";
const opening = brandScenario ? "A coding idea worth exploring." : "A little room to think.";
const middle = brandScenario ? "Try a fresh perspective with Codex." : "Try putting one idea on paper.";
const cta = brandScenario ? "What would you build?" : "What would you write?";
async function newContext() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
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
        const input = normalizeGenerationRequest(req.postDataJSON()); requests.push(input);
        const reserved = reserveGenerationInProfile(row, id, input.requestId, input); rows.set(id, reserved.data);
        if (reserved.result.status === "replay") return route.fulfill({ json: reserved.result.result });
        const output = parseGenerationOutput(JSON.stringify({ title: "Planning ideas", summary: "A starting point.", sections: [{ id: "instagram", type: "instagram", title: "Planning ideas", platform: "Instagram",
          body: input.refinement ? `One idea is enough to begin.\n\n${middle}\n\n${cta}` : `**${opening}**\n\n${middle} ${middle}\n\n${cta}`,
          items: brandScenario ? ["#Codex", "#GorlLead", "#CodingIdeas", "#FreeCompetition"] : ["#Planning", "#Ideas", "#Planning"], cta }] }), input);
        const completed = completeGenerationInProfile(rows.get(id), id, input.requestId, reserved.result.fingerprint, output); rows.set(id, completed.data);
        return route.fulfill({ json: completed.result });
      }
      return route.fulfill({ json: {} });
    } catch (e) { return route.fulfill({ status: e.status ?? 500, json: { error: e.message, revision: e.revision } }); }
  });
  return context;
}
let context, page, stage = "generation";
try {
  context = await newContext(); page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await page.goto(base + "/image-studio-test");
  await page.getByRole("button", { name: "Create Content", exact: true }).waitFor();
  await page.getByLabel("What would you like to create?").fill(brandScenario ? "Write an Instagram post about using Codex to explore coding ideas." : "Share planning ideas on Instagram.");
  await page.getByLabel("Where will you publish it?").selectOption("instagram");
  await page.getByRole("button", { name: "Create Content", exact: true }).click();
  const card = page.locator("#outputs article").first(), post = card.getByTestId("post-caption");
  await post.waitFor(); assert.equal(await post.textContent(), caption);
  if (brandScenario) {
    assert.equal(requests[0].brandName,"Gorl Lead");
    assert.doesNotMatch(await post.textContent(),/Gorl.?Lead|competition/i);
  }
  stage = "real clipboard and paste";
  await card.getByRole("button", { name: "Copy", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText()); assert.equal(copied, caption);
  await page.evaluate(() => {
    const target = document.createElement("textarea"); target.id = "paste-check"; target.setAttribute("aria-label", "Offline caption paste target"); document.body.append(target);
  });
  await page.getByLabel("Offline caption paste target").focus(); await page.keyboard.press("ControlOrMeta+V");
  assert.equal(await page.getByLabel("Offline caption paste target").inputValue(), caption);
  await page.evaluate(() => document.getElementById("paste-check").remove());
  stage = "formatter preview copy and download";
  await page.getByText("Text formatter", { exact: true }).click();
  const formatter = page.locator("#formatter");
  await formatter.getByRole("button", { name: "Instagram", exact: true }).click();
  await formatter.getByPlaceholder("Write or paste platform copy here.").fill(copied);
  assert.equal(await formatter.locator("p.whitespace-pre-wrap").textContent(), caption);
  await formatter.getByRole("button", { name: "Copy", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), caption);
  const file = page.waitForEvent("download"); await formatter.getByRole("button", { name: "Download", exact: true }).click();
  await (await file).saveAs(`${dir}/formatter.txt`); assert.equal(await readFile(`${dir}/formatter.txt`, "utf8"), caption);
  stage = "edit undo refine";
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await card.getByLabel(/Edit .* body/).fill("First thought.\n\nSecond thought.\nA deliberate single line.");
  await card.getByRole("button", { name: "Apply edits" }).click();
  await card.getByRole("button", { name: "Copy", exact: true }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^First thought\.\n\nSecond thought\.\nA deliberate single line\./);
  await page.getByRole("button", { name: "Undo edit", exact: true }).click(); assert.equal(await post.textContent(), caption);
  await card.getByLabel("What would you like to change?").fill("Make the opening more direct. Keep paragraph breaks.");
  await card.getByRole("button", { name: "Apply change" }).click(); await card.getByText("AI refined", { exact: true }).waitFor();
  const refined = caption.replace(opening, "One idea is enough to begin."); assert.equal(await post.textContent(), refined);
  stage = "save export and restoration";
  await page.getByRole("button", { name: "Save all", exact: true }).click();
  const exported = page.waitForEvent("download"); await page.getByRole("button", { name: "Download .txt", exact: true }).click();
  await (await exported).saveAs(`${dir}/caption.txt`); assert.equal(await readFile(`${dir}/caption.txt`, "utf8"), refined);
  await page.waitForTimeout(1200);
  const restored = workspaceFromProfile(rows.get("image-test-account"), "image-test-account");
  assert.ok(restored.store.saved.length); assert.equal(restored.store.saved[0].sections[0].body, `One idea is enough to begin.\n\n${middle}`);
  if (brandScenario) assert.equal(restored.preferences.offer, "Free competition. Entries close Friday.", "Saved preferences are preserved, not rewritten by request scoping");
  stage = "responsive";
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await post.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
    const bounds = await post.boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height < 910, "caption can be fully viewed above mobile controls");
    assert.equal(await post.textContent(), refined); assert.equal(await post.evaluate(el => getComputedStyle(el).whiteSpace), "pre-wrap");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${dir}/caption-${width}.png` });
    await post.screenshot({ path: `${dir}/post-${width}.png` });
    await card.getByRole("button", { name: "Copy", exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), refined);
    await page.waitForTimeout(1500);
  }
  const second = await newContext(), device = await second.newPage();
  await device.goto(base + "/image-studio-test"); await device.getByTestId("post-caption").waitFor();
  assert.equal(await device.getByTestId("post-caption").textContent(), refined); await second.close();
  await page.goto(base + "/image-studio-test?account=two"); await page.getByRole("button", { name: "Create Content", exact: true }).waitFor();
  assert.equal(await page.getByTestId("post-caption").count(), 0);
  assert.equal(rows.get("image-test-account").usage_events_json.filter(e => e.event_type === "text_generation").length, 2);
  assert.deepEqual(errors, []);
  const report = { passed: true, brandScenario, paidCalls: 0, mockedGenerations: requests.length, clipboardAndOfflinePaste: true, actualInstagramPaste: "Not tested: offline-only scope", saving: "actual contract with mocked database", formatter: true, editUndoRefineExport: true, deviceRestore: true, accountIsolation: true, widths: [1440, 768, 390], pageErrors: errors };
  await writeFile(`${dir}/result.json`, JSON.stringify(report, null, 2)); console.log(report);
} catch (error) { await page?.screenshot({ path: `${dir}/failure.png`, fullPage: true }).catch(() => {}); console.error({ stage, error: error.message }); throw error; }
finally { await context?.close(); await browser.close(); await rm(fixture, { recursive: true }); }
