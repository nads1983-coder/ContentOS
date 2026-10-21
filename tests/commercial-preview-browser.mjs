import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { loadTs } from "./image-test-helpers.mjs";
const base=process.env.TEST_BASE_URL;
assert.match(base,/^https:\/\/content-[a-z0-9-]+\.vercel\.app$/);
assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH,"br-divine-term-b2rihbxv");
assert.ok(new URL(process.env.DATABASE_URL).hostname.startsWith("ep-proud-field-b291xbnc"));
for(const key of ["OPENAI_API_KEY","STRIPE_SECRET_KEY","RESEND_API_KEY"])assert.ok(!process.env[key]);
const {users}=JSON.parse(readFileSync(process.env.PREVIEW_ACCOUNTS_FILE,"utf8"));
const user=users.find(u=>u.plan==="pro_studio");assert.match(user.email,/^premium-preview-.*@example\.invalid$/);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
assert.ok(process.env.VERCEL_OIDC_TOKEN);
const headers={"x-vercel-trusted-oidc-idp-token":process.env.VERCEL_OIDC_TOKEN};
await context.route(base+"/**",route=>route.continue({headers:{...route.request().headers(),...headers}}));
const page=await context.newPage(),errors=[],checks=[];
page.on("pageerror",e=>errors.push(e.message));
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const out=process.env.TEST_ARTIFACT_DIR??"/tmp/contentos-commercial-preview";mkdirSync(out,{recursive:true});
const original=(await pool.query("SELECT opening_microgbp FROM contentos_app.ai_budget_configuration")).rows[0].opening_microgbp;
const tokenHeaders={...headers,origin:base,"X-ContentOS-Account":user.id};
try {
  const unauthenticated=await fetch(base+"/pricing",{redirect:"manual"});assert.ok([302,307,401,403].includes(unauthenticated.status));
  checks.push("SSO blocks unauthenticated public access");
  await page.goto(base+"/pricing");await page.getByRole("heading",{name:/^Pro Studio, /}).waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), /Lifetime Access|£49|one-time text credits/);
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${out}/pricing-${width}.png`});
  }
  assert.equal((await context.request.post(base+"/api/billing/lifetime-checkout",{headers:tokenHeaders,data:{}})).status(),404);
  checks.push("subscription pricing is responsive; removed Lifetime checkout returns 404");
  await page.goto(base+"/login");await page.getByLabel("Email",{exact:true}).fill(user.email);await page.getByLabel("Password",{exact:true}).fill(user.password);
  await page.getByRole("button",{name:"Log in",exact:true}).click();await page.waitForURL("**/dashboard");
  assert.match(await page.locator("body").innerText(),/Pro Studio/);
  assert.doesNotMatch(await page.locator("body").innerText(),/Lifetime Access|Credits do not renew/);
  const admin=await context.request.get(base+"/admin/ai-budget",{headers});assert.equal(admin.status(),404);
  checks.push("synthetic subscriber login/dashboard shows recurring allowance; private financial dashboard refuses ordinary member");
  const initial=Number((await pool.query("SELECT count(*) AS n FROM contentos_app.ai_spend_requests WHERE account_id=$1",[user.id])).rows[0].n);
  const types=loadTs("lib/content-config.ts").contentTypes.map(t=>t.id);
  const body={source:"Synthetic Preview stationery notebook with a plain blue cover. No measured outcomes. No CTA.",selectedTypes:types,requestId:crypto.randomUUID()};
  await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=30000000 WHERE singleton=true");
  const refused=await context.request.post(base+"/api/generate",{headers:tokenHeaders,data:body});assert.equal(refused.status(),503);
  assert.equal((await refused.json()).code,"global_capacity_exhausted");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM contentos_app.ai_spend_requests WHERE account_id=$1",[user.id])).rows[0].n),initial);
  await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=$1 WHERE singleton=true",[original]);
  const accepted=await context.request.post(base+"/api/generate",{headers:tokenHeaders,data:body});const pack=await accepted.json();assert.equal(accepted.status(),200,JSON.stringify(pack));assert.equal(pack.sections.length,14);
  const replay=await context.request.post(base+"/api/generate",{headers:tokenHeaders,data:body});assert.equal(replay.status(),200);assert.equal((await replay.json()).id,pack.id);
  const states=(await pool.query("SELECT state,delivered,accounted_microgbp FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND request_id=$2",[user.id,body.requestId])).rows;
  assert.equal(states.length,1);assert.equal(states[0].delivered,true);assert.equal(states[0].accounted_microgbp,"0");
  checks.push("full capacity refuses before reservation; restored isolated capacity permits 14-format fixture once, replay unchanged, zero provider spend");
  await page.goto(base+"/studio");await page.getByRole("button",{name:"Generate content pack",exact:true}).waitFor();
  const workspace=await context.request.get(base+"/api/workspace",{headers:tokenHeaders});assert.equal(workspace.status(),200);assert.ok((await workspace.text()).includes(pack.id));
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${out}/studio-${width}.png`});
  }
  checks.push("Studio and account-scoped saved history remain available; desktop/tablet/mobile fit");
  assert.deepEqual(errors,[]);
  const report={result:"PASS",checks,paidCalls:0,liveStripeCalls:0,viewports:[1440,768,390],errors};writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} catch(error){await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}
finally {await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=$1 WHERE singleton=true",[original]);await pool.end();await browser.close();}
