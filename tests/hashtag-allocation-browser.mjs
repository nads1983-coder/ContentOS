import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadTs} from './image-test-helpers.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3228';
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const dir=process.env.TEST_ARTIFACT_DIR??'/tmp/contentos-hashtag-allocation-browser';
await mkdir(dir,{recursive:true});
const fixtureRoute=new URL('../app/image-studio-test/',import.meta.url);
await mkdir(fixtureRoute,{recursive:true});
await writeFile(new URL('page.tsx',fixtureRoute),await readFile(new URL('fixtures/image-studio-page.tsx.fixture',import.meta.url)),{flag:'wx'});
let f=JSON.parse(await readFile(new URL('fixtures/youtube-hashtag-allocation.json',import.meta.url),'utf8'));
if(process.env.TEST_HASHTAG_CASE==='room-lighting'){
 const e=JSON.parse(await readFile(new URL('fixtures/grounded-hashtag-topics.json',import.meta.url),'utf8')).examples.find(e=>e.id==='room-lighting');
 f={request:{source:e.source,selectedTypes:[...e.platforms,'platformHashtags']},captionTags:e.expectedCaptionTags,additionalTags:e.expectedAdditionalTags,
  mockProviderOutput:{title:'Coloured room lighting',summary:'A personal reflection.',sections:[...e.platforms.map(type=>({id:type,type,platform:type,title:'Caption',body:e.body,items:e.captionCandidates,cta:''})),{id:'platformHashtags',type:'platformHashtags',platform:'General',title:'Additional hashtags',body:'',items:e.additionalCandidates,cta:''}]}};
}
const {normalizeGenerationRequest,parseGenerationOutput}=loadTs('lib/generation-contract.ts');
const {workspaceFromProfile,updateWorkspaceProfile}=loadTs('lib/workspace-contract.ts');
const {reserveGenerationInProfile,completeGenerationInProfile}=loadTs('lib/generation-reservation.ts');
const {captionHashtags}=loadTs('lib/hashtag-output.ts');
const plain=loadTs('lib/text-normalize.ts'),format=loadTs('lib/output-format.ts',{'./text-normalize':plain});
const copy=loadTs('lib/copy.ts',{'./text-normalize':plain,'./output-format':format});
const rows=new Map(['image-test-account','image-test-two'].map(id=>[id,{id,email:id+'@example.invalid',plan:'pro_studio',subscription_status:'active'}]));
const requests=[],errors=[];let delivered;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
async function newContext(){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const id=req.headers()['x-contentos-account'],row=rows.get(id);
  if(!row)return route.fulfill({status:401,json:{error:'Synthetic account required'}});
  try{
   if(url.pathname==='/api/workspace'){
    if(req.method()==='PUT')rows.set(id,updateWorkspaceProfile(row,id,req.postDataJSON()).data);
    return route.fulfill({json:workspaceFromProfile(rows.get(id),id)});
   }
   if(url.pathname==='/api/generate'){
    const input=normalizeGenerationRequest(req.postDataJSON());requests.push(input);
    const reserved=reserveGenerationInProfile(row,id,input.requestId,input);rows.set(id,reserved.data);
    if(reserved.result.status==='replay')return route.fulfill({json:reserved.result.result});
    const raw=structuredClone(f.mockProviderOutput);
    if(input.refinement){
     raw.sections=[{...input.refinement.section,items:input.refinement.section.type==='platformHashtags'?f.mockProviderOutput.sections.at(-1).items:[...f.captionTags,'#GorlLead','#papercraft']}];
     if(input.refinement.section.type!=='platformHashtags')raw.sections[0].body=f.mockProviderOutput.sections[0].body;
    }
    const output=parseGenerationOutput(JSON.stringify(raw),input);
    const done=completeGenerationInProfile(rows.get(id),id,input.requestId,reserved.result.fingerprint,output);rows.set(id,done.data);
    delivered=done.result;return route.fulfill({json:done.result});
   }
   return route.fulfill({json:{}});
  }catch(e){return route.fulfill({status:e.status??500,json:{error:e.message,revision:e.revision}});}
 });return context;
}
let context,page,stage='create';
try{
 context=await newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/image-studio-test');
 await page.getByLabel('What would you like to create?').fill(f.request.source);
 await page.getByLabel('Where will you publish it?').selectOption('linkedin');
 await page.getByText('Advanced Options (Optional)',{exact:true}).click();
 for(const type of f.request.selectedTypes.filter(t=>t!=='linkedin'))await page.getByRole('checkbox',{name:({facebook:'Facebook',youtubeShorts:'YT Shorts',instagram:'Instagram',tiktok:'TikTok',platformHashtags:'Hashtags'})[type],exact:true}).check();
 await page.getByText('Advanced Options (Optional)',{exact:true}).click();
 await page.getByRole('button',{name:'Create Content',exact:true}).click();
 const cards=page.locator('#outputs article');await cards.nth(3).waitFor();
 assert.equal(requests[0].source,f.request.source);assert.deepEqual(new Set(requests[0].selectedTypes),new Set(f.request.selectedTypes));
 for(let i=0;i<4;i++){
  await cards.nth(i).getByRole('button',{name:'Copy',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),copy.buildSectionCopyText(delivered.sections[i]));
 }
 assert.deepEqual(delivered.sections[3].items,f.additionalTags);
 stage='edit undo and caption refinement';
 await cards.first().getByRole('button',{name:'Edit',exact:true}).click();
 await cards.first().getByLabel(/Edit .* body/).fill('An edited paragraph.\n\nA second paragraph.');
 await cards.first().getByRole('button',{name:'Apply edits'}).click();
 await cards.first().getByRole('button',{name:'Copy',exact:true}).click();
 assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/^An edited paragraph\.\n\nA second paragraph\./);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();
 await cards.first().getByLabel('What would you like to change?').fill('Make the opening clearer.');
 await cards.first().getByRole('button',{name:'Apply change'}).click();
 await cards.first().getByText('AI refined',{exact:true}).waitFor();
 stage='additional refinement';
 await cards.nth(3).getByLabel('What would you like to change?').fill('Suggest relevant alternatives.');
 await cards.nth(3).getByRole('button',{name:'Apply change'}).click();
 await cards.nth(3).getByText('AI refined',{exact:true}).waitFor();
 assert.ok(requests[2].refinement.captionHashtags.includes(f.captionTags[0]));
 stage='save export restore';
 await page.getByRole('button',{name:'Save all',exact:true}).click();
 await page.waitForTimeout(1200);
 const saved=workspaceFromProfile(rows.get('image-test-account'),'image-test-account').store.saved[0];
 assert.ok(saved);assert.equal(saved.sections.at(-1).items.length,5);
 assert.ok(saved.sections.at(-1).items.every(t=>!captionHashtags(saved).includes(t)));
 assert.doesNotMatch(JSON.stringify(saved.sections),/#GorlLead|#papercraft/);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download .txt',exact:true}).click();
 await(await download).saveAs(dir+'/captions.txt');assert.equal(await readFile(dir+'/captions.txt','utf8'),copy.buildGenerationCopyText(saved));
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  for(let i=0;i<4;i++){
   await cards.nth(i).getByRole('button',{name:'Copy',exact:true}).click();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),copy.buildSectionCopyText(saved.sections[i]));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:dir+`/studio-${width}.png`,fullPage:true});
 }
 const second=await newContext(),device=await second.newPage();await device.goto(base+'/image-studio-test?generation='+encodeURIComponent(saved.id));await device.locator('#outputs article').nth(3).waitFor();
 for(let i=0;i<4;i++){
  await device.locator('#outputs article').nth(i).getByRole('button',{name:'Copy',exact:true}).click();assert.equal(await device.evaluate(()=>navigator.clipboard.readText()),copy.buildSectionCopyText(saved.sections[i]));
 }
 await second.close();
 await page.goto(base+'/image-studio-test?account=two');await page.getByRole('button',{name:'Create Content',exact:true}).waitFor();assert.equal(await page.getByTestId('post-caption').count(),0);
 assert.equal(rows.get('image-test-account').usage_events_json.filter(e=>e.event_type==='text_generation').length,3);assert.deepEqual(errors,[]);
 const report={passed:true,paidCalls:0,mockedGenerations:requests.length,captionAllocation:true,additionalDistinct:true,clipboard:true,editUndo:true,captionAndAdditionalRefinement:true,saveRestoreExport:true,accountIsolation:true,widths:[1440,768,390],errors};
 await writeFile(dir+'/result.json',JSON.stringify(report,null,2));console.log(report);
}catch(e){await page?.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});console.error({stage,error:e.message});throw e;}
finally{await context?.close();await browser.close();await rm(fixtureRoute,{recursive:true});}
