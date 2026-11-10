import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const { startPaidLifetimeCheckout } = loadTs("lib/paid-lifetime-checkout-service.ts");
const claim = { id: "purchase-1",userId:"user-1",attemptKey:"lifetime:test",pricePence:9900,
  earlyBirdSlot:1,status:"preparing",stripeCheckoutSessionId:null,stripeCheckoutUrl:null,createdAt:new Date().toISOString() };
const session = { id:"cs_test123",url:"https://checkout.stripe.com/c/pay/cs_test123",status:"open",
  mode:"payment",payment_status:"unpaid",currency:"gbp",amount_total:9900,amount_subtotal:9900,
  total_details:{amount_discount:0},client_reference_id:"user-1",expires_at:Math.floor(Date.now()/1000)+1800,
  metadata:{offer:"creator_lifetime_2026",user_id:"user-1",purchase_id:"purchase-1",attempt_key:"lifetime:test"},
  line_items:{has_more:false,data:[{quantity:1,amount_total:9900,price:{currency:"gbp",unit_amount:9900,type:"one_time"}}]} };

test("new checkout saves only a verified session; never a browser-supplied total",async()=>{
  const calls=[];
  const deps={reserve:async()=>claim,create:async()=>{calls.push("create");return session;},
    retrieve:async()=>{calls.push("retrieve");return session;},
    save:async()=>{calls.push("save");},expire:async()=>{calls.push("expire");}};
  const result=await startPaidLifetimeCheckout({userId:"user-1",email:"a@example.com"},deps);
  assert.equal(result.pricePence,9900);
  assert.deepEqual(calls,["create","retrieve","save"]);
});

test("existing open checkout is reused without a second Stripe create",async()=>{
  const calls=[];
  const deps={reserve:async()=>({...claim,status:"open",stripeCheckoutSessionId:session.id}),
    create:async()=>{throw new Error("second checkout forbidden");},
    retrieve:async()=>{calls.push("retrieve");return session;},save:async()=>{throw Error("unexpected save");},expire:async()=>{}};
  const result=await startPaidLifetimeCheckout({userId:"user-1",email:"a@example.com"},deps);
  assert.equal(result.purchaseId,claim.id);
  assert.deepEqual(calls,["retrieve"]);
});

test("unverified, aged, and completed attempts fail closed",async()=>{
  for(const attempt of [
    { claim:{...claim,createdAt:new Date(Date.now()-24*3600_000).toISOString()},session },
    { claim,session:{...session,amount_total:14900} },
    { claim:{...claim,status:"completed"},session }
  ]){
    let saved=false;
    const deps={reserve:async()=>attempt.claim,create:async()=>attempt.session,
      retrieve:async()=>attempt.session,save:async()=>{saved=true;},expire:async()=>{}};
    await assert.rejects(startPaidLifetimeCheckout({userId:"user-1",email:"a@example.com"},deps));
    assert.equal(saved,false);
  }
});
