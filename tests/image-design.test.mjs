import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadTs, createImageHarness, imageInput, profile, requestId, PNG } from "./image-test-helpers.mjs";
const { buildCreativeBrief, normaliseDesign, renderDesignSvg, backgroundFromDesignImage, foreground } = loadTs("lib/image-design.ts");
const { normalizeImageRequest } = loadTs("lib/image-generation-contract.ts");
const { imageGenerationFingerprint, reserveImageInProfile } = loadTs("lib/image-generation-reservation.ts");
const { socialImageCanvasSize } = loadTs("lib/social-image.ts");
const { boundDeviceImages } = loadTs("lib/image-device-store.ts");
const input = extra => normalizeImageRequest(imageInput({ mode: "auto", brandContext: {}, ...extra }));
const visible = svg => [...svg.matchAll(/>([^<>]*)</g)].map(m => m[1]).join(" ");

test("Auto chooses text, visual storytelling or mixed without a briefing API", () => {
  for (const [instructions, expected] of [["A typography quote card", "text"], ["Editorial photography, no text", "image"], ["A bold technology announcement", "mixed"]]) {
    assert.equal(buildCreativeBrief(input({ creativeInstructions: instructions })).design.mode, expected);
  }
  assert.equal(buildCreativeBrief(input({ mode: "text", creativeInstructions: "Photograph with no text" })).design.mode, "text", "Text never silently incurs a paid image request");
  assert.equal(buildCreativeBrief(input({ mode: "image", creativeInstructions: "Headline: Quiet confidence" })).design.mode, "mixed");
});

test("inline and multiline image text directives stay separate and do not render publisher instructions", () => {
  for (const instructions of ["A simple graphic. Headline: Room for ideas", "A simple graphic.\nHeadline: Room for ideas"]) {
    const brief = buildCreativeBrief(input({ mode: "text", outputText: instructions, creativeInstructions: instructions }));
    assert.equal(brief.design.headline, "Room for ideas");
    assert.equal(brief.design.body, "");
  }
  const instructions = "Cream and gold graphic. Headline: Room for ideas. Support: A quiet moment. Brand: Mira";
  const brief = buildCreativeBrief(input({ mode: "text", outputText: instructions, creativeInstructions: instructions }));
  assert.equal(brief.design.headline, "Room for ideas");
  assert.equal(brief.design.body, "A quiet moment");
  assert.equal(brief.design.brand, "Mira");
  const notADirective = "Do not put a Headline: on this photograph.";
  assert.equal(buildCreativeBrief(input({ mode: "image", outputText: notADirective, creativeInstructions: notADirective })).design.headline, "");
});

test("explicit palette and creative direction override saved preferences; no invented logo or offers", () => {
  const brief = buildCreativeBrief(input({ creativeInstructions: "A luxury beauty graphic using cream and gold.\nHeadline: A quiet ritual",
    brandContext: { brandName: "Mira", industry: "Beauty", audience: "Busy professionals", brandColors: "black, purple", visualStyle: "Corporate technology", writingStyle: "Warm and thoughtful" } }));
  assert.equal(brief.design.background, "#fff7e8"); assert.equal(brief.design.accent, "#b58a30");
  assert.equal(brief.design.font, "editorial"); assert.equal(brief.design.headline, "A quiet ritual");
  assert.match(brief.prompt, /Beauty.*Busy professionals/); assert.match(brief.prompt, /Warm and thoughtful/);
  assert.match(brief.prompt, /Do not invent products/); assert.doesNotMatch(visible(renderDesignSvg(brief.design,1080,1080)), /ContentOS|discount|sale/i);
  for (const industry of ["Leadership coaching", "Architecture", "Food", "Education", "Technology"]) {
    assert.ok(buildCreativeBrief(input({ brandContext: { industry } })).prompt.includes(industry));
  }
});

