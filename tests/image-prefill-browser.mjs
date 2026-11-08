import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = 'http://127.0.0.1:3218';
const fixture = new URL('../app/image-studio-test/', import.meta.url);
await mkdir(fixture, {recursive:true});
await writeFile(new URL('page.tsx', fixture), await readFile(new URL('./fixtures/image-studio-page.tsx.fixture', import.meta.url)), {flag:'wx'});
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
const context = await browser.newContext();
let images = 0, lastPayload;
const posts = [
 'After twelve years in policing, I am changing careers. My next chapter brings the skills I learned listening and staying calm into a new career.',
 'Good leadership starts with listening to your team. Make space for their ideas before deciding together.'
];
await context.route('**/*', async route => {
 const req = route.request(), url = new URL(req.url());
 if (url.origin !== base) return route.abort();
 if (url.pathname === '/api/workspace') return route.fulfill({json:{revision:'0',store:{drafts:[],recent:[],saved:[]},brandProfiles:[],preferences:{brandName:"",audience:"",offer:"",writingStyle:"",contentGoal:""}}});
 if (url.pathname === '/api/generate') { const input=req.postDataJSON(); return route.fulfill({json:{...input,id:'pack',createdAt:new Date().toISOString(),title:'Posts',summary:'',sections:posts.map((body,i)=>({id:`post-${i}`,type:'linkedin',title:`Post ${i+1}`,platform:'LinkedIn',body,items:[]}))}}); }
 if (url.pathname === '/api/generate-image') { images++; lastPayload=req.postDataJSON(); return route.fulfill({status:400,json:{error:'Mocked test response'}}); }
 if (url.pathname.startsWith('/api/')) return route.fulfill({json:{}});
 return route.continue();
});
try {
 const page=await context.newPage();
 page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000);
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:900}); await page.goto(base+'/image-studio-test');
  await page.getByRole('button',{name:'Image Studio',exact:true}).click();
  let dialog=page.getByRole('dialog'); await dialog.getByLabel('What image would you like?').fill('Stale previous description');
  await dialog.getByRole('button',{name:'Close image generation'}).click();
  await page.getByLabel('What would you like to create?').fill('Career and leadership');
  await page.getByRole('button',{name:'Create Content',exact:true}).click();
  const cards=page.locator('#outputs article'); await cards.nth(1).waitFor();
  await cards.nth(0).getByRole('button',{name:'Create Image',exact:true}).click();
  let description=dialog.getByLabel('What image would you like?');
  assert.match(await description.inputValue(),/career|policing/i); assert.doesNotMatch(await description.inputValue(),/Stale/);
  assert.equal(images,0); await description.fill('Show an abstract blue spiral.');
  const imageResponse = page.waitForResponse(response => response.url().endsWith('/api/generate-image'));
  await dialog.getByRole('button',{name:'Generate visual',exact:true}).click();
  await imageResponse;
  assert.equal(images,1); assert.equal(lastPayload.creativeInstructions,'Show an abstract blue spiral.'); assert.match(lastPayload.outputText,/policing/);
  await dialog.getByRole('button',{name:'Close image generation'}).click();
  await cards.nth(1).getByRole('button',{name:'Create Image',exact:true}).click();
  assert.match(await description.inputValue(),/leadership/i); assert.doesNotMatch(await description.inputValue(),/spiral|policing/i);
  assert.equal(images,1); assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await page.reload(); assert.equal(images,1); images=0;
 }
 console.log('Desktop and mobile handoff passed; image calls occurred only on explicit Generate visual.');
} finally { await context.close(); await browser.close(); await rm(fixture,{recursive:true,force:true}); }
