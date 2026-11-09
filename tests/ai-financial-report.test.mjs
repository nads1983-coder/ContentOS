import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";

test("financial reporting is restricted to authenticated administrators",async()=>{
  for(const mode of ["anonymous","ordinary","admin"]){
    let reads=0;
    const {GET}=loadTs("app/api/admin/ai-financial-report/route.ts",{
      "@/lib/auth":{getCurrentUser:async()=>mode==="anonymous"?null:{id:"u",email:"admin@example.invalid"},isAdminEmail:()=>mode==="admin"},
      "@/lib/ai-financial-report":{currentFinancialReport:async()=>{reads++;return {month:"2026-11"};}}
    });
    const res=await GET();assert.equal(res.status,mode==="admin"?200:403);assert.equal(reads,Number(mode==="admin"));
    if(mode==="admin")assert.equal(res.headers.get("Cache-Control"),"no-store");
  }
});

test("report labels estimates, opening balance and holds without claiming invoice totals",async()=>{
  const client={release(){},async query(sql){
    if(["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY","COMMIT","ROLLBACK"].includes(sql))return {rows:[]};
    if(sql.includes("to_char"))return {rows:[{month:"2026-11"}]};
    if(sql.includes("ai_budget_configuration"))return {rows:[{starts_month:"2026-11",opening_microgbp:"1000000",suspended:false}]};
    if(sql.includes("paid_creator_lifetime_purchases"))return {rows:[{count:"2"}]};
    if(sql.includes("FROM contentos_app.ai_spend_requests"))return {rows:[{cohort:"lifetime",customers:"2",text_generations:"4",image_generations:"0",input_tokens:"5000",output_tokens:"10000",estimated_settled_microgbp:"200000",reserved_or_uncertain_microgbp:"300000"}]};
    throw Error("Unexpected SQL");
  }};
  const pool={connect:async()=>client};
  const {currentFinancialReport}=loadTs("lib/ai-financial-report.ts",{"server-only":{},"@/lib/db/client":{getPool:()=>pool}});
  const r=await currentFinancialReport();assert.equal(r.providerInvoiceActualAvailable,false);
  assert.equal(r.accountedMicroGBP,1500000);assert.equal(r.remainingMicroGBP,28500000);
  assert.equal(r.cohorts[0].averageEstimatedSettledMicroGBP,100000);
  assert.equal(r.cohorts[0].reportedInputTokens,5000);assert.equal(r.additionalFundedLifetimePlaces,0);
  assert.equal(r.accountCapacityMicroGBP,null);
  assert.match(r.classification,/earlier records are unknown/);assert.match(r.spending,/not provider invoices/);
});

test("account capacity is opt-in and invalid limits fail closed",()=>{
  for(const [value,expected] of [[undefined,null],["7500000",7500000],["0","error"],["30000001","error"],["invalid","error"]]){
    const api=loadTs("lib/commercial-ledger.ts",{"server-only":{},"@/lib/db/client":{}},new Map(),{process:{env:value===undefined?{}:{AI_ACCOUNT_MONTHLY_CAP_MICROGBP:value}}});
    if(expected==="error")assert.throws(()=>api.configuredAccountCapacity());else assert.equal(api.configuredAccountCapacity(),expected);
  }
});