test("hashtags stay only in captions across all modes, platforms and editing", () => {
  for (const mode of ["auto", "image", "text", "mixed"]) for (const platform of ["LinkedIn", "Instagram", "Facebook", "TikTok", "X", "Pinterest", "YouTube"]) {
    const source = "A calmer start. #Marketing ＃日本語\n\nOne clear idea. #Idea";
    const value = input({ mode, platform, outputText: source, creativeInstructions: "Headline: A fresh start #Heading", brandContext: { brandName: "Mira #brand", industry: "#Industry Leadership" } });
    const brief = buildCreativeBrief(value);
    assert.doesNotMatch(brief.prompt, /[#＃][\p{L}\p{N}_]+/u);
    const edited = normaliseDesign({ ...brief.design, headline: "Better #headline", body: "Clear #body" });
    assert.doesNotMatch(visible(renderDesignSvg(edited,1080,1350)), /[#＃][\p{L}\p{N}_]+/u);
    assert.equal(value.outputText, source);
  }
  assert.throws(() => input({ outputText: "Hashtags: #Only #Tags" }), /Add a message/);
});

test("Image mode is full-frame without labels or overlays; mixed uses safe panel and exact canvas dimensions", () => {
  for (const format of ["square", "landscape", "portrait", "vertical"]) {
    const { width, height } = socialImageCanvasSize(format);
    for (const mode of ["image", "mixed", "text"]) {
      const design = buildCreativeBrief(input({ mode })).design;
      const svg = renderDesignSvg(design,width,height,`data:image/png;base64,${PNG}`);
      assert.match(svg, new RegExp(`width="${width}" height="${height}"`));
      if (mode === "image") assert.doesNotMatch(svg, /<text|<tspan/);
      if (mode === "text") assert.doesNotMatch(svg, /<image/);
      if (mode === "mixed") { assert.match(svg, /<image/); assert.match(svg, /<text/); }
      for (const match of svg.matchAll(/<tspan x="([^"]+)" y="([^"]+)">/g)) {
        assert.ok(+match[1] >= width*.08 && +match[1] <= width*.92);
        assert.ok(+match[2] < height-height*.04);
      }
    }
  }
});

test("long typography fits before branding; contrast, escaping and local overlay extraction are safe", () => {
  const d = { ...buildCreativeBrief(input({ mode: "mixed" })).design, headline: "W".repeat(68), body: "W".repeat(120), brand: "W".repeat(36) };
  for (const format of ["square", "landscape", "portrait", "vertical"]) {
    const { width, height } = socialImageCanvasSize(format);
    const svg = renderDesignSvg(d,width,height,`data:image/png;base64,${PNG}`);
    const brandY = +svg.match(/<text x="[^"]+" y="([^"]+)"/)[1];
    for (const match of svg.matchAll(/<tspan x="[^"]+" y="([^"]+)"/g)) assert.ok(+match[1] < brandY-20);
    assert.equal(backgroundFromDesignImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), `data:image/png;base64,${PNG}`);
  }
  assert.equal(foreground("#ffffff"), "#000000"); assert.equal(foreground("#111116"), "#ffffff");
  assert.throws(() => normaliseDesign({ ...d, background: 'red" onload="alert(1)' }));
  assert.doesNotMatch(renderDesignSvg(d,1080,1080,"https://untrusted.invalid/track"), /untrusted|href/);
});

test("all modes execute the actual route; Text makes no provider, commercial or credit calls", async () => {
  for (const mode of ["auto", "image", "text", "mixed"]) {
    const h = createImageHarness();
    const value = imageInput({ mode });
    const result = await h.post(value);
    assert.equal(result.response.status,200);
    assert.equal(result.body.creditCharged,mode !== "text");
    assert.equal(h.calls.filter(c=>c==="provider").length,mode === "text" ? 0 : 1);
    assert.deepEqual(h.commercial,mode === "text" ? [] : ["dispatch","settle"]);
    assert.deepEqual((await h.post(value)).body,result.body);
    assert.equal(h.data.usage_events_json?.length ?? 0,mode === "text" ? 0 : 1);
  }
});

test("Text-only credits stay free at monthly image quota; entitlement, attempt and ownership checks remain", () => {
  const date = new Date("2026-10-22T12:00:00Z");
  const data = profile({ image_generation_usage_json: { "2026-10-01T00:00:00.000Z": 100 } });
  const result = reserveImageInProfile(data,"user-test", input({mode:"text"}),date);
  assert.equal(result.result.status,"reserved");
  assert.throws(()=>reserveImageInProfile(data,"user-test",input({mode:"image"}),date),/image credits/);
  assert.throws(()=>reserveImageInProfile(profile({plan:"free"}),"user-test",input({mode:"text"}),date),/Pro Studio/);
  assert.throws(()=>reserveImageInProfile(data,"different-user",input({mode:"text"}),date),/Account/);
});

test("new render fields bind idempotency, old request fingerprints remain byte-compatible", () => {
  const old = normalizeImageRequest(imageInput());
  const {requestId: id,...payload}=old;
  assert.equal(imageGenerationFingerprint(old),createHash("sha256").update(JSON.stringify(payload)).digest("hex"));
  const base=input({mode:"text"});
  for (const change of [{mode:"image"},{creativeInstructions:"Another concept"},{brandContext:{...base.brandContext,industry:"Architecture"}}]) assert.notEqual(imageGenerationFingerprint(base),imageGenerationFingerprint({...base,...change}));
  assert.equal(imageGenerationFingerprint(base),imageGenerationFingerprint({...base,requestId:requestId(2)}));
});

test("failed Image mode never delivers a blank visual or automatically retries; mixed fallback is labelled", async()=>{
  for(const mode of ["image","mixed"]){
    const h=createImageHarness({provider:async()=>new Response("Offline fixture failure",{status:503})});
    const value=imageInput({mode});const result=await h.post(value);
    assert.equal(result.response.status,mode==="image"?502:200);
    if(mode==="mixed"){assert.equal(result.body.design.mode,"text");assert.match(result.body.warning,/not available/);}
    await h.post(value); assert.equal(h.calls.filter(c=>c==="provider").length,1);
    assert.equal(h.data.usage_events_json?.length??0,0);
  }
});

test("device design retention is bounded, latest first, and leaves originals intact",()=>{
  const images=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),{image:"data:image/svg+xml;charset=utf-8,%3Csvg%3E",createdAt:new Date(2026,9,i+1).toISOString()}]));
  const saved=boundDeviceImages(images);
  assert.equal(Object.keys(saved).length,8);assert.ok(saved["11"]);assert.equal(saved["0"],undefined);assert.equal(Object.keys(images).length,12);
});

test("instruction-only requests create imagery, not a graphic of publisher instructions",async()=>{
  const words="Create a luxury beauty graphic using cream and gold.";
  const brief=buildCreativeBrief(input({outputText:words,creativeInstructions:words}));
  assert.equal(brief.design.mode,"image");assert.equal(brief.design.headline,"");assert.equal(brief.design.body,"");
  const h=createImageHarness();
  const response=await h.post(imageInput({mode:"text",outputText:words,creativeInstructions:words}));
  assert.equal(response.response.status,400);assert.equal(h.calls.includes("provider"),false);
});
