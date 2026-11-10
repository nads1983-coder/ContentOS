import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";
test("reconciliation status and retry require administrators and write-origin checks",async()=>{
  for(const mode of ["anonymous","ordinary","admin","unsafe"]){
    let reads=0,writes=0;
    const api=loadTs("app/api/admin/lifetime/reconciliation/route.ts",{
      "server-only":{},"@/lib/auth":{getCurrentUser:async()=>mode==="anonymous"?null:{id:"admin",email:"admin@example.invalid"},isAdminEmail:()=>mode!=="ordinary"},
      "@/lib/request-security":{rejectUnsafeWrite:()=>mode==="unsafe"?Response.json({error:"unsafe"},{status:403}):null},
      "@/lib/lifetime-reconciliation-admin":{reconciliationStatus:async()=>{reads++;return {jobs:[]};},retryReconciliation:async()=>{writes++;return {status:"queued"};}}
    });
    const get=await api.GET();assert.equal(get.status,["admin","unsafe"].includes(mode)?200:403);
    const post=await api.POST(new Request("https://example.invalid/api/admin/lifetime/reconciliation",{method:"POST",body:JSON.stringify({kind:"purchase",id:"test",reason:"Operator review complete"})}));
    assert.equal(post.status,mode==="admin"?200:403);assert.equal(reads,Number(["admin","unsafe"].includes(mode)));assert.equal(writes,Number(mode==="admin"));
  }
});
