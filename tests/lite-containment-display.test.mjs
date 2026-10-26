import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import {renderToStaticMarkup} from "react-dom/server";
import {clsx} from "clsx";
import {loadTs} from "./image-test-helpers.mjs";

function renderer(suspended) {
  const code=ts.transpileModule(readFileSync("components/billing-buttons.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mocks={react:React,"react/jsx-runtime":jsx,clsx:{clsx},"@/lib/lite-availability":{...loadTs("lib/lite-availability.ts"),LITE_PURCHASES_SUSPENDED:suspended}};
  const module={exports:{}};
  new Function("require","module","exports",code)(id=>{assert.ok(id in mocks);return mocks[id];},module,module.exports);
  return (plan,covered=false)=>renderToStaticMarkup(React.createElement(module.exports.CheckoutButton,{plan,covered},"Choose plan"));
}

test("approved reopening enables Lite purchases without a misleading suspension message",()=>{
  const {LITE_PURCHASES_SUSPENDED}=loadTs("lib/lite-availability.ts");
  assert.equal(LITE_PURCHASES_SUSPENDED,false);
  const render=renderer(LITE_PURCHASES_SUSPENDED);
  for(const plan of ["lite","pro_creator","pro_studio"]) assert.doesNotMatch(render(plan),/disabled=""|temporarily unavailable/);
});

test("all Lite purchase buttons are visibly suspended; other plans and existing covered access remain usable",()=>{
  const render=renderer(true);
  assert.match(render("lite"),/disabled=""/);
  assert.match(render("lite"),/Lite temporarily unavailable/);
  assert.match(render("lite"),/Existing Lite access is unchanged/);
  assert.doesNotMatch(render("lite",true),/disabled=""/);
  for(const plan of ["pro_creator","pro_studio"]) assert.doesNotMatch(render(plan),/disabled=""|temporarily unavailable/);
});
