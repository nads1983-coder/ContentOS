import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadTs} from './image-test-helpers.mjs';
const base='http://127.0.0.1:3238', fixture=new URL('../app/image-studio-test/',import.meta.url);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const {normalizeGenerationRequest,parseGenerationOutput}=loadTs('lib/generation-contract.ts');
const {workspaceFromProfile,updateWorkspaceProfile}=loadTs('lib/workspace-contract.ts');
let row={id:'image-test-account',email:'fixture@example.invalid',plan:'pro_studio',subscription_status:'active'};
const source="I'm struggling to stay consistent with my goals, and I keep giving up when I don't see results quickly.";
const calls=[]; let browser;
await mkdir(fixture,{recursive:true}); await writeFile(new URL('page.tsx',fixture),await readFile(new URL('./fixtures/image-studio-page.tsx.fixture',import.meta.url)),{flag:'wx'});
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}); const context=await browser.newContext();
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url()); if(url.origin!==base)return route.abort();
  if(url.pathname==='/api/workspace'){if(req.method()==='PUT')row=updateWorkspaceProfile(row,row.id,req.postDataJSON()).data;return route.fulfill({json:workspaceFromProfile(row,row.id)});}
  if(url.pathname==='/api/generate') {const input=normalizeGenerationRequest(req.postDataJSON());calls.push(input);const sequence=calls.length;
   const raw={title:'A reflection',summary:'A thought to share.',sections:input.selectedTypes.map(type=>({id:type,type,platform:type,title:type==='linkedin'?'A reflection':'Hashtags',body:type==='linkedin'?`Progress takes time. Version ${sequence}.`:'',items:['#Consistency','#PersonalDevelopment','#GrowthMindset'],cta:''}))};
   return route.fulfill({json:parseGenerationOutput(JSON.stringify(raw),input)});}
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{}});return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(30000);await page.goto(base+'/image-studio-test');
 await page.getByLabel('What would you like to create?').fill(source);await page.getByLabel('Where will you publish it?').selectOption('linkedin');
 await page.getByText('Advanced Options (Optional)',{exact:true}).click();await page.getByRole('checkbox',{name:'Hashtags',exact:true}).check();await page.getByText('Advanced Options (Optional)',{exact:true}).click();
 await page.getByRole('button',{name:'Create Content',exact:true}).click();const card=page.locator('#outputs article').first();await card.getByText(/Version 1/).waitFor();
 assert.deepEqual(new Set(calls[0].selectedTypes),new Set(['linkedin','platformHashtags']));assert.equal(calls[0].source,source);assert.match(await card.innerText(),/#Consistency/);
 await page.locator('#outputs').getByRole('button',{name:'Regenerate',exact:true}).last().click();await card.getByText(/Version 2/).waitFor();
 assert.deepEqual(new Set(calls[1].selectedTypes),new Set(['linkedin','platformHashtags']));assert.equal(calls[1].source,source);assert.match(await card.innerText(),/#Consistency/);assert.equal(calls.length,2);
 console.log('UI create and regenerate passed: selected formats and source retained; new mocked result and hashtags displayed.');await context.close();
} finally {await browser?.close();await rm(fixture,{recursive:true,force:true});}
