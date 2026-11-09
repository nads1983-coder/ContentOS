import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";
test("reinstatement requires same-origin authenticated administrator and explicit review",async()=>{
  for(const mode of ["unsafe","anonymous","ordinary","disabled","admin"]){
    let calls=0;
    const {POST}=loadTs("app/api/admin/lifetime/reinstate/route.ts",{
      "server-only":{},
      "@/lib/auth":{getCurrentUser:async()=>mode==="anonymous"?null:{id:"admin",email:"admin@example.invalid"},isAdminEmail:()=>mode!=="ordinary"},
      "@/lib/request-security":{rejectUnsafeWrite:()=>mode==="unsafe"?Response.json({error:"unsafe"},{status:403}):null},
      "@/lib/paid-lifetime-offer":{PAID_LIFETIME_OFFER:{fulfillmentEnabled:mode!=="disabled"}},
      "@/lib/paid-lifetime-fulfillment":{approveLifetimeReinstatement:async()=>{calls++;return {status:"reinstated"};}}
    });
    const res=await POST(new Request("https://example.invalid/api/admin/lifetime/reinstate",{method:"POST",body:JSON.stringify({purchaseId:"synthetic",reason:"Reviewed by administrator"})}));
    assert.equal(res.status,mode==="admin"?200:mode==="disabled"?503:403);assert.equal(calls,Number(mode==="admin"));
  }
});
