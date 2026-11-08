import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = process.argv[2] ?? '/private/tmp/contentos-pr22-audit';
const { loadTs, imageInput } = await import(pathToFileURL(`${root}/tests/image-test-helpers.mjs`));
const require = createRequire(`${root}/package.json`);
const findings = {};
const quiet = { log(){}, warn(){}, error(){} };
const profile = { id:'u1',email:'u@example.invalid',plan:'free',subscription_status:'none',paid_creator_lifetime_status:'active',paid_creator_lifetime_purchase_id:'purchase1' };
// Actual subscription route; mocks replace external services only.
{
 const calls=[];
 const {POST}=loadTs('app/api/billing/checkout/route.ts',{
  'server-only':{},'next/server':{NextResponse:Response},'@/lib/request-security':{rejectUnsafeWrite:()=>null},
  '@/lib/auth':{getCurrentUser:async()=>({id:profile.id,email:profile.email})},
  '@/lib/backend':{isDatabaseConfigured:()=>true,isAuthConfigured:()=>true},
  '@/lib/repository':{getUserProfileForUser:async()=>profile,syncUserSubscriptionState:async()=>{}},
  '@/lib/founder-claim-repository':{},
  '@/lib/stripe-rest':{getStripeSubscriptionState:async()=>({plan:'free',status:'none'}),reconcileActiveSubscriptionPlan:s=>s,checkoutPlanIsCoveredByState:()=>false,hasActiveUnknownPaidSubscription:()=>false,createCheckoutSession:async input=>{calls.push(input);return {url:'https://checkout.stripe.com/synthetic'};}}
 },new Map(),{console:quiet});
 const r=await POST(new Request('https://example.invalid/api/billing/checkout',{method:'POST',body:JSON.stringify({plan:'pro_creator'})}));
 assert.equal(r.status,200);assert.equal(calls.length,1);
 findings.recurringCreatorSoldToLifetime={status:r.status,createdPlans:calls.map(x=>x.plan)};
}
// Actual fulfillment service and webhook. Simulate refund delivery between
// provider read and DB activation. No SQL is executed outside this memory stub.
{
 const state={purchase:{id:'purchase1',user_id:'u1',price_pence:9900,attempt_key:'attempt1',stripe_checkout_session_id:'cs_test123',stripe_payment_intent_id:null,status:'open'},profile:{id:'u1',email:'u@example.invalid',plan:'free',subscription_status:'none'}};
 const query=async(sql,values=[])=>{
  const q=String(sql).replace(/\s+/g,' ').trim();
  if(q.includes('SELECT EXISTS'))return {rows:[{exists:state.purchase.stripe_payment_intent_id===values[0]}]};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(q)||q.startsWith('SELECT pg_advisory'))return {rows:[]};
  if(q.includes('SELECT * FROM contentos_app.paid_creator_lifetime_purchases'))return {rows:[structuredClone(state.purchase)]};
  if(q.includes('SELECT data FROM contentos_app.profiles'))return {rows:[{data:structuredClone(state.profile)}]};
  if(q.startsWith('UPDATE contentos_app.paid_creator_lifetime_purchases')){state.purchase.status='completed';state.purchase.stripe_payment_intent_id=values[1];return {rows:[]};}
  if(q.startsWith('UPDATE contentos_app.profiles')){state.profile=JSON.parse(values[1]);return {rows:[]};}
  throw Error(q);
 };
 const pool={query,connect:async()=>({query,release(){}})};
 const api=loadTs('lib/paid-lifetime-fulfillment.ts',{'server-only':{},'@/lib/db/client':{getPool:()=>pool}});
 const session={id:'cs_test123',mode:'payment',status:'complete',payment_status:'paid',amount_total:9900,amount_subtotal:9900,currency:'gbp',customer:'cus_123',payment_intent:'pi_123',client_reference_id:'u1',metadata:{offer:'creator_lifetime_2026',user_id:'u1',purchase_id:'purchase1',attempt_key:'attempt1'},total_details:{amount_discount:0},line_items:{data:[{quantity:1,amount_total:9900,price:{currency:'gbp',unit_amount:9900,type:'one_time'}}]}};
 const paid={id:'pi_123',status:'succeeded',amount:9900,amount_received:9900,currency:'gbp',latest_charge:{id:'ch_123',paid:true,refunded:false,disputed:false,amount_refunded:0}};
 const trace=[];let POST;
 const event=(type,object)=>new Request('https://example.invalid/api/billing/webhook',{method:'POST',body:JSON.stringify({type,data:{object}})});
 ({POST}=loadTs('app/api/billing/webhook/route.ts',{
  'next/server':{NextResponse:Response},'@/lib/paid-lifetime-offer':{PAID_LIFETIME_OFFER:{code:'creator_lifetime_2026',fulfillmentEnabled:true}},
  '@/lib/founder-claim-repository':{},'@/lib/founder-checkout-service':{},'@/lib/repository':{},'@/lib/paid-lifetime-reservations':{},
  '@/lib/stripe-rest':{verifyStripeSignature:()=>true,retrieveCheckoutSession:async()=>session,retrievePaidLifetimePaymentIntent:async()=>{trace.push('provider returns unrefunded paid snapshot');return structuredClone(paid);}},
  '@/lib/paid-lifetime-fulfillment':{...api,completePaidCreatorLifetimePurchase:async(...args)=>{
   trace.push('full refund occurs at Stripe');
   const refund=await POST(event('charge.refunded',{payment_intent:'pi_123'}));
   trace.push(`refund webhook acknowledges ${refund.status} while PI is unbound`);
   return api.completePaidCreatorLifetimePurchase(...args);
  }}
 },new Map(),{console:quiet}));
 const response=await POST(event('checkout.session.completed',session));
 assert.equal(response.status,200);assert.equal(state.profile.paid_creator_lifetime_status,'active');
 trace.push('activation commits active entitlement after refund acknowledgement');
 findings.refundActivationRace={trace,finalStatus:state.profile.paid_creator_lifetime_status};
}
{
 const {readMigrationFiles}=require('drizzle-orm/migrator');
 const m=readMigrationFiles({migrationsFolder:`${root}/drizzle`});
 findings.migration={loaded:m.length,includesLifetime:m.some(x=>x.sql.join('').includes('paid_creator_lifetime_purchases'))};
 assert.equal(findings.migration.includesLifetime,false);
}
{
 const g=loadTs('lib/generation-reservation.ts');
 const i=loadTs('lib/image-generation-reservation.ts');
 const now=new Date('2026-11-08T12:00:00Z');
 const req={source:'Useful original source text',tone:'professional',sharpness:'balanced',ctaMode:'soft',presetTopic:'none',selectedTypes:['linkedin']};
 const window='2026-11-01T00:00:00.000Z';
 assert.equal(g.reserveGenerationInProfile({...profile,generation_usage_json:{[window]:49}},'u1','request-49',req,now).result.plan,'pro_creator');
 assert.throws(()=>g.reserveGenerationInProfile({...profile,generation_usage_json:{[window]:50}},'u1','request-50',req,now),{code:'quota_exceeded'});
 assert.equal(g.reserveGenerationInProfile({...profile,generation_usage_json:{[window]:50}},'u1','request-dec',req,new Date('2026-12-01')).result.plan,'pro_creator');
 assert.throws(()=>i.reserveImageInProfile(profile,'u1',imageInput(),now),{code:'image_plan_required'});
 assert.throws(()=>g.reserveGenerationInProfile({...profile,generation_usage_json:{[window]:0},image_generation_usage_json:{[window]:50}},'u1','request-old-images',req,now),{code:'quota_exceeded'});
 findings.entitlements={text50Boundary:true,nextMonthResets:true,imagesDenied:true,oldStudioImagesCanConsumeLifetimeTextAllowance:true};
}
{
 let reads=0;
 const stale={...profile,plan:'pro_studio',subscription_status:'active',subscription_current_period_end:'2026-10-01T00:00:00Z'};
 const {getServerBillingState}=loadTs('lib/server-billing-state.ts',{
  '@/lib/auth':{getCurrentUser:async()=>({id:profile.id,email:profile.email})},'@/lib/backend':{isDatabaseConfigured:()=>true},'@/lib/env':{isStripeConfigured:()=>true},
  '@/lib/repository':{getUserProfileForUser:async()=>stale,syncUserSubscriptionState:async()=>({...stale,subscription_current_period_end:'2026-12-01T00:00:00Z'})},
  '@/lib/stripe-rest':{getStripeSubscriptionState:async()=>{reads++;return {plan:'pro_studio',status:'active'};}}
 });
 const state=await getServerBillingState();assert.equal(state.plan,'pro_creator');assert.equal(reads,0);
 findings.staleStudioRenewal={returned:state,stripeReads:reads};
}
console.log(JSON.stringify(findings,null,2));
