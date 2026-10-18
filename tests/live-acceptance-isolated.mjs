import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import pg from "pg";
import {validateImageIsolatedEnvironment} from "./image-isolated.mjs";
import {buildPlan} from "../scripts/live-acceptance/plan.mjs";
import {SCHEMA,execute,loadModules,validatePayload,sha} from "../scripts/live-acceptance/runtime.mjs";
import {database} from "../scripts/live-acceptance/database.mjs";
import {request as capturedRequest,classificationResponse} from "./classification-capture-helpers.mjs";
validateImageIsolatedEnvironment(process.env);
const suffix=randomBytes(6).toString("hex"),schema=`staged_test_${suffix}`,role=`staged_runner_test_${suffix}`;
const url=new URL(process.env.DATABASE_URL);url.search="?sslmode=verify-full";
const owner=new pg.Client({connectionString:url.href,statement_timeout:10000});owner.on("error",()=>{});
const p=buildPlan(Date.now()+3600000);p.account=`staged-validation-test-${randomUUID()}`;p.request={...capturedRequest,requestId:randomUUID()};
const pass=randomBytes(24).toString("hex"),checks=[];let a,b,created=false;
try{
 await owner.connect();await owner.query("BEGIN");
 await owner.query(readFileSync(new URL("../scripts/live-acceptance/ledger.sql",import.meta.url),"utf8").replaceAll(SCHEMA,schema));
 await owner.query(`CREATE ROLE ${role} LOGIN NOINHERIT PASSWORD '${pass}' VALID UNTIL '${new Date(Date.now()+3600000).toISOString()}'`);
 await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role}`);
 await owner.query(`INSERT INTO ${schema}.campaign(id,plan_hash,account_id,expires_at,enabled) VALUES(true,$1,$2,now()+interval '1 hour',true)`,[p.planHash,p.account]);
 const data={id:p.account,email:`${p.account}@example.invalid`,plan:"pro_studio",subscription_status:"active",staged_validation_plan:p.planHash,synthetic:true};
 await owner.query("INSERT INTO contentos_app.profiles(id,email,data) VALUES($1,$2,$3::jsonb)",[p.account,data.email,JSON.stringify(data)]);
 await owner.query("COMMIT");created=true;
 url.username=role;url.password=pass;a=new pg.Client({connectionString:url.href});b=new pg.Client({connectionString:url.href});a.on("error",()=>{});b.on("error",()=>{});await a.connect();await b.connect();
 for(const query of [`SELECT * FROM ${schema}.campaign`,`UPDATE ${schema}.campaign SET reserved=0`,`SELECT * FROM contentos_app.profiles`,`SELECT * FROM contentos_auth."user"`])await assert.rejects(a.query(query));
 checks.push("runner has EXECUTE-only access, no auth/customer-schema or direct ledger access");
 const la=database(a,p,schema),lb=database(b,p,schema),stages=loadModules(p.modules)("lib/generation-stages.ts");
 const admitted=await la.mutate(d=>stages.beginGenerationStage(d,p.account,p.request.requestId,p.request,null));assert.equal(admitted.status,"dispatch");
 const body=JSON.stringify(admitted.stage.payload),cost=validatePayload(body).reserve;
 const replies=await Promise.all([la.reserve(admitted.stage.key,body),lb.reserve(admitted.stage.key,body)]);assert.equal(replies.filter(Boolean).length,1);
 assert.equal((await la.inspect()).reserved,cost);checks.push("two independent connections admit exactly one prepaid call");
 await assert.rejects(la.reserve("1:review:0:0",body));await assert.rejects(a.query(`SELECT ${schema}.reserve(null,$1,$2)`,[admitted.stage.key,body]));
 checks.push("active call, null authorization and mismatched stage refused");
 await a.query("BEGIN");await la.finish(admitted.stage.key,"unknown",{failure:"synthetic"});assert.equal((await la.inspect()).enabled,false);assert.equal((await la.inspect()).reserved,cost);await a.query("ROLLBACK");
 checks.push("unknown outcome closes admissions without refunds; transaction rollback is real");
 await assert.rejects(la.mutate(d=>({data:{...d,id:"different"},result:null})));assert.equal((await la.snapshot()).id,p.account);
 checks.push("profile write cannot change account binding");
 // Reset only this disposable test schema and synthetic row, never the live campaign.
 await owner.query(`TRUNCATE ${schema}.jobs`);await owner.query(`UPDATE ${schema}.campaign SET reserved=0,revision=0`);
 await owner.query("UPDATE contentos_app.profiles SET data=$2::jsonb WHERE id=$1",[p.account,JSON.stringify(data)]);
 const transport=async body=>{const r=classificationResponse(JSON.parse(body));return {...r,model:"gpt-5.2",service_tier:"default",usage:{...r.usage,total_tokens:r.usage.input_tokens+r.usage.output_tokens}};};
 const result=await execute(p,{ledger:la,apiKey:"synthetic",transport});assert.equal(result.status,"delivered");assert.equal(result.calls,13);assert.equal(result.recoveryVerified,true);assert.equal(result.pipelineAudit.reviewedUnits,280);
 checks.push("thirteen mock provider calls complete local repair and full fresh revalidation with real SQL, exact final history/usage and checkpoint recovery");
 const audit=await la.inspect();assert.equal(audit.enabled,false);assert.equal(audit.jobs.length,13);assert.ok(audit.reserved<=2700000);await assert.rejects(lb.reserve("1:review:0:7",body));
 checks.push("completed campaign cannot reopen or consume another call");
 // Boundary checks are rolled back in the disposable schema.
 await owner.query("BEGIN");await owner.query(`UPDATE ${schema}.campaign SET enabled=true,outcome=null,reserved=2699999`);
 await owner.query(`DELETE FROM ${schema}.jobs WHERE id=$1`,[admitted.stage.key]);
 const running={...data,generation_reservations_json:[{pipeline:{metrics:[{key:admitted.stage.key,status:"running",payloadHash:sha(body),reservedMicroUsd:validatePayload(body).applicationReserve}]}}]};
 await owner.query("UPDATE contentos_app.profiles SET data=$2::jsonb WHERE id=$1",[p.account,JSON.stringify(running)]);
 const lo=database(owner,p,schema);await owner.query("SAVEPOINT denied");await assert.rejects(lo.reserve(admitted.stage.key,body),/budget/);await owner.query("ROLLBACK TO denied");await owner.query("ROLLBACK");
 checks.push("GBP2.70 cumulative boundary rejects before dispatch");
 await owner.query("BEGIN");await owner.query(`UPDATE ${schema}.campaign SET enabled=true,outcome=null,reserved=13`);await owner.query(`TRUNCATE ${schema}.jobs`);
 for(let i=0;i<13;i++)await owner.query(`INSERT INTO ${schema}.jobs(id,body,payload_hash,reserved,state) VALUES($1,$2,$3,1,'succeeded')`,[`1:review:0:${i}`,body,sha(body)]);
 await owner.query("UPDATE contentos_app.profiles SET data=$2::jsonb WHERE id=$1",[p.account,JSON.stringify(running)]);
 await owner.query("SAVEPOINT denied");await assert.rejects(lo.reserve(admitted.stage.key,body),/budget/);await owner.query("ROLLBACK TO denied");await owner.query("ROLLBACK");
 checks.push("13-call ceiling refuses request 14 independently of monetary headroom");
 await owner.query("BEGIN");await owner.query(`UPDATE ${schema}.campaign SET enabled=true,outcome=null,expires_at=now()-interval '1 second'`);
 await owner.query("SAVEPOINT denied");await assert.rejects(lo.reserve(admitted.stage.key,body));await owner.query("ROLLBACK TO denied");await owner.query("ROLLBACK");
 checks.push("expired authorization cannot admit another call");
 console.log(JSON.stringify({status:"PASS",checks,paidCalls:0}));
}catch(e){console.error(JSON.stringify({status:"FAIL",checks,reason:e instanceof assert.AssertionError?e.message.split("\n")[0]:"isolated validation failure",databaseCode:e.code,sqlPosition:e.position}));process.exitCode=1;}
finally{
 for(const c of [a,b]){await c?.query("ROLLBACK").catch(()=>{});await c?.end().catch(()=>{});}
 await owner.query("ROLLBACK").catch(()=>{});
 if(created){await owner.query("DELETE FROM contentos_app.profiles WHERE id=$1 AND data->>'staged_validation_plan'=$2",[p.account,p.planHash]);await owner.query(`DROP SCHEMA ${schema} CASCADE`);await owner.query(`DROP ROLE ${role}`);}
 await owner.end().catch(()=>{});
}
