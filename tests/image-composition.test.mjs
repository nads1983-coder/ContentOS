import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs, createImageHarness, imageInput, PNG} from './image-test-helpers.mjs';
const {planImageComposition:plan}=loadTs('lib/image-composition.ts');
const {buildCreativeBrief}=loadTs('lib/image-design.ts');
const {normalizeImageRequest}=loadTs('lib/image-generation-contract.ts');
const {quoteAI}=loadTs('lib/ai-cost.ts');
const brief='Create a Syria or Canada Foodie Beauty graphic.';
const input=extra=>normalizeImageRequest(imageInput({mode:'auto',outputText:brief,creativeInstructions:brief,
 appearance:{type:'illustration',style:'playful',colours:['#7450c8','#ffffff']},brandContext:{brandName:'Unrelated Brand',offer:'An unrelated giveaway',brandColors:'red, black'},...extra}));

test('exact owner brief preserves both destinations and shared subject without deciding an outcome',()=>{
 assert.deepEqual(plan(brief),{relation:'alternatives',evidence:brief.slice(0,-1),layout:'paired'});
 const result=buildCreativeBrief(input());
 assert.equal(result.design.mode,'image');
 assert.match(result.prompt,/Exact customer context: Create a Syria or Canada Foodie Beauty graphic/);
 assert.match(result.prompt,/comparable visual area and detail for BOTH sides/);
 assert.match(result.prompt,/trailing subject belongs to the whole comparison/);
 assert.match(result.prompt,/choice remains open/);
 assert.match(result.prompt,/Image type: illustration/);
 assert.match(result.prompt,/Selected style: playful/);
 assert.match(result.prompt,/Palette: hex 7450c8, hex ffffff/);
 assert.doesNotMatch(result.prompt,/Use a clear focal point|Unrelated Brand|unrelated giveaway|#[\p{L}\p{N}]/u);
 assert.equal(plan('Create a Syria or Canada graphic, no text.')?.relation,'alternatives');
 assert.equal(plan('Create a Syria or Canada graphic without text.')?.relation,'alternatives');
 assert.equal(plan('Create a Syria or Canada Foodie Beauty graphic in purple and white.')?.relation,'alternatives');
});

test('explicit relationships generalise without a people, country or product dictionary',()=>{
 for(const [text,relation] of [
  ['Aster versus Birch headphones','comparison'],['Compare product A vs. product B.','comparison'],
  ['Create a tea or coffee illustration.','alternatives'],['Create a Finland or Japan travel graphic.','alternatives'],
  ['Before and after a desk tidy-up.','transformation'],['A before-and-after garden design.','transformation'],
  ['Stay or leave?','alternatives'],['This or that?','alternatives'],['Pros and cons of remote work.','tradeoffs']
 ]) assert.equal(plan(text)?.relation,relation,text);
 const before=buildCreativeBrief(input({outputText:'Before and after a desk tidy-up.',creativeInstructions:''}));
 assert.match(before.prompt,/conceptual illustration, not evidence of an actual result/);
 assert.match(before.prompt,/upper image area/);
 const pros=buildCreativeBrief(input({creativeInstructions:'Pros and cons of remote work.'}));
 assert.match(pros.prompt,/Do not invent product capabilities, factual benefits, drawbacks or a verdict/);
});

test('single scenes, incidental or, output choices, palettes and negative instructions do not imply comparison',()=>{
 for(const text of [
  'A playful illustration of a teapot.','Create a red or blue graphic.','Create a logo or icon.',
  'Create a graphic for Instagram or LinkedIn.','Create a graphic for print or web.',
  'Create a quiet room to read or work in.','Create a mountain scene, rain or shine.',
  'Create an image with one or more plants.','A portrait. Do not add rain or snow.',
  'A portrait. Use purple or white.','Syria or Canada or France.',
  'Do not compare Syria versus Canada.'
 ]) assert.equal(plan(text),undefined,text);
 assert.equal(plan(brief,'Only show Canada.'),undefined);
 assert.equal(plan(brief,'Do not include Syria; show Canada instead.'),undefined);
 const result=buildCreativeBrief(input({outputText:'An illustration of a teapot.',creativeInstructions:'An illustration of a teapot.'}));
 assert.doesNotMatch(result.prompt,/Composition relationship|two-panel/);
});

test('explicit layouts and selected controls win, saved aesthetics cannot introduce a comparison',()=>{
 for(const layout of ['Use one scene, no split-screen.','Stacked layout, Canada above Syria.','Use a diagonal split.']){
  const result=buildCreativeBrief(input({creativeInstructions:layout}));
  assert.match(result.prompt,/customer's explicit layout, ordering and emphasis/);
  assert.doesNotMatch(result.prompt,/Default to a balanced two-panel/);
  assert.ok(result.prompt.includes(layout));
 }
 const saved=buildCreativeBrief(input({appearance:{type:'graphic',style:'auto',colours:[]},creativeInstructions:brief,
  brandContext:{brandColors:'cream and gold',visualStyle:'luxury'}}));
 assert.equal(saved.design.background,'#fff7e8');assert.equal(saved.design.accent,'#b58a30');
 for(const type of ['graphic','photograph','illustration']){
  const r=buildCreativeBrief(input({appearance:{type,style:'playful',colours:['#123abc','#ffffff']}}));
  assert.match(r.prompt,new RegExp(`Image type: ${type}`));assert.match(r.prompt,/Palette: hex 123abc, hex ffffff/);
 }
 assert.doesNotMatch(buildCreativeBrief(input({outputText:'A teapot.',creativeInstructions:'A teapot.',brandContext:{visualStyle:brief}})).prompt,/Composition relationship/);
});

test('actual authenticated provider payload contains composition with unchanged model, exports and exactly-once credit',async()=>{
 for(const [format,providerSize,exportSize] of [['square','1024x1024','1080x1080'],['landscape','1536x1024','1536x864'],['portrait','1024x1536','1080x1350'],['vertical','1024x1536','1080x1920']]){
  let payload;
  const h=createImageHarness({provider:async(_url,init)=>{payload=JSON.parse(init.body);return Response.json({data:[{b64_json:PNG}],usage:{input_tokens:100,output_tokens:100}});}});
  const value=input({format}),first=await h.post(value);
  assert.equal(first.response.status,200);
  assert.match(payload.prompt,/Syria or Canada Foodie Beauty/);assert.match(payload.prompt,/comparable visual area/);
  assert.equal(payload.model,'gpt-image-2.5-flare-2026-09-08');assert.equal(payload.size,providerSize);
  assert.equal(payload.quality,'high');assert.equal(payload.n,1);assert.equal(payload.output_format,'png');
  assert.equal(first.body.size,exportSize);assert.equal(first.body.creditCharged,true);
  assert.ok(quoteAI('image',payload,new Date('2026-10-25')).maximum>0,'existing spending policy quotes complete prompt');
  assert.deepEqual((await h.post(value)).body,first.body);
  assert.equal(h.calls.filter(c=>c==='provider').length,1);assert.equal(h.data.usage_events_json.length,1);
  assert.deepEqual(h.commercial,['dispatch','settle']);
 }
 const h=createImageHarness({provider:async(_url,init)=>{
  assert.match(JSON.parse(init.body).prompt,/Composition relationship: alternatives/);
  return Response.json({data:[{b64_json:PNG}]});
 }});
 assert.equal((await h.post(imageInput({outputText:brief}))).response.status,200,'legacy no-mode path also receives composition');
});
