import assert from "node:assert/strict";
import {mkdir,writeFile,rm} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const base=process.env.TEST_BASE_URL??"http://127.0.0.1:3228";
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const dir=new URL("../app/lite-local-test/",import.meta.url);
await mkdir(dir,{recursive:true});
await writeFile(new URL("page.tsx",dir),'import {StudioShell} from "@/components/studio-shell"; import {buildUsageSummary} from "@/lib/usage"; export default function Page(){return <StudioShell initialPlan="lite" authenticated accountId="synthetic-lite" initialUsage={buildUsageSummary("lite",0)}/>}',{flag:"wx"});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
await page.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base)return route.abort();
  if(url.pathname==="/api/workspace")return route.fulfill({json:{ok:true,revision:0,store:{recent:[],saved:[],drafts:[],folders:[]},brandProfiles:[],preferences:{brandName:"",audience:"",offer:"",writingStyle:"",contentGoal:""}}});
  if(url.pathname.startsWith("/api/"))return route.fulfill({json:{}});
  return route.continue();
});
try{
  await mkdir("/tmp/contentos-lite-browser",{recursive:true});
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    await page.goto(`${base}/pricing`);
    assert.deepEqual(await page.locator("section h2").allTextContents(),["Free","Lite, £5/month","Pro Creator, £9/month","Pro Studio, £39/month"]);
    assert.equal(await page.getByText("20 pooled text generations/refinements per month").count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`/tmp/contentos-lite-browser/pricing-${width}.png`,fullPage:true});
    await page.getByRole("button",{name:"Choose Lite"}).click();
    await page.waitForURL("**/signup?plan=lite");
    assert.equal(await page.evaluate(()=>localStorage.getItem("contentos_pending_checkout_plan")),"lite");
    await page.goto(`${base}/lite-local-test`);
    await page.getByText("Lite workspace",{exact:true}).waitFor({state:"attached"});
    await page.getByText("20 / 20 generations remaining",{exact:true}).waitFor();
    await page.getByLabel("Where will you publish it?").selectOption("linkedin");
    assert.equal(await page.getByLabel("Where will you publish it?").locator("option:disabled").count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`/tmp/contentos-lite-browser/studio-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({viewports:[1440,768,390],pricing:"pass",signupIntent:"pass",liteStudio:"pass",pageErrors:errors,paidCalls:0}));
}finally{await browser.close();await rm(dir,{recursive:true,force:true});}
