import assert from 'node:assert/strict';
import test from 'node:test';
import {loadTs} from './image-test-helpers.mjs';
import {assertTokenCount,callBound,limits,packageProjection} from '../scripts/evals/lifetime-candidate-config.mjs';
const mocks={'server-only':{},'@/lib/db/client':{},'@/lib/commercial-ledger':{},'@/lib/stripe-rest':{},'@/lib/ai-topup-payments':{}};
const {topupEvidence}=loadTs('lib/ai-topup-review.ts',mocks);
const intent={id:'pi_test',amount:500,latest_charge:{id:'ch_test',amount_refunded:0,refunded:false,disputed:false}};
test('top-up evidence separates partial freeze, terminal refund and won dispute review',()=>{
  assert.deepEqual(topupEvidence(intent,[]),[]);
  assert.deepEqual(topupEvidence({...intent,latest_charge:{...intent.latest_charge,amount_refunded:100}},[]),[{reason:'review',key:'refund:100'}]);
  assert.equal(topupEvidence({...intent,latest_charge:{...intent.latest_charge,amount_refunded:500}},[])[0].reason,'full_refund');
  assert.equal(topupEvidence(intent,[{id:'du_test',status:'won',charge:'ch_test',payment_intent:'pi_test'}])[0].key,'dispute:du_test:won');
  assert.throws(()=>topupEvidence({...intent,latest_charge:{...intent.latest_charge,disputed:true}},[]));
  assert.equal(topupEvidence({...intent,latest_charge:{...intent.latest_charge,disputed:true,refunded:true,amount_refunded:500}},[])[0].reason,'full_refund');
  assert.throws(()=>topupEvidence(intent,[{id:'du_test',status:'won',charge:'ch_other',payment_intent:'pi_test'}]));
  assert.throws(()=>topupEvidence({...intent,latest_charge:{...intent.latest_charge,amount_refunded:undefined}},[]));
});
test('administrator approval cannot use client identity or bypass authorization/CSRF',async()=>{
  for(const mode of ['anonymous','ordinary','admin','csrf']) {
    let calls=0;
    const {POST}=loadTs('app/api/admin/topups/review/route.ts',{
      '@/lib/auth':{getCurrentUser:async()=>mode==='anonymous'?null:{id:'server-admin',email:'admin@example.invalid'},isAdminEmail:()=>mode==='admin'},
      '@/lib/request-security':{rejectUnsafeWrite:()=>mode==='csrf'?new Response(null,{status:403}):null},
      '@/lib/admin-json':{readAdminJson:async r=>r.json()},
      '@/lib/ai-topup-review':{reviewTopup:async(id,admin,reason,decision)=>{calls++;assert.equal(admin.id,'server-admin');assert.equal(decision,'reinstate');return {status:'reinstate'};}}
    });
    const response=await POST(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({purchaseId:'test',reason:'Reviewed evidence',decision:'reinstate',administrator:{id:'attacker'}})}));
    assert.equal(response.status,mode==='admin'?200:403);assert.equal(calls,mode==='admin'?1:0);
  }
});
test('evaluation refuses missing, invalid or excessive input token counts',()=>{
  for(const n of [undefined,NaN,0,-1,1.5,8193])assert.throws(()=>assertTokenCount(n));
  assertTokenCount(8192);
  assert.equal(limits.attempts,2);
  assert.ok(callBound('gpt-6-luna')*2*50<1);
  assert.ok(callBound('gpt-5.6-luna')*2*50<1);
  assert.ok(callBound('gpt-5.2')*2*50>1);
  for(const [credits,price] of [[25,5],[50,9],[100,15]]) assert.ok(packageProjection('gpt-6-luna',credits,price).margin>0.25);
});
