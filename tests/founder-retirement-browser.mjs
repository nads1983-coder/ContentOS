import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:"playwright");
for(const file of [".env",".env.local",".env.production",".env.production.local"])assert.equal(existsSync(file),false,"Browser fixture requires a credential-free checkout");
const browser=await chromium.launch({headless:true}),results=[],artifact="/tmp/contentos-retirement-browser";
mkdirSync(artifact,{recursive:true});
try {
 for(const retired of [false,true]){
  const port=retired?3225:3224,base=`http://127.0.0.1:${port}`;
  const receipt={version:1,launchApproval:"explicit-owner-approval",verification:"passed",approvedRelease:"a".repeat(40),verifiedRelease:"a".repeat(40),productionDeployment:"dpl_synthetic",
   verifiedAt:"2026-01-01T12:00:00.000Z",retiredAt:"2026-01-01T12:01:00.000Z"};
  const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)],{
   env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:"production",BETTER_AUTH_URL:base,NEXT_PUBLIC_APP_URL:base,NEXT_PUBLIC_SITE_URL:base,
    ...(retired?{FOUNDER_RETIREMENT_RECEIPT:JSON.stringify(receipt)}:{})},stdio:"ignore"});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await context.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  try {
   let ready=false;
   for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error("Local test server exited");try{if((await fetch(`${base}/founder`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
   assert.equal(ready,true);
   for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});await page.goto(`${base}/founder`);
    if(retired){assert.equal(await page.getByRole("heading",{name:"The Founding 100 offer has closed",exact:true}).count(),1);assert.equal(await page.getByRole("link",{name:"Claim Founder Access",exact:true}).count(),0);}
    else assert.equal(await page.getByRole("link",{name:"Claim Founder Access",exact:true}).count(),2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`${artifact}/${retired?"retired":"active"}-${width}.png`,fullPage:true});
   }
   for(const path of ["/","/pricing"]){await page.goto(base+path);assert.equal(await page.getByText("Limited founder launch",{exact:true}).count(),retired?0:1);}
   if(retired){
    await page.goto(`${base}/signup?plan=pro_creator&founder=1`);assert.equal(new URL(page.url()).pathname,"/founder");
    await page.goto(`${base}/founder/checkout`);assert.equal(await page.getByRole("heading",{name:"The Founding 100 offer has closed",exact:true}).count(),1);
    const response=await context.request.post(`${base}/api/billing/checkout`,{headers:{Origin:base},data:{plan:"pro_creator",founderOffer:true}});
    assert.equal(response.status(),410);assert.equal((await response.json()).code,"founder_offer_retired");
   }
   assert.deepEqual(errors,[]);results.push({state:retired?"retired_synthetic_receipt":"active_default",widths:[1440,768,390],unexpectedPageErrors:errors.length});
  }finally{await context.close();if(server.exitCode===null){const closed=once(server,"exit");server.kill("SIGTERM");await closed;}}
 }
 writeFileSync(`${artifact}/results.json`,JSON.stringify({status:"PASS",results,productionWrites:0,providerCalls:0},null,2)+"\n");
 console.log(JSON.stringify({status:"PASS",results,artifact,productionWrites:0,providerCalls:0}));
}finally{await browser.close();}
