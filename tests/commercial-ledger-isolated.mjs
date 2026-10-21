import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { loadTs, imageInput, PNG } from "./image-test-helpers.mjs";

assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH,"br-divine-term-b2rihbxv");
assert.ok(["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech","ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(new URL(process.env.DATABASE_URL).hostname));
for(const key of ["OPENAI_API_KEY","STRIPE_SECRET_KEY","RESEND_API_KEY"]) assert.ok(!process.env[key]);
const directUrl=new URL(process.env.DATABASE_URL);
directUrl.hostname=directUrl.hostname.replace("-pooler","");
const pool=new Pool({connectionString:directUrl.href,max:8});
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
async function opening(amount=0){await pool.query("UPDATE contentos_app.ai_budget_configuration SET opening_microgbp=$1,suspended=false",[amount]);}
try {
  const exists=(await pool.query("SELECT to_regclass('contentos_app.ai_spend_requests') AS name")).rows[0].name;
  if(!exists) await pool.query(readFileSync(new URL("../drizzle/0003_commercial_spending.sql",import.meta.url),"utf8"));
  // The earlier isolated proposal had an extra required column. Preserve its records,
  // while allowing this shared-only migration/implementation to be tested in place.
  else if ((await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema='contentos_app' AND table_name='ai_spend_requests' AND column_name='lifetime'")).rowCount) {
    await pool.query("ALTER TABLE contentos_app.ai_spend_requests ALTER COLUMN lifetime SET DEFAULT false");
  }
  const migration=readFileSync(new URL("../drizzle/0003_commercial_spending.sql",import.meta.url),"utf8");
  await pool.query(migration.slice(migration.indexOf("REVOKE ALL")));
  configBefore=(await pool.query("SELECT * FROM contentos_app.ai_budget_configuration")).rows[0]??null;
  await pool.query("INSERT INTO contentos_app.ai_budget_configuration(singleton,starts_month,opening_microgbp,evidence_reference) VALUES(true,to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM'),0,'isolated-synthetic-tests') ON CONFLICT(singleton) DO UPDATE SET starts_month=EXCLUDED.starts_month,opening_microgbp=0,suspended=false,evidence_reference=EXCLUDED.evidence_reference");
  await check("fresh migration creates only shared controls and preserves historical tables",async()=>{
    const c=await pool.connect(),schema=`spending_test_${randomUUID().replaceAll("-","")}`;
    try {
      await c.query("BEGIN");
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`CREATE TABLE ${schema}.profiles(id text PRIMARY KEY)`);
      await c.query(migration.replaceAll("contentos_app.",`${schema}.`));
      const tables=(await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name",[schema])).rows.map(r=>r.table_name);
      assert.deepEqual(tables,["ai_budget_alerts","ai_budget_configuration","ai_spend_requests","profiles"]);
      assert.equal((await c.query("SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND column_name='lifetime'",[schema])).rowCount,0);
    } finally {await c.query("ROLLBACK");c.release();}
  });
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
    const a=await account();await opening(25_000_000-current);await reserve(a,"warning");
    const alerts=(await pool.query("SELECT threshold_microgbp FROM contentos_app.ai_budget_alerts WHERE month=to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM')")).rows;
    assert.deepEqual(alerts.map(r=>Number(r.threshold_microgbp)).sort(),[20_000_000,25_000_000]);
    await opening(30_000_000);await assert.rejects(()=>reserve(a,"no-capacity"),e=>e.code==="global_capacity_exhausted");
    assert.equal(await row(a,"no-capacity"),undefined);await finish(a,"warning");await opening();
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
    const a=await account();let providerCalls=0;
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
    assert.equal(data.generation_history_json.length,1);assert.equal(data.usage_events_json.length,1);
    assert.equal((await repository.getWorkspace(a)).store.recent.length,1);
  });
  await check("actual image route accounts known costs once and retains uncertain failed calls",async()=>{
    const a=await account();let calls=0, fail=false;
    const route=loadTs("app/api/generate-image/route.ts",{
      ...mocks,"next/server":{NextResponse:Response},"@/lib/repository":repository,
      "@/lib/auth":{getCurrentUser:async()=>({id:a,email:`${a}@example.invalid`})},
      "@/lib/backend":{isDatabaseConfigured:()=>true},"@/lib/env":{isStripeConfigured:()=>false},
      "@/lib/request-security":{rejectUnsafeWrite:()=>null}
    },new Map(),{...runtime,fetch:async()=>{calls++;if(fail)throw new Error("Synthetic provider uncertainty");return Response.json({data:[{b64_json:PNG}],usage:{input_tokens:100,output_tokens:100}});}});
    const send=body=>route.POST(new Request("https://test.invalid/api/generate-image",{method:"POST",headers:{"X-ContentOS-Account":a},body:JSON.stringify(body)}));
    const body=imageInput({requestId:randomUUID()});assert.equal((await send(body)).status,200);assert.equal((await send(body)).status,200);assert.equal(calls,1);
    assert.equal((await row(a,body.requestId)).delivered,true);
    fail=true;const failed=imageInput({requestId:randomUUID(),outputText:"Another isolated synthetic draft for a provider uncertainty check."});
    const response=await send(failed);assert.equal(response.status,200);assert.equal((await response.json()).creditCharged,false);
    const state=await row(a,failed.requestId);assert.equal(state.state,"uncertain");assert.equal(Number(state.accounted_microgbp),Number(state.reserved_microgbp));
    assert.equal((await row(a,failed.requestId)).delivered,false);assert.equal((await send(failed)).status,200);assert.equal(calls,2);
    await opening(30_000_000);assert.equal((await send(imageInput({requestId:randomUUID()}))).status,503);assert.equal(calls,2);assert.equal((await row(a,failed.requestId)).delivered,false);await opening();
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
  await pool.query("DELETE FROM contentos_app.ai_spend_requests WHERE account_id=ANY($1::text[])",[ids]);
  await pool.query("DELETE FROM contentos_app.profiles WHERE id=ANY($1::text[]) AND data->>'private_test_marker'=$2",[ids,prefix]);
  if(configBefore) await pool.query("UPDATE contentos_app.ai_budget_configuration SET starts_month=$1,opening_microgbp=$2,suspended=$3,evidence_reference=$4,approved_at=$5 WHERE singleton=true",[configBefore.starts_month,configBefore.opening_microgbp,configBefore.suspended,configBefore.evidence_reference,configBefore.approved_at]);
  else await pool.query("DELETE FROM contentos_app.ai_budget_configuration WHERE evidence_reference IN ('isolated-synthetic-tests','provider-bound-review-required')");
  await pool.end();
}
