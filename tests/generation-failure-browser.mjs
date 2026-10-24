import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadTs} from './image-test-helpers.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3228';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const dir=process.env.TEST_ARTIFACT_DIR??'/tmp/contentos-generation-failure-browser';
await mkdir(dir,{recursive:true});
const fixtureRoute=new URL('../app/image-studio-test/',import.meta.url);
await mkdir(fixtureRoute,{recursive:true});
await writeFile(new URL('page.tsx',fixtureRoute),`"use client";
import {useState} from "react";
import {StudioShell} from "@/components/studio-shell";
import {buildUsageSummary} from "@/lib/usage";
export default function Page(){const [id,setId]=useState("image-test-account");return <><button data-testid="switch-account" onClick={()=>setId(id==="image-test-account"?"image-test-two":"image-test-account")}>Switch account</button><StudioShell initialPlan="pro_studio" accountId={id} authenticated initialUsage={buildUsageSummary("pro_studio",0)} /></>}` ,{flag:'wx'});
const {normalizeGenerationRequest,parseGenerationOutput}=loadTs('lib/generation-contract.ts');
const {workspaceFromProfile,updateWorkspaceProfile}=loadTs('lib/workspace-contract.ts');
const {reserveGenerationInProfile,completeGenerationInProfile,failGenerationInProfile}=loadTs('lib/generation-reservation.ts');
const rows=new Map(['image-test-account','image-test-two'].map(id=>[id,{id,email:id+'@example.invalid',plan:'pro_studio',subscription_status:'active'}]));
const original='Write a post about plan.com.';
const latest='why is contentos.co not generating hashtags under posts like it was before?';
// Neutral synthetic earlier prose; the original failed provider body is unavailable.
const earlier='An earlier draft about plan.com.';
const requests=[],dispatches=[],settlements=[],errors=[];
let mode='accept',hold,release;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
 if(!url.pathname.startsWith('/api/'))return route.continue();
 const id=req.headers()['x-contentos-account'],row=rows.get(id);
 if(!row)return route.fulfill({status:401,json:{error:'Synthetic account required'}});
 let input,reservation;
 try{
  if(url.pathname==='/api/workspace'){
   if(req.method()==='PUT')rows.set(id,updateWorkspaceProfile(row,id,req.postDataJSON()).data);
   return route.fulfill({json:workspaceFromProfile(rows.get(id),id)});
  }
  if(url.pathname==='/api/generate'){
   input=normalizeGenerationRequest(req.postDataJSON());requests.push(input);
   const reserved=reserveGenerationInProfile(row,id,input.requestId,input);rows.set(id,reserved.data);reservation=reserved.result;
   if(reservation.status==='replay')return route.fulfill({json:reservation.result});
   const outcome=mode;dispatches.push(input.requestId);
   if(outcome==='held')await hold;
   settlements.push(input.requestId);
   const body=outcome==='reject'||outcome==='held'?'We started this business in our attic three years ago.':input.source===original?earlier:'A question about missing caption hashtags.';
   const raw={title:input.source===original?'Earlier topic':'Latest topic',summary:'A draft for review.',sections:input.selectedTypes.map(type=>({id:type,type,title:'Caption',platform:type,body,items:[],cta:''}))};
   const output=parseGenerationOutput(JSON.stringify(raw),input);
   const done=completeGenerationInProfile(rows.get(id),id,input.requestId,reservation.fingerprint,output);rows.set(id,done.data);
   return route.fulfill({json:done.result});
  }
  return route.fulfill({json:{}});
 }catch(e){
  if(reservation?.status==='reserved'){
   rows.set(id,failGenerationInProfile(rows.get(id),id,input.requestId,reservation.fingerprint).data);
   return route.fulfill({status:502,json:{code:'unsupported_business_facts',error:'The latest result was rejected. No successful generation was recorded.'}});
  }
  return route.fulfill({status:e.status??500,json:{code:e.code,error:e.message,revision:e.revision}});
 }
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
let stage='success';
const failure=page.getByTestId('generation-failure');
try{
 await page.goto(base+'/image-studio-test');
 await page.getByLabel('What would you like to create?').fill(original);
 await page.getByRole('button',{name:'Create Content',exact:true}).click();
 await page.getByTestId('post-caption').waitFor();
 await page.getByRole('button',{name:'Save all',exact:true}).click();await page.waitForTimeout(1000);
 const before=structuredClone(workspaceFromProfile(rows.get('image-test-account'),'image-test-account').store.saved);
 assert.equal(before.length,1);
 stage='validation failure';mode='reject';
 await page.getByLabel('What would you like to create?').fill(latest);
 await page.getByRole('button',{name:'Create Content',exact:true}).click();await failure.waitFor();
 assert.match(await failure.textContent(),/Latest generation failed/);assert.ok((await failure.textContent()).includes(latest));
 assert.equal(await page.locator('#outputs article').count(),0);
 assert.equal(await page.locator('#outputs').getByRole('button',{name:/Copy|Save|Export|Download/}).count(),0);
 assert.doesNotMatch(await page.locator('#outputs').textContent(),/attic|An earlier draft/);
 await page.waitForTimeout(1000);assert.equal(dispatches.length,2,'no automatic retry');
 assert.deepEqual(workspaceFromProfile(rows.get('image-test-account'),'image-test-account').store.saved,before);
 assert.equal(rows.get('image-test-account').usage_events_json.length,1);
 assert.equal(rows.get('image-test-account').generation_history_json.length,1);
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});await failure.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width<1024)assert.equal(await page.getByRole('button',{name:'Save earlier',exact:true}).isDisabled(),true);
  await page.screenshot({path:dir+`/failed-${width}.png`});
 }
 stage='reveal edit copy export earlier draft';
 await page.getByRole('button',{name:'Show earlier draft',exact:true}).click();
 assert.ok((await page.getByTestId('earlier-generation-source').textContent()).includes(original));
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  await page.getByRole('button',{name:'Copy earlier draft',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),earlier);
  assert.ok(await failure.isVisible(),'copy cannot dismiss failure context');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#outputs article').scrollIntoViewIfNeeded();await page.screenshot({path:dir+`/earlier-${width}.png`});
 }
 await page.locator('#outputs article').getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel(/Edit .* body/).fill('An edited earlier draft.');await page.getByRole('button',{name:'Apply edits'}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export earlier draft .txt',exact:true}).click();await(await download).saveAs(dir+'/earlier.txt');
 assert.equal(await readFile(dir+'/earlier.txt','utf8'),'An edited earlier draft.');
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();
 await page.waitForTimeout(1000);assert.deepEqual(workspaceFromProfile(rows.get('image-test-account'),'image-test-account').store.saved,before);
 stage='duplicate failed request and deliberate retry';
 await page.getByRole('button',{name:'Create Content',exact:true}).click();await page.getByRole('button',{name:'Show earlier draft',exact:true}).waitFor();
 assert.equal(requests[2].requestId,requests[1].requestId);assert.equal(dispatches.length,2);
 mode='accept';await page.getByRole('button',{name:'Try latest request again',exact:true}).click();await page.getByTestId('post-caption').waitFor();
 assert.notEqual(requests[3].requestId,requests[1].requestId);assert.equal(requests[3].source,latest);
 assert.equal(await failure.count(),0);assert.equal(dispatches.length,3);assert.equal(rows.get('image-test-account').usage_events_json.length,2);
 assert.deepEqual(workspaceFromProfile(rows.get('image-test-account'),'image-test-account').store.saved,before);
 stage='failed refinement';mode='reject';
 await page.getByLabel('What would you like to change?').fill('Make it warmer.');await page.getByRole('button',{name:'Apply change'}).click();await failure.waitFor();
 assert.match(await failure.textContent(),/Latest refinement failed/);assert.match(await failure.textContent(),/Make it warmer/);
 assert.equal(rows.get('image-test-account').usage_events_json.length,2);
 stage='account switching and late response';
 await page.getByTestId('switch-account').click();await page.waitForTimeout(700);
 assert.equal(await failure.count(),0);assert.equal(await page.getByTestId('post-caption').count(),0);assert.equal(await page.getByLabel('What would you like to create?').inputValue(),'');
 mode='held';hold=new Promise(resolve=>{release=resolve;});
 await page.getByLabel('What would you like to create?').fill('A synthetic account two prompt.');await page.getByRole('button',{name:'Create Content',exact:true}).click();
 await page.waitForTimeout(300);assert.equal(dispatches.length,5);
 await page.getByTestId('switch-account').click();await page.waitForTimeout(700);
 await page.getByTestId('switch-account').click();await page.waitForTimeout(700);
 release();await page.waitForTimeout(700);assert.equal(await failure.count(),0,'response from an earlier account epoch is ignored');
 assert.equal(await page.getByTestId('post-caption').count(),0);assert.equal(await page.getByRole('button',{name:'Try latest request again',exact:true}).count(),0);
 assert.deepEqual(errors,[]);assert.equal(dispatches.length,settlements.length);
 const report={passed:true,widths:[1440,768,390],paidCalls:0,provider:'mocked only',failureAndEarlierDraftSeparated:true,savedContentPreserved:true,copyEditUndoExportEarlier:true,manualRetry:true,failedReplayNoDispatch:true,refinementFailure:true,accountSwitchAndLateResponse:true,successfulUsage:2,mockedDispatches:dispatches.length,pageErrors:errors};
 await writeFile(dir+'/result.json',JSON.stringify(report,null,2));console.log(report);
}catch(e){await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});console.error({stage,error:e.message});throw e;}
finally{release?.();await context.close();await browser.close();await rm(fixtureRoute,{recursive:true});}
