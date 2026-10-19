import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { loadTs, imageInput, PNG } from "./image-test-helpers.mjs";

assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH,"br-divine-term-b2rihbxv");
assert.ok(["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech","ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(new URL(process.env.DATABASE_URL).hostname));
for(const key of ["OPENAI_API_KEY","STRIPE_SECRET_KEY","RESEND_API_KEY"]) assert.ok(!process.env[key]);
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:8});
const mocks={"server-only":{},"@/lib/db/client":{getPool:()=>pool,getDb:()=>drizzle(pool)}};
const runtime={process:{env:{OPENAI_API_KEY:"isolated-mock-not-a-key",OPENAI_MODEL:"gpt-4.1"}}};
const cache=new Map();
const cost=loadTs("lib/ai-cost.ts",mocks,cache,runtime);
const ledger=loadTs("lib/commercial-ledger.ts",mocks,cache,runtime);
const repository=loadTs("lib/postgres-repository.ts",mocks,cache,runtime);
const ids=[],prefix=`commercial-test-${randomUUID()}`;
let configBefore;
const q=cost.quoteAI("text",{model:"gpt-4.1",input:"synthetic",max_output_tokens:24000});
const qi=cost.quoteAI("image",{model:"gpt-image-1.5",prompt:"synthetic",n:1,quality:"high",size:"1536x1024"});
const reserve=(id,key,quote=q)=>ledger.reserveCommercial(id,key,quote,data=>({data:{...data,last_synthetic_reservation:key},result:{status:"reserved"}}));
const finish=(id,key,quote=q,delivered=false)=>ledger.finishCommercial(id,key,quote,delivered,data=>({data,result:null}));
const row=async(id,key)=> (await pool.query("SELECT * FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND request_id=$2",[id,key])).rows[0];
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${checks}: ${name}`);}
async function account(extra={}){
  const id=`${prefix}-${ids.length}`,email=`${id}@example.invalid`;ids.push(id);
  const data={id,email,plan:"pro_studio",subscription_status:"active",private_test_marker:prefix,...extra};
  await pool.query("INSERT INTO contentos_app.profiles(id,email,data) VALUES($1,$2,$3::jsonb)",[id,email,JSON.stringify(data)]);return id;
}
const lifetime={plan:"free",subscription_status:"none",lifetime_access:{source:"lifetime_purchase",status:"active",textCredits:12,imageCredits:4}};
async function opening(amount=0){await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=$1,suspended=false",[amount]);}
try {
  const exists=(await pool.query("SELECT to_regclass('contentos_app.ai_spend_requests') AS name")).rows[0].name;
  if(!exists) await pool.query(readFileSync(new URL("../drizzle/0003_commercial_spending.sql",import.meta.url),"utf8"));
  else await pool.query("ALTER TABLE contentos_app.lifetime_purchases ADD COLUMN IF NOT EXISTS attempt_history jsonb NOT NULL DEFAULT '[]'::jsonb");
  const migration=readFileSync(new URL("../drizzle/0003_commercial_spending.sql",import.meta.url),"utf8");
  await pool.query(migration.slice(migration.indexOf("REVOKE ALL")));
  configBefore=(await pool.query("SELECT * FROM contentos_app.ai_budget_configuration")).rows[0]??null;
  await pool.query("INSERT INTO contentos_app.ai_budget_configuration(singleton,starts_month,opening_microgbp,evidence_reference) VALUES(true,to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM'),0,'isolated-synthetic-tests') ON CONFLICT(singleton) DO UPDATE SET starts_month=EXCLUDED.starts_month,opening_microgbp=0,suspended=false,evidence_reference=EXCLUDED.evidence_reference");
  await check("cross-instance concurrent final global reservation admits exactly one",async()=>{
    const a=await account(),b=await account();await opening(30_000_000-q.maximum);
    const other=loadTs("lib/commercial-ledger.ts",mocks,new Map(),runtime);
    const results=await Promise.allSettled([reserve(a,"last-a"),other.reserveCommercial(b,"last-b",q,data=>({data,result:{status:"reserved"}}))]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    const admitted=results[0].status==="fulfilled"?a:b,key=admitted===a?"last-a":"last-b";
    await finish(admitted,key);assert.equal((await row(admitted,key)).accounted_microgbp,"0");await opening();
  });
  await check("lost dispatch acknowledgement retains full cost and rejects duplicate dispatch across instances",async()=>{
    const a=await account();await reserve(a,"lost-call");await ledger.dispatchCommercial(a,"lost-call",q);
    await assert.rejects(()=>ledger.dispatchCommercial(a,"lost-call",q));await finish(a,"lost-call");
    const state=await row(a,"lost-call");assert.equal(state.state,"uncertain");assert.equal(Number(state.accounted_microgbp),q.maximum);
    await assert.rejects(()=>reserve(a,"lost-call"));
  });
  await check("lifetime text and image sublimits refuse before changing profile or credits",async()=>{
    for(const quote of [q,qi]){
      const a=await account(lifetime);await reserve(a,"seed",quote);await ledger.dispatchCommercial(a,"seed",quote);
      await pool.query("UPDATE contentos_app.ai_spend_requests SET accounted_microgbp=$2 WHERE account_id=$1",[a,cost.COST_POLICY[quote.kind]]);
      const before=(await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1",[a])).rows[0].data;
      await assert.rejects(()=>reserve(a,"too-much",quote),e=>e.code==="lifetime_capacity_exhausted");
      assert.deepEqual((await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1",[a])).rows[0].data,before);
      await pool.query("UPDATE contentos_app.ai_spend_requests SET accounted_microgbp=0,state='released' WHERE account_id=$1",[a]);
    }
  });
  await check("nonrenewing text credits survive month rollover and concurrent final-credit requests",async()=>{
    const a=await account(lifetime);
    for(let n=0;n<11;n++){await reserve(a,`credit-${n}`);await ledger.dispatchCommercial(a,`credit-${n}`,q);await ledger.settleCommercialUsage(a,`credit-${n}`,q,{input_tokens:1,output_tokens:1});await finish(a,`credit-${n}`,q,true);}
    await pool.query("UPDATE contentos_app.ai_spend_requests SET month='2026-09' WHERE account_id=$1",[a]);
    const attempts=await Promise.allSettled([reserve(a,"final-one"),reserve(a,"final-two")]);assert.equal(attempts.filter(r=>r.status==="fulfilled").length,1);
    assert.equal((await ledger.getLifetimeBalance(a)).text,0);
    await finish(a,attempts[0].status==="fulfilled"?"final-one":"final-two");assert.equal((await ledger.getLifetimeBalance(a)).text,1);
  });
  await check("account isolation, durable failure, reconciliation and duplicate completion",async()=>{
    const a=await account(),b=await account();await reserve(a,"same-id");await reserve(b,"same-id");
    await ledger.dispatchCommercial(a,"same-id",q);await ledger.settleCommercialUsage(a,"same-id",q,{input_tokens:100,output_tokens:200});
    await finish(a,"same-id",q,true);await finish(a,"same-id",q,true);assert.equal((await row(a,"same-id")).delivered,true);
    assert.equal((await row(b,"same-id")).state,"reserved");await finish(b,"same-id");
    await assert.rejects(()=>ledger.finishCommercial(a,"not-his",q,true,data=>({data,result:null})));
  });
  await check("database exception rolls back both financial hold and profile mutation",async()=>{
    const a=await account();await assert.rejects(()=>ledger.reserveCommercial(a,"rollback",q,()=>{throw new Error("synthetic failure");}));
    assert.equal(await row(a,"rollback"),undefined);
  });
  await check("warning thresholds are durable and deduplicated; global exhaustion never deducts credits",async()=>{
    const current=Number((await pool.query("SELECT COALESCE(sum(accounted_microgbp),0) n FROM contentos_app.ai_spend_requests WHERE month=to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM')")).rows[0].n);
    const a=await account(lifetime);await opening(25_000_000-current);await reserve(a,"warning");
    const alerts=(await pool.query("SELECT threshold_microgbp FROM contentos_app.ai_budget_alerts WHERE month=to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM')")).rows;
    assert.deepEqual(alerts.map(r=>Number(r.threshold_microgbp)).sort(),[20_000_000,25_000_000]);
    await opening(30_000_000);await assert.rejects(()=>reserve(a,"no-capacity"),e=>e.code==="global_capacity_exhausted");
    assert.equal((await ledger.getLifetimeBalance(a)).text,11);await finish(a,"warning");await opening();
  });
  await check("provider bound violation suspends admission across month boundaries",async()=>{
    const a=await account();await reserve(a,"bad-usage");await ledger.dispatchCommercial(a,"bad-usage",q);
    await assert.rejects(()=>ledger.settleCommercialUsage(a,"bad-usage",q,{input_tokens:q.inputBound+1,output_tokens:1}));
    await assert.rejects(()=>reserve(a,"after-bound"),e=>e.code==="budget_not_initialised");
    assert.equal(Number((await row(a,"bad-usage")).accounted_microgbp),q.maximum);await opening();
  });
  await check("Europe/London month boundaries include BST and winter transitions",async()=>{
    for(const [time,expected] of [["2026-03-31T23:30:00Z","2026-04"],["2026-10-31T23:30:00Z","2026-10"],["2026-11-01T00:00:00Z","2026-11"]]){
      assert.equal((await pool.query("SELECT to_char($1::timestamptz AT TIME ZONE 'Europe/London','YYYY-MM') AS month",[time])).rows[0].month,expected);
    }
  });
  await check("pre-midnight reservation is readmitted into dispatch month, not charged to old capacity",async()=>{
    const a=await account();await reserve(a,"rollover");
    await pool.query("UPDATE contentos_app.ai_spend_requests SET month='2026-09' WHERE account_id=$1",[a]);
    await opening(30_000_000);await assert.rejects(()=>ledger.dispatchCommercial(a,"rollover",q),e=>e.code==="global_capacity_exhausted");
    assert.equal((await row(a,"rollover")).state,"reserved");await opening();await ledger.dispatchCommercial(a,"rollover",q);
    const current=(await pool.query("SELECT to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM') AS month")).rows[0].month;
    assert.equal((await row(a,"rollover")).month,current);await finish(a,"rollover");
  });
  await check("actual text route, real Neon, all 14 mocked formats, exactly-once history and credits",async()=>{
    const a=await account(lifetime);let providerCalls=0;
    const fixtures=loadTs("lib/preview-fixtures.ts",mocks,new Map(),{process:{env:{VERCEL_ENV:"preview",CONTENTOS_PREVIEW_FIXTURES:"1",CONTENTOS_ISOLATED_BRANCH:process.env.CONTENTOS_ISOLATED_BRANCH,DATABASE_URL:process.env.DATABASE_URL}}});
    const config=loadTs("lib/content-config.ts",mocks,cache,runtime);
    const route=loadTs("app/api/generate/route.ts",{
      ...mocks,"next/server":{NextResponse:Response},"@/lib/repository":repository,
      "@/lib/auth":{getCurrentUser:async()=>({id:a,email:`${a}@example.invalid`})},
      "@/lib/backend":{isDatabaseConfigured:()=>true},"@/lib/monitoring":{analyticsEvent:()=>{},captureServerError:()=>{}},
      "@/lib/request-security":{rejectUnsafeWrite:()=>null},"@/lib/preview-fixtures":{previewFixturesEnabled:()=>false},
      openai:class{responses={create:async()=>{providerCalls++;return {...fixtures.previewTextResponse(body),usage:{input_tokens:100,output_tokens:100}};}}}
    },new Map(),runtime);
    const body={source:"A synthetic notebook has a blue cover. No claims about outcomes. No CTA.",selectedTypes:config.contentTypes.map(t=>t.id),requestId:randomUUID()};
    const send=account=>route.POST(new Request("https://test.invalid/api/generate",{method:"POST",headers:{"X-ContentOS-Account":account},body:JSON.stringify(body)}));
    const first=await send(a);const parsed=await first.json();assert.equal(first.status,200,JSON.stringify(parsed));assert.equal(parsed.sections.length,14);
    assert.equal((await send(a)).status,200);assert.equal(providerCalls,1);assert.equal((await send("wrong-account")).status,409);
    const data=(await pool.query("SELECT data FROM contentos_app.profiles WHERE id=$1",[a])).rows[0].data;
    assert.equal(data.generation_history_json.length,1);assert.equal(data.usage_events_json.length,1);assert.equal((await ledger.getLifetimeBalance(a)).text,11);
    assert.equal((await repository.getWorkspace(a)).store.recent.length,1);
  });
  await check("prepared mock payment fulfillment issues credits once, preserves billing and handles reversals",async()=>{
    const payment=loadTs("lib/lifetime-payment.ts",mocks,new Map(),runtime);
    const a=await account({plan:"free",subscription_status:"none",generation_history_json:[],stripe_customer_id:"cus_isolated"});
    const sessions=new Map(),price={id:"price_isolated",active:true,currency:"gbp",unit_amount:4900,type:"one_time",livemode:false};
    const provider={price:async()=>price,retrieve:async id=>[...sessions.values()].find(s=>s.id===id),create:async input=>{
      if(!sessions.has(input.idempotencyKey)) sessions.set(input.idempotencyKey,{id:`cs_${randomUUID()}`,mode:"payment",status:"open",payment_status:"unpaid",currency:"gbp",amount_total:4900,client_reference_id:input.accountId,metadata:{purchase:"lifetime_access_v1",user_id:input.accountId,attempt_id:input.attemptId},customer:"cus_isolated",subscription:null,url:"https://checkout.stripe.com/c/pay/synthetic",expires_at:Math.floor(Date.now()/1000)+1800,livemode:false,line_items:{data:[{quantity:1,price:{id:price.id}}]},payment_intent:null});
      return sessions.get(input.idempotencyKey);
    }};
    const results=await Promise.all([payment.prepareLifetimePurchase(a,provider),payment.prepareLifetimePurchase(a,provider)]);
    assert.equal(results[0].url,results[1].url);assert.equal(sessions.size,1);
    const s=[...sessions.values()][0];
    await assert.rejects(()=>payment.fulfillLifetimePurchase(`${prefix}-unpaid`,s.id,provider));
    s.status="complete";s.payment_status="paid";s.payment_intent={id:`pi_${prefix}`,status:"succeeded",amount_received:4900,currency:"gbp",customer:"cus_isolated",latest_charge:{paid:true,refunded:false,amount_refunded:0,disputed:false}};
    await payment.fulfillLifetimePurchase(`${prefix}-paid`,s.id,provider);
    assert.equal((await payment.fulfillLifetimePurchase(`${prefix}-duplicate`,s.id,provider)).replay,true);
    const profile=await repository.getUserProfile(a);assert.equal(profile.plan,"free");assert.equal(profile.stripe_customer_id,"cus_isolated");assert.equal((await ledger.getLifetimeBalance(a)).text,12);
    await assert.rejects(()=>payment.prepareLifetimePurchase(a,provider));
    await repository.updateSubscriptionStatus({userId:a,plan:"free",status:"canceled",stripeCustomerId:"cus_isolated"});assert.equal((await ledger.getLifetimeBalance(a)).text,12);
    await payment.suspendLifetimePurchase(`${prefix}-refund`,s.payment_intent.id,"refund");await payment.suspendLifetimePurchase(`${prefix}-refund`,s.payment_intent.id,"refund");
    await assert.rejects(()=>payment.fulfillLifetimePurchase(`${prefix}-reordered`,s.id,provider));assert.equal(await ledger.getLifetimeBalance(a),null);
    assert.equal((await repository.getUserProfile(a)).stripe_customer_id,"cus_isolated");
    const paid=await account();await assert.rejects(()=>payment.prepareLifetimePurchase(paid,provider));
    const b=await account({plan:"free",subscription_status:"none"});await payment.prepareLifetimePurchase(b,provider);
    const abandoned=[...sessions.values()].find(s=>s.client_reference_id===b);abandoned.status="expired";
    await assert.rejects(()=>payment.prepareLifetimePurchase(b,provider));await payment.prepareLifetimePurchase(b,provider);
    assert.equal((await pool.query("SELECT jsonb_array_length(attempt_history) AS n FROM contentos_app.lifetime_purchases WHERE account_id=$1",[b])).rows[0].n,1);
    const fresh=[...sessions.values()].filter(s=>s.client_reference_id===b).at(-1);
    fresh.status="complete";fresh.payment_status="paid";fresh.customer="cus_isolated";fresh.payment_intent={...s.payment_intent,id:`pi_${prefix}-dispute`};
    await payment.suspendLifetimePurchase(`${prefix}-dispute-first`,fresh.payment_intent.id,"dispute");
    await assert.rejects(()=>payment.fulfillLifetimePurchase(`${prefix}-late-complete`,fresh.id,provider));assert.equal(await ledger.getLifetimeBalance(b),null);
  });
  await check("actual image route accounts known costs once and retains uncertain failed calls",async()=>{
    const a=await account(lifetime);let calls=0, fail=false;
    const route=loadTs("app/api/generate-image/route.ts",{
      ...mocks,"next/server":{NextResponse:Response},"@/lib/repository":repository,
      "@/lib/auth":{getCurrentUser:async()=>({id:a,email:`${a}@example.invalid`})},
      "@/lib/backend":{isDatabaseConfigured:()=>true},"@/lib/env":{isStripeConfigured:()=>false},
      "@/lib/request-security":{rejectUnsafeWrite:()=>null}
    },new Map(),{...runtime,fetch:async()=>{calls++;if(fail)throw new Error("Synthetic provider uncertainty");return Response.json({data:[{b64_json:PNG}],usage:{input_tokens:100,output_tokens:100}});}});
    const send=body=>route.POST(new Request("https://test.invalid/api/generate-image",{method:"POST",headers:{"X-ContentOS-Account":a},body:JSON.stringify(body)}));
    const body=imageInput({requestId:randomUUID()});assert.equal((await send(body)).status,200);assert.equal((await send(body)).status,200);assert.equal(calls,1);
    assert.equal((await ledger.getLifetimeBalance(a)).image,3);
    fail=true;const failed=imageInput({requestId:randomUUID(),outputText:"Another isolated synthetic draft for a provider uncertainty check."});
    const response=await send(failed);assert.equal(response.status,200);assert.equal((await response.json()).creditCharged,false);
    const state=await row(a,failed.requestId);assert.equal(state.state,"uncertain");assert.equal(Number(state.accounted_microgbp),Number(state.reserved_microgbp));
    assert.equal((await ledger.getLifetimeBalance(a)).image,2);assert.equal((await send(failed)).status,200);assert.equal(calls,2);
    await opening(30_000_000);assert.equal((await send(imageInput({requestId:randomUUID()}))).status,503);assert.equal(calls,2);assert.equal((await ledger.getLifetimeBalance(a)).image,2);await opening();
  });
  await check("runtime database role cannot reset budgets, delete audit records or change reserved maxima",async()=>{
    const privilege=(await pool.query(`SELECT
      has_table_privilege('contentos_runtime','contentos_app.ai_spend_requests','DELETE') AS can_delete,
      has_column_privilege('contentos_runtime','contentos_app.ai_spend_requests','reserved_microgbp','UPDATE') AS can_reprice,
      has_column_privilege('contentos_runtime','contentos_app.ai_budget_configuration','opening_microgbp','UPDATE') AS can_reset,
      has_column_privilege('contentos_runtime','contentos_app.ai_spend_requests','accounted_microgbp','UPDATE') AS can_settle`)).rows[0];
    assert.deepEqual(privilege,{can_delete:false,can_reprice:false,can_reset:false,can_settle:true});
  });
  console.log(`PASS: ${checks} isolated commercial scenarios; no real provider or Stripe calls.`);
} finally {
  await pool.query("DELETE FROM contentos_app.lifetime_payment_events WHERE event_id LIKE $1",[`${prefix}%`]);
  await pool.query("DELETE FROM contentos_app.lifetime_purchases WHERE account_id=ANY($1::text[])",[ids]);
  await pool.query("DELETE FROM contentos_app.ai_spend_requests WHERE account_id=ANY($1::text[])",[ids]);
  await pool.query("DELETE FROM contentos_app.profiles WHERE id=ANY($1::text[]) AND data->>'private_test_marker'=$2",[ids,prefix]);
  if(configBefore) await pool.query("UPDATE contentos_app.ai_budget_configuration SET starts_month=$1,opening_microgbp=$2,suspended=$3,evidence_reference=$4,approved_at=$5 WHERE singleton=true",[configBefore.starts_month,configBefore.opening_microgbp,configBefore.suspended,configBefore.evidence_reference,configBefore.approved_at]);
  else await pool.query("DELETE FROM contentos_app.ai_budget_configuration WHERE evidence_reference IN ('isolated-synthetic-tests','provider-bound-review-required')");
  await pool.end();
}
