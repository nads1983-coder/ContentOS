import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";
const {validateLifetimeSession}=loadTs("lib/lifetime-payment.ts",{"server-only":{},"@/lib/commercial-ledger":{}});
const price={id:"price_synthetic",active:true,currency:"gbp",unit_amount:4900,type:"one_time",livemode:false};
const session=()=>({id:"cs_synthetic",mode:"payment",status:"complete",payment_status:"paid",currency:"gbp",amount_total:4900,client_reference_id:"synthetic-account",metadata:{purchase:"lifetime_access_v1",user_id:"synthetic-account",attempt_id:"synthetic-attempt"},customer:"cus_synthetic",subscription:null,url:"https://checkout.stripe.com/c/pay/synthetic",expires_at:Math.floor(Date.now()/1000)+1800,livemode:false,line_items:{data:[{quantity:1,price:{id:price.id}}]},payment_intent:{id:"pi_synthetic",status:"succeeded",amount_received:4900,currency:"gbp",customer:"cus_synthetic",latest_charge:{paid:true,refunded:false,amount_refunded:0,disputed:false}}});
test("qualifying one-time payment requires full current evidence, not a success URL",()=>{
  validateLifetimeSession(session(),"synthetic-account","synthetic-attempt",price,true);
  for(const patch of [{amount_total:0},{currency:"usd"},{mode:"subscription"},{subscription:"sub_synthetic"},{payment_status:"unpaid"},{customer:null},{client_reference_id:"another-account"},{livemode:true},{payment_intent:null},{line_items:{data:[]}}]) assert.throws(()=>validateLifetimeSession({...session(),...patch},"synthetic-account","synthetic-attempt",price,true));
  assert.throws(()=>validateLifetimeSession(session(),"synthetic-account","wrong-attempt",price,true));
});
test("refunds, partial refunds, disputes, customer mismatches and underpayment cannot issue credits",()=>{
  for(const patch of [{amount_received:4899},{customer:"wrong-customer"},{status:"processing"},{latest_charge:{paid:true,refunded:true,amount_refunded:4900,disputed:false}},{latest_charge:{paid:true,refunded:false,amount_refunded:1,disputed:false}},{latest_charge:{paid:true,refunded:false,amount_refunded:0,disputed:true}}]){
    const s=session();s.payment_intent={...s.payment_intent,...patch};assert.throws(()=>validateLifetimeSession(s,"synthetic-account","synthetic-attempt",price,true));
  }
});
test("open session validates exact product/amount and safe URL without requiring a completed payment",()=>{
  const open={...session(),status:"open",payment_status:"unpaid",payment_intent:null,customer:null};
  validateLifetimeSession(open,"synthetic-account","synthetic-attempt",price,false);
  for(const patch of [{url:"https://evil.invalid/pay"},{expires_at:1},{line_items:{data:[{quantity:2,price:{id:price.id}}]}},{line_items:{data:[{quantity:1,price:{id:"wrong"}}]}}]) assert.throws(()=>validateLifetimeSession({...open,...patch},"synthetic-account","synthetic-attempt",price,false));
  assert.throws(()=>validateLifetimeSession(open,"synthetic-account","synthetic-attempt",{...price,active:false},false));
  validateLifetimeSession(session(),"synthetic-account","synthetic-attempt",{...price,active:false},true);
});
