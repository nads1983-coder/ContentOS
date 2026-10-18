// Operator-only utility. Run through the isolated CLI credential launcher, never in the app.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { buildBenchmarkPlan, BUDGET_DIRECTORY } from "../benchmark-content.mjs";
import { PROJECT, ROLE, SCHEMA, demand, reservationForJob } from "./runner.mjs";

const mode=process.argv[2], followup=mode?.endsWith("-followup"), action=mode?.replace("-followup","");
if (["setup", "deploy"].includes(action)) {
  console.error(JSON.stringify({ error: "historical_campaign_closed_new_pipeline_requires_approval", providerCallsFromLocalOperator: 0 }));
  process.exit(1);
}
const basePrivate="/tmp/contentos-benchmark-operator-20261018";
const privateDir=basePrivate+(followup?"-followup":""), stage="/tmp/contentos-benchmark-preview-20261018"+(followup?"-followup":"");
const cli="/Users/nadinepierre/.npm/_npx/67eb4586ca667318/node_modules/vercel/dist/vc.js";
const schemaSql=readFileSync(resolve(import.meta.dirname,"ledger.sql"),"utf8");
const followupSql=readFileSync(resolve(import.meta.dirname,"followup.sql"),"utf8");
let client;
function followupPlan(base) {
  const next=buildBenchmarkPlan();
  const jobs=next.jobs.filter(j=>j.variant==="candidate").map(j=>{const job={...j,id:`${j.brief}:corrected`,variant:"corrected"};return {...job,reserveGbpMicros:reservationForJob(job)};});
  demand(3413760+jobs.reduce((s,j)=>s+j.reserveGbpMicros,0)<=5000000,"followup_exceeds_cumulative_budget");
  return {...next,phase:"followup",candidatePlanHash:next.planHash,planHash:base.planHash,startingReservedGbpMicros:3413760,
    priorJobs:base.jobs.map(({id,payloadHash})=>({id,payloadHash})),jobs};
}
async function appendFollowup(schema,role,plan,expires) {
  const password=randomBytes(32).toString("hex");
  await client.query("BEGIN");
  try {
    const {rows:[c]}=await client.query(`SELECT * FROM ${schema}.campaign WHERE id FOR UPDATE`);
    const {rows:old}=await client.query(`SELECT * FROM ${schema}.jobs ORDER BY id`);
    demand(c && !c.enabled && c.stopped_reason==="complete" && c.reserved_gbp_micros===3413760 && c.plan_hash===plan.planHash && old.length===6 && old.every(j=>j.state==="succeeded"&&plan.priorJobs.some(p=>p.id===j.id&&p.payloadHash===j.payload_hash)),"prior_audit_not_complete");
    await client.query(followupSql.replaceAll(SCHEMA,schema));
    await client.query(`INSERT INTO ${schema}.authorizations(id,prior_stopped_at,prior_stopped_reason,starting_reserved_gbp_micros,manifest) VALUES('followup-1',$1,$2,$3,$4)`,[c.stopped_at,c.stopped_reason,c.reserved_gbp_micros,JSON.stringify({candidatePlanHash:plan.candidatePlanHash,jobs:plan.jobs.map(({id,payloadHash,reserveGbpMicros})=>({id,payloadHash,reserveGbpMicros})),expires})]);
    for(const j of plan.jobs)await client.query(`INSERT INTO ${schema}.jobs(id,payload_hash,reservation_gbp_micros) VALUES($1,$2,$3)`,[j.id,j.payloadHash,j.reserveGbpMicros]);
    await client.query(`UPDATE ${schema}.campaign SET enabled=true,expires_at=$1,stopped_at=null,stopped_reason=null WHERE id`,[new Date(expires)]);
    await client.query(`ALTER ROLE ${role} LOGIN PASSWORD '${password}' VALID UNTIL '${new Date(expires).toISOString()}'`);
    await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role}`);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}
  const url=new URL(process.env.DATABASE_URL);url.username=role;url.password=password;url.search="?sslmode=verify-full";return url.href;
}
async function initialize(schema,role,plan,expires) {
  const password=randomBytes(32).toString("hex");
  await client.query("BEGIN");
  try {
    await client.query(schemaSql.replaceAll(SCHEMA,schema));
    // Names are fixed constants; the generated password contains only hexadecimal characters.
    await client.query(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}' VALID UNTIL '${new Date(expires).toISOString()}'`);
    await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role}`);
    await client.query(`INSERT INTO ${schema}.campaign(id,plan_hash,expires_at,enabled) VALUES(true,$1,$2,true)`,[plan.planHash,new Date(expires)]);
    for(const job of plan.jobs)await client.query(`INSERT INTO ${schema}.jobs(id,payload_hash) VALUES($1,$2)`,[job.id,job.payloadHash]);
    await client.query("COMMIT");
  } catch(error){await client.query("ROLLBACK");throw error;}
  const url=new URL(process.env.DATABASE_URL);url.username=role;url.password=password;url.search="?sslmode=verify-full";
  return url.href;
}
async function connectRestricted(url) {
  const c=new pg.Client({connectionString:url,connectionTimeoutMillis:15000,statement_timeout:15000});c.on("error",()=>{});await c.connect();return c;
}
async function verifyRestricted(c,role,schema) {
  const {rows:[r]}=await c.query(`select current_user as role,has_schema_privilege(current_user,'contentos_auth','USAGE') as auth,has_schema_privilege(current_user,'contentos_app','USAGE') as app,has_table_privilege(current_user,'${schema}.campaign','SELECT') as direct_read,has_table_privilege(current_user,'${schema}.campaign','UPDATE') as direct_write`);
  demand(r.role===role && !r.auth && !r.app && !r.direct_read && !r.direct_write,"role_not_restricted");
}
try {
  demand(["test","setup","deploy","report","cleanup"].includes(action),"invalid_operator_mode");
  const db=new URL(process.env.DATABASE_URL);
  demand(process.env.CONTENTOS_ISOLATED_BRANCH==="br-divine-term-b2rihbxv" && ["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech","ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(db.hostname) && db.pathname==="/contentos" && db.username==="contentos_owner","not_isolated_owner");
  demand(!process.env.OPENAI_API_KEY && !process.env.STRIPE_SECRET_KEY && !process.env.RESEND_API_KEY,"provider_key_forbidden_locally");
  db.search="?sslmode=verify-full";
  client=new pg.Client({connectionString:db.href,connectionTimeoutMillis:15000,statement_timeout:15000});client.on("error",()=>{});await client.connect();
  if(action==="test") {
    const schema=`${SCHEMA}_test`,role=`${ROLE}_test`,plan=buildBenchmarkPlan();let a,b,created=false;
    try {
      const url=await initialize(schema,role,plan,Date.now()+3600000);created=true;a=await connectRestricted(url);b=await connectRestricted(url);await verifyRestricted(a,role,schema);
      const reserve=(c,i,ph=plan.planHash)=>c.query(`select ${schema}.reserve($1,$2,$3) as ok`,[ph,plan.jobs[i].id,plan.jobs[i].payloadHash]);
      const finish=(c,i,state="succeeded")=>c.query(`select ${schema}.finish($1,$2,$3,$4)`,[plan.planHash,plan.jobs[i].id,state,JSON.stringify({synthetic:true})]);
      const inspect=async()=> (await a.query(`select ${schema}.inspect($1) as result`,[plan.planHash])).rows[0].result;
      for(const [fn,args] of [["inspect",[null]],["reserve",[null,plan.jobs[0].id,null]],["reserve",[plan.planHash,plan.jobs[0].id,null]],["finish",[null,plan.jobs[0].id,"succeeded","{}"]]]) {
        let rejected=false;try{await a.query(`select ${schema}.${fn}(${args.map((_,i)=>`$${i+1}`).join(",")})`,args);}catch{rejected=true;}demand(rejected,"null_binding_accepted");
      }
      await a.query("BEGIN");await reserve(a,0);await a.query("ROLLBACK");demand((await inspect()).reservedGbpMicros===0,"rollback_failed");
      const race=await Promise.all([reserve(a,0),reserve(b,0)]);demand(race.filter(r=>r.rows[0].ok).length===1,"duplicate_admitted");
      let refused=false;try{await reserve(b,1);}catch{refused=true;}demand(refused,"concurrent_job_not_refused");
      demand((await inspect()).reservedGbpMicros===568960,"reservation_not_durable");
      await client.query("BEGIN");
      await client.query(`select ${schema}.finish($1,$2,'unknown',$3)`,[plan.planHash,plan.jobs[0].id,JSON.stringify({synthetic:true})]);
      const unknown=(await client.query(`select ${schema}.inspect($1) as result`,[plan.planHash])).rows[0].result;
      demand(!unknown.enabled && unknown.reservedGbpMicros===568960,"uncertainty_not_closed");
      await client.query("ROLLBACK");
      await finish(a,0);await finish(b,0);demand((await reserve(b,0)).rows[0].ok===false,"completed_replayed");
      refused=false;try{await reserve(a,1,"0".repeat(64));}catch{refused=true;}demand(refused,"wrong_plan_allowed");
      await client.query(`UPDATE ${schema}.campaign SET expires_at=clock_timestamp()-interval '1 minute'`);
      refused=false;try{await reserve(a,1);}catch{refused=true;}demand(refused,"expired_campaign_admitted");
      await client.query(`UPDATE ${schema}.campaign SET expires_at=clock_timestamp()+interval '1 hour'`);
      for(let i=1;i<6;i++){demand((await reserve(a,i)).rows[0].ok,"missing_admission");await finish(a,i);}
      const complete=await inspect();demand(complete.reservedGbpMicros===3413760&&!complete.enabled,"completion_did_not_close");
      refused=false;try{await reserve(a,0);}catch{refused=true;}demand(refused,"disabled_campaign_admitted");
      if(followup) {
        const next=followupPlan(plan),url=await appendFollowup(schema,role,next,Date.now()+3600000);
        const fresh=await connectRestricted(url);try{await verifyRestricted(fresh,role,schema);}finally{await fresh.end();}
        const before=await inspect();demand(before.reservedGbpMicros===3413760&&before.jobs.filter(j=>j.state==="succeeded").length===6,"prior_reservations_changed");
        demand((await reserve(a,0)).rows[0].ok===false,"old_job_replayed");
        const admit=(c,j)=>c.query(`select ${schema}.reserve($1,$2,$3) as ok`,[plan.planHash,j.id,j.payloadHash]);
        await client.query("BEGIN");
        await client.query(`UPDATE ${schema}.campaign SET reserved_gbp_micros=4999999 WHERE id`);
        let capRejected=false;await client.query("SAVEPOINT capped");try{await admit(client,next.jobs[0]);}catch{capRejected=true;await client.query("ROLLBACK TO capped");}demand(capRejected,"cumulative_cap_bypassed");await client.query("ROLLBACK");
        const race=await Promise.all([admit(a,next.jobs[0]),admit(b,next.jobs[0])]);demand(race.filter(r=>r.rows[0].ok).length===1,"followup_duplicate");
        for(let i=0;i<3;i++){if(i) demand((await admit(a,next.jobs[i])).rows[0].ok,"followup_not_admitted");await a.query(`select ${schema}.finish($1,$2,'succeeded',$3)`,[plan.planHash,next.jobs[i].id,JSON.stringify({synthetic:true})]);}
        const end=await inspect();demand(!end.enabled&&end.reservedGbpMicros===3413760+next.jobs.reduce((s,j)=>s+j.reserveGbpMicros,0)&&end.reservedGbpMicros<=5000000,"followup_final_budget");
        console.log(JSON.stringify({followupLedgerTests:"PASS",checks:["six prior rows and reservations retained","old jobs cannot replay","cumulative GBP5 cap enforced","two connections one followup admission","exact new reservations recorded","nine successes automatically close"],maxReservedGbp:end.reservedGbpMicros/1000000,providerCalls:0}));
      }
      console.log(JSON.stringify({isolatedLedgerTests:"PASS",checks:["restricted role cannot access customer schemas or ledger tables","null plan and payload bindings refused","rollback no spend","two connections one admission","pending attempt blocks another job","durable lost-ack reservation","uncertain outcome disables without refund","idempotent completion","wrong plan refused","expired campaign refused","six-job exact budget","automatic close and replay refusal"],providerCalls:0}));
    } finally {await a?.end();await b?.end();if(created){await client.query(`DROP SCHEMA ${schema} CASCADE`);await client.query(`DROP ROLE ${role}`);}}
  } else if(action==="setup") {
    demand(!existsSync(privateDir)&&!existsSync(stage),"existing_campaign_files");
    if(existsSync(`${BUDGET_DIRECTORY}/ledger.json`)) demand(JSON.parse(readFileSync(`${BUDGET_DIRECTORY}/ledger.json`)).attempts.length===0,"prior_spend_found");
    const plan=followup?followupPlan(JSON.parse(readFileSync(`${basePrivate}/plan.json`,"utf8"))):buildBenchmarkPlan(),expires=Date.now()+3*3600000;
    const url=followup?await appendFollowup(SCHEMA,ROLE,plan,expires):await initialize(SCHEMA,ROLE,plan,expires);
    const restricted=await connectRestricted(url);try{await verifyRestricted(restricted,ROLE,SCHEMA);}finally{await restricted.end();}
    mkdirSync(privateDir,{mode:0o700});mkdirSync(stage,{mode:0o700});mkdirSync(`${stage}/.vercel`,{mode:0o700});
    const {privateKey,publicKey}=generateKeyPairSync("ed25519");
    const manifest=JSON.stringify({project:PROJECT,environment:"preview",role:ROLE,expires,planHash:plan.planHash,jobs:plan.jobs,provenance:plan.provenance,phase:plan.phase,startingReservedGbpMicros:plan.startingReservedGbpMicros,priorJobs:plan.priorJobs,candidatePlanHash:plan.candidatePlanHash});
    writeFileSync(`${stage}/signed-plan.json`,JSON.stringify({manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")}),{mode:0o600});
    writeFileSync(`${stage}/operator-public.pem`,publicKey.export({type:"spki",format:"pem"}),{mode:0o600});
    writeFileSync(`${privateDir}/state.json`,JSON.stringify({databaseUrl:url,planHash:plan.planHash,expires}),{mode:0o600});
    writeFileSync(`${privateDir}/plan.json`,JSON.stringify({...plan,validateOutput:undefined},null,2),{mode:0o600});
    // No private signing key is retained; only this exact manifest is authorized.
    for(const name of ["runner.mjs","build.mjs"])copyFileSync(resolve(import.meta.dirname,name),`${stage}/${name}`);
    writeFileSync(`${stage}/package.json`,JSON.stringify({name:"contentos-private-benchmark",private:true,type:"module",engines:{node:"24.x"},dependencies:{pg:"8.23.0"}}));
    writeFileSync(`${stage}/vercel.json`,JSON.stringify({framework:null,installCommand:"npm ci --ignore-scripts --omit=dev",buildCommand:"node build.mjs",outputDirectory:"public"}));
    writeFileSync(`${stage}/.vercel/project.json`,JSON.stringify({projectId:PROJECT,orgId:"team_wWnaRKEI1csVqPME4o84cn7k",projectName:"content-os"}));
    console.log(JSON.stringify({setup:"PASS",stage,planHash:plan.planHash,maxReservedGbp:((plan.startingReservedGbpMicros??0)+plan.jobs.reduce((s,j)=>s+(followup?j.reserveGbpMicros:568960),0))/1000000,expires:new Date(expires).toISOString(),providerCalls:0}));
  } else if(action==="deploy") {
    const state=JSON.parse(readFileSync(`${privateDir}/state.json`,"utf8"));
    demand(existsSync(`${stage}/package-lock.json`),"missing_dependency_lockfile");
    demand(Date.now()<state.expires && !existsSync(`${privateDir}/deployment-attempted`),"deployment_already_attempted_or_expired");
    writeFileSync(`${privateDir}/deployment-attempted`,new Date().toISOString(),{mode:0o600,flag:"wx"});
    // Value passes through child environment, not process arguments, source or stdout.
    const result=spawnSync(process.execPath,[cli,"deploy",stage,"--project",PROJECT,"--scope","nads1983-9570s-projects","--target","preview","--build-env","BENCHMARK_DATABASE_URL","--no-wait","--yes","--json"],{
      cwd:stage,env:{PATH:process.env.PATH,HOME:process.env.HOME,VERCEL_CLI_USE_NATIVE_BINARY:"0",BENCHMARK_DATABASE_URL:state.databaseUrl},encoding:"utf8",maxBuffer:2000000,timeout:120000});
    writeFileSync(`${privateDir}/deployment-result.json`,JSON.stringify({status:result.status,stdout:result.stdout,stderr:result.stderr}),{mode:0o600});
    demand(result.status===0,"deployment_uncertain_check_private_result");
    let output;try{output=JSON.parse(result.stdout);}catch{output={};}
    console.log(JSON.stringify({deploymentSubmitted:true,status:result.status,outputKeys:Object.keys(output),url:output.url??output.deployment?.url,id:output.id??output.deployment?.id}));
  } else if(action==="report") {
    const {rows:campaign}=await client.query(`SELECT * FROM ${SCHEMA}.campaign`);
    const {rows:jobs}=await client.query(`SELECT * FROM ${SCHEMA}.jobs ORDER BY reserved_at NULLS LAST,id`);
    writeFileSync(`${privateDir}/evidence.json`,JSON.stringify({campaign,jobs},null,2),{mode:0o600});
    console.log(JSON.stringify({campaign:campaign.map(c=>({enabled:c.enabled,reservedGbpMicros:c.reserved_gbp_micros,stoppedReason:c.stopped_reason})),jobs:jobs.map(j=>({id:j.id,state:j.state,latencyMs:j.evidence?.latencyMs,costUsd:j.evidence?.costUsd,usage:j.evidence?.usage})),evidencePath:`${privateDir}/evidence.json`}));
  } else if(action==="cleanup") {
    await client.query(`UPDATE ${SCHEMA}.campaign SET enabled=false,stopped_at=coalesce(stopped_at,clock_timestamp()),stopped_reason=coalesce(stopped_reason,'operator_cleanup') WHERE id`);
    await client.query(`ALTER ROLE ${ROLE} NOLOGIN`);
    await client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} FROM ${ROLE}`);
    await client.query(`REVOKE ALL ON SCHEMA ${SCHEMA} FROM ${ROLE}`);
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename=$1 AND pid<>pg_backend_pid()",[ROLE]);
    console.log(JSON.stringify({executionDisabled:true,runnerRoleLogin:false,auditPreserved:true,productionWrites:0}));
  }
} catch {console.error(JSON.stringify({error:"benchmark_operator_failed_closed",mode,providerCallsFromLocalOperator:0}));process.exitCode=1;}
finally {await client?.end().catch(()=>{});}
