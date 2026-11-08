import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

function harness(){
  const purchase={id:"purchase1",user_id:"u1",price_pence:9900,attempt_key:"attempt1",
    stripe_checkout_session_id:"cs_test123",stripe_payment_intent_id:null,status:"open"};
  const profile={id:"u1",email:"u@example.com",plan:"free",subscription_status:"none",stripe_subscription_id:"sub_history"};
  let state={purchase,profile};
  const pool={connect:async()=>{
    let before;
    return {release(){},async query(sql,values=[]){
      const q=String(sql).replace(/\s+/g," ").trim();
      if(q==="BEGIN"){before=structuredClone(state);return {rows:[]};}
      if(q==="COMMIT"){before=null;return {rows:[]};}
      if(q==="ROLLBACK"){state=before;before=null;return {rows:[]};}
      if(q.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(q.includes("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE id="))return {rows:[structuredClone(state.purchase)]};
      if(q.includes("SELECT * FROM contentos_app.paid_creator_lifetime_purchases WHERE stripe_payment_intent_id="))return {rows:state.purchase.stripe_payment_intent_id===values[0]?[structuredClone(state.purchase)]:[]};
      if(q.includes("SELECT data FROM contentos_app.profiles"))return {rows:[{data:structuredClone(state.profile)}]};
      if(q.startsWith("UPDATE contentos_app.paid_creator_lifetime_purchases")){
        if(q.includes("status='completed'")){
          state.purchase.status="completed";state.purchase.stripe_payment_intent_id=values[1];
        }else state.purchase.status=values[1];
        return {rows:[]};
      }
      if(q.startsWith("UPDATE contentos_app.profiles")){state.profile=JSON.parse(values[1]);return {rows:[]};}
      throw Error(`Unexpected query: ${q}`);
    }};
  }};
  const api=loadTs("lib/paid-lifetime-fulfillment.ts",{
    "server-only":{},"@/lib/db/client":{getPool:()=>pool}
  });
  return {api,get state(){return state;}};
}
const session={id:"cs_test123",mode:"payment",status:"complete",payment_status:"paid",
  amount_total:9900,amount_subtotal:9900,currency:"gbp",customer:"cus_123",payment_intent:"pi_123",
  client_reference_id:"u1",metadata:{offer:"creator_lifetime_2026",user_id:"u1",purchase_id:"purchase1",attempt_key:"attempt1"},
  total_details:{amount_discount:0},line_items:{data:[{quantity:1,amount_total:9900,
    price:{currency:"gbp",unit_amount:9900,type:"one_time"}}]}};
const intent={id:"pi_123",status:"succeeded",amount:9900,amount_received:9900,currency:"gbp",
  latest_charge:{id:"ch_123",paid:true,refunded:false,disputed:false,amount_refunded:0}};

test("verified payment grants once and preserves subscription records",async()=>{
  const h=harness();
  assert.equal((await h.api.completePaidCreatorLifetimePurchase("purchase1",session,intent)).status,"activated");
  assert.equal(h.state.profile.paid_creator_lifetime_status,"active");
  assert.equal(h.state.profile.stripe_subscription_id,"sub_history");
  assert.equal((await h.api.completePaidCreatorLifetimePurchase("purchase1",session,intent)).status,"replay");
  assert.equal((await h.api.reversePaidCreatorLifetimePurchase("pi_123","refunded")).status,"reversed");
  assert.equal(h.state.profile.paid_creator_lifetime_status,"refunded");
  assert.equal(h.state.profile.stripe_subscription_id,"sub_history");
  await assert.rejects(h.api.completePaidCreatorLifetimePurchase("purchase1",session,intent));
});

test("incorrect payment cannot grant a lifetime entitlement",async()=>{
  const h=harness();
  await assert.rejects(h.api.completePaidCreatorLifetimePurchase("purchase1",{...session,amount_total:14900},intent));
  assert.equal(h.state.profile.paid_creator_lifetime_status,undefined);
  assert.equal(h.state.purchase.status,"open");
});
