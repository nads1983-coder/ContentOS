import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:"playwright");
for(const f of [".env",".env.local",".env.production",".env.production.local"])assert.equal(existsSync(f),false);
const base="http://127.0.0.1:3226",artifact="/tmp/contentos-restricted-release-browser";
const mode=process.env.CONTENTOS_TEXT_GENERATION_MODE||"paused";
assert.ok(["paused","pilot"].includes(mode));
mkdirSync(artifact,{recursive:true});
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3226"],{
 env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:"production",BETTER_AUTH_URL:base,NEXT_PUBLIC_APP_URL:base,
  NEXT_PUBLIC_SITE_URL:base,CONTENTOS_TEXT_GENERATION_MODE:mode},stdio:"ignore"});
let browser;
try{
 let ready=false;
 for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error("Local server exited");try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready);browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];let calls=0;
 page.on("pageerror",e=>errors.push(e.message));
 await context.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await page.route("**/api/generate",route=>{calls++;return route.abort();});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await page.goto(`${base}/studio`);
  await page.getByLabel("What would you like to create?").fill("Synthetic manual content, no provider request.");
  assert.ok(await page.getByRole("button",{name:"Generate content pack",exact:true}).isDisabled());
  assert.match(await page.getByRole("complementary",{name:"Service availability"}).innerText(),mode==="pilot"?/AI text generation is available only to approved pilot accounts/:/AI text generation is temporarily unavailable/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${artifact}/studio-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 const card=page.locator("#outputs article").first();
 await card.getByRole("button",{name:"Edit",exact:true}).click();
 await card.getByLabel(/Edit .* body/).fill("Synthetic manually edited content remains available.");
 await card.getByRole("button",{name:"Apply edits",exact:true}).click();
 assert.ok(await card.getByText("Synthetic manually edited content remains available.",{exact:true}).count());
 await page.getByRole("button",{name:"Undo edit",exact:true}).click();
 assert.equal(await card.getByText("Synthetic manually edited content remains available.",{exact:true}).count(),0);
 await card.getByRole("button",{name:"Refine with AI",exact:true}).click();
 await page.getByRole("alert").filter({hasText:"AI text generation is temporarily unavailable"}).waitFor();
 await page.getByRole("button",{name:"Regenerate current set",exact:true}).click();
 assert.equal(calls,0);
 const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download .txt",exact:true}).click();
 assert.ok((await download).suggestedFilename().endsWith(".txt"));
 await page.waitForTimeout(900);await page.reload();
 assert.equal(await page.getByLabel("What would you like to create?").inputValue(),"Synthetic manual content, no provider request.");
 for(const path of ["/","/pricing","/founder"]){await page.goto(base+path);assert.ok(await page.getByRole("complementary",{name:"Service availability"}).isVisible());}
 assert.equal(await page.getByRole("link",{name:"Claim Founder Access",exact:true}).count(),2);
 const unauth=await context.request.post(`${base}/api/generate`,{headers:{Origin:base},data:{}});assert.equal(unauth.status(),401);
 assert.deepEqual(errors,[]);assert.equal(calls,0);
 const result={status:"PASS",mode,widths:[1440,768,390],checks:["restricted generation","no refinement/regeneration HTTP calls","manual editing and undo","text export","draft reload","public availability notices","Founder ACTIVE","direct anonymous auth retained"],pageErrors:0,providerCalls:0,productionChanges:0};
 writeFileSync(`${artifact}/results.json`,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
}finally{await browser?.close();if(server.exitCode===null){const exit=once(server,"exit");server.kill("SIGTERM");await exit;}}
