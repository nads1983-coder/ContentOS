import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createImageHarness, PNG, profile } from "./image-test-helpers.mjs";

// Local-only fixture route mounts the actual StudioShell with synthetic account props.
// It must never be deployed. All API requests are intercepted; the provider is mocked.
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.TEST_BASE_URL??"http://127.0.0.1:3214";
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw new Error("Local fixture only");
const fixtureDirectory=new URL("../app/image-studio-test/",import.meta.url);
await mkdir(fixtureDirectory,{recursive:true});
await writeFile(new URL("page.tsx",fixtureDirectory),await readFile(new URL("./fixtures/image-studio-page.tsx.fixture",import.meta.url)),{flag:"wx"});
const artifacts=process.env.TEST_ARTIFACT_DIR??"/tmp/contentos-image-studio-evidence";
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const context=await browser.newContext({acceptDownloads:true});
const page=await context.newPage();const errors=[];
page.on("pageerror",e=>errors.push(e.message));
const h=createImageHarness();h.userId="image-test-account";h.rows.set(h.userId,profile({id:h.userId}));
const payloads=[],responses=[];let revision=0;
const snapshot=()=>({revision:String(revision),store:{drafts:[],recent:[],saved:[]},brandProfiles:[],preferences:{brandName:"Mira",audience:"Busy professionals",offer:"",writingStyle:"Warm, thoughtful",contentGoal:""}});
await page.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base)return route.abort();
  if(url.pathname==="/api/workspace"){
    if(route.request().method()==="PUT")revision++;
    return route.fulfill({json:snapshot()});
  }
  if(url.pathname==="/api/generate-image"){
    const payload=route.request().postDataJSON();payloads.push(payload);
    const result=await h.post(payload,{account:route.request().headers()["x-contentos-account"]});
    responses.push({status:result.response.status,code:result.body.code,error:result.body.error});
    return route.fulfill({status:result.response.status,json:result.body});
  }
  if(url.pathname.startsWith("/api/"))return route.fulfill({json:{}});
  return route.continue();
});
try{
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(`${base}/image-studio-test`);
  await page.getByLabel("Where will you publish it?").selectOption("instagram");
  await page.getByRole("button",{name:"Image Studio",exact:true}).click();
  const dialog=page.getByRole("dialog");
  assert.equal(await dialog.getByText("Instagram",{exact:true}).first().textContent(),"Instagram");
  assert.equal(await dialog.locator("summary").evaluate(el=>el.parentElement.open),false);
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
  await page.keyboard.press("Shift+Tab");
  // Native dialogs may yield to browser chrome, but never background controls.
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)||document.activeElement===document.body),true);
  await page.keyboard.press("Tab");
  assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,"Keyboard focus returns to the modal");
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(),false);
  await page.getByRole("button",{name:"Image Studio",exact:true}).click();
  await dialog.locator("summary").filter({hasText:"Advanced Options (Optional)"}).click();
  assert.equal(await dialog.getByLabel("Image platform",{exact:true}).inputValue(),"Instagram");
  await dialog.getByLabel("Image platform",{exact:true}).selectOption("Pinterest");
  assert.equal(await dialog.locator("p").first().textContent(),"Pinterest");
  await dialog.getByLabel("Image content").fill("A quiet ritual.\n\nMake space for a slower morning. #Beauty #Care");
  await dialog.getByLabel("What image would you like?").fill("A luxury beauty graphic using cream and gold.\nHeadline: A quiet ritual");
  await dialog.getByLabel("Image type",{exact:true}).selectOption("graphic");
  await dialog.getByLabel("Style",{exact:true}).selectOption("luxury");
  await dialog.getByRole("button",{name:"Green",exact:true}).click();
  await dialog.getByLabel("Custom HEX").fill("#badhex");
  assert.equal(await dialog.getByRole("button",{name:"Add custom colour"}).isDisabled(),true);
  await dialog.getByLabel("Custom HEX").fill("#fff");
  await dialog.getByRole("button",{name:"Add custom colour"}).click();
  await dialog.getByRole("button",{name:"Text",exact:true}).click();
  await dialog.getByRole("button",{name:"Generate visual",exact:true}).click();
  await dialog.getByRole("button",{name:"Download PNG"}).waitFor();
  assert.equal(h.calls.filter(c=>c==="provider").length,0);
  assert.equal(payloads[0].mode,"text");assert.match(payloads[0].outputText,/#Beauty/);
  assert.equal(payloads[0].platform,"Pinterest");assert.equal(payloads[0].contentType,"Pinterest");
  assert.deepEqual(payloads[0].appearance,{type:"graphic",style:"luxury",colours:["#176d51","#ffffff"]});
  await dialog.getByLabel("Headline",{exact:true}).fill("Space to slow down");
  await dialog.getByRole("button",{name:"Apply edits",exact:true}).click();
  assert.equal(payloads.length,1,"Edits must not dispatch generation");
  await dialog.getByRole("button",{name:"Undo design edit"}).click();
  assert.equal(await dialog.getByLabel("Headline",{exact:true}).inputValue(),"A quiet ritual");
  const download=page.waitForEvent("download");await dialog.getByRole("button",{name:"Download PNG"}).click();
  const downloaded=await download;assert.match(downloaded.suggestedFilename(),/\.png$/);
  await downloaded.saveAs(`${artifacts}/text-design.png`);
  const png=await readFile(`${artifacts}/text-design.png`);
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1080]);
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    await dialog.screenshot({path:`${artifacts}/studio-${width}.png`});
    assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false,`${width}: dialog overflow`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.setViewportSize({width:1440,height:1100});
  for(const [mode,label] of [["image","Image"],["mixed","Text + Image"],["auto","Auto"]]){
    await dialog.getByLabel("What image would you like?").fill(mode==="image"?"Editorial photography of a quiet morning, no text":"Bold technology announcement in white and teal");
    await dialog.getByRole("button",{name:label,exact:true}).click();
    await dialog.getByRole("button",{name:"Regenerate image"}).click();
    await page.waitForFunction(()=>!document.querySelector('dialog button[disabled] svg.animate-spin'));
    await dialog.getByRole("button",{name:"Regenerate image"}).isEnabled();
    await page.waitForTimeout(300);
    const img=await dialog.locator('img[alt^="Generated visual"]').getAttribute("src");
    const svg=decodeURIComponent(img.split(",").slice(1).join(","));
    assert.doesNotMatch(svg,/>[^<]*#(?:Beauty|Care)/);
    if(mode==="image")assert.doesNotMatch(svg,/<text|<tspan/);
    else assert.match(svg,/<image/);
  }
  assert.equal(h.calls.filter(c=>c==="provider").length,3);
  const before=payloads.length;
  await page.reload();
  await page.getByRole("button",{name:"Image Studio",exact:true}).click();
  await page.getByRole("button",{name:/Open saved design/}).first().click();
  await page.getByRole("button",{name:"Download PNG"}).waitFor();
  assert.equal(await dialog.locator("p").first().textContent(),"Pinterest","Saved designs restore their actual platform, not the composer default");
  assert.equal(payloads.length,before,"Restoring a saved design must never call the provider");
  h.userId="image-test-two";h.rows.set(h.userId,profile({id:h.userId}));
  await page.goto(`${base}/image-studio-test?account=two`);
  await page.getByRole("button",{name:"Image Studio",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:/Open saved design/}).count(),0,"Different account cannot see device designs");
  // Additional exports use the second synthetic account's own quota; never reset
  // attempt history to evade the real six-attempt rolling protection.
  await dialog.locator("summary").filter({hasText:"Advanced Options (Optional)"}).click();
  await dialog.getByLabel("What image would you like?").fill("A simple graphic. Headline: Room for ideas");
  await dialog.getByRole("button",{name:"Text",exact:true}).click();
  for(const [format,width,height] of [["portrait",1080,1350],["vertical",1080,1920],["landscape",1536,864]]){
    await dialog.getByLabel("Format",{exact:true}).selectOption(format);
    await dialog.getByRole("button",{name:format==="portrait"?"Generate visual":"Regenerate image",exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('dialog button[disabled] svg.animate-spin'));
    await dialog.getByRole("button",{name:"Download PNG"}).waitFor();
    const exported=page.waitForEvent("download");await dialog.getByRole("button",{name:"Download PNG"}).click();
    const file=await exported;await file.saveAs(`${artifacts}/${format}.png`);
    const bytes=await readFile(`${artifacts}/${format}.png`);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[width,height]);
  }
  assert.equal(h.calls.filter(c=>c==="provider").length,3,"All four Text design exports use no provider");
  assert.deepEqual(errors,[]);
  const result={passed:true,modes:4,viewports:[1440,768,390],mockedRequests:payloads.length,mockedProviderCalls:3,paidCalls:0,editing:true,undo:true,pngExport:true,exactPngDimensions:4,keyboardModal:true,deviceReload:true,accountIsolation:true,pageErrors:errors};
  await writeFile(`${artifacts}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:`${artifacts}/failure.png`,fullPage:true}).catch(()=>{});console.error({responses,errors});throw error;}
finally{await context.close();await browser.close();await rm(fixtureDirectory,{recursive:true});}
