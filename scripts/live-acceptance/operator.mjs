import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,rmSync} from "node:fs";
import {generateKeyPairSync,sign,randomBytes} from "node:crypto";
import pg from "pg";
import {buildPlan} from "./plan.mjs";
import {SCHEMA,ROLE,PROJECT,validateManifest,demand} from "./runtime.mjs";
import {cleanupCampaign,isDeploymentNotFound} from "../grounding-benchmark/cleanup.mjs";
import {bindDatabaseActions} from "./cleanup.mjs";
const PRIVATE="/tmp/contentos-live-acceptance-rc717",STAGE="/tmp/contentos-acceptance-preview-rc717";
const TEAM="team_wWnaRKEI1csVqPME4o84cn7k",SCOPE="nads1983-9570s-projects";
const CLI="/Users/nadinepierre/.npm/_npx/67eb4586ca667318/node_modules/vercel/dist/vc.js";
const mode=process.argv[2];let client,state,deployment;
// The single deployment has started. Only report, cleanup and read-only preflight remain.
if(["prepare","execute"].includes(mode)){
 console.error(JSON.stringify({error:"live_acceptance_campaign_closed",providerCalls:0}));process.exit(1);
}
const write=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2),{mode:0o600});
const recover=name=>{try{return JSON.parse(readFileSync(`${PRIVATE}/${name}`,"utf8"));}catch{return null;}};
function cli(args,env={}){return spawnSync(process.execPath,[CLI,...args],{cwd:existsSync(STAGE)?STAGE:process.cwd(),
 env:{PATH:process.env.PATH,HOME:process.env.HOME,VERCEL_CLI_USE_NATIVE_BINARY:"0",...env},encoding:"utf8",timeout:120000,maxBuffer:2700000});}
function api(path,extra=[]){const r=cli(["api",`${path}${path.includes("?")?"&":"?"}teamId=${TEAM}`,"--scope",SCOPE,...extra]);demand(r.status===0,"vercel_api_failed");return JSON.parse(r.stdout);}
function preflight(){
 const p=api(`/v9/projects/${PROJECT}`);
 demand(p.id===PROJECT&&p.accountId===TEAM&&p.ssoProtection?.deploymentType==="all_except_custom_domains","preview_not_protected");
 const e=api(`/v10/projects/${PROJECT}/env?decrypt=false`);
 demand(e.envs?.some(v=>v.key==="OPENAI_API_KEY"&&v.target?.includes("preview")),"existing_preview_key_unavailable");
 return {project:PROJECT,protection:p.ssoProtection,existingPreviewKeyConfigured:true,checkedAt:new Date().toISOString()};
}
async function report(){
 const {rows:campaign}=await client.query(`SELECT * FROM ${SCHEMA}.campaign`);
 const {rows:jobs}=await client.query(`SELECT * FROM ${SCHEMA}.jobs ORDER BY reserved_at`);
 const {rows:profiles}=await client.query(`SELECT p.data FROM contentos_app.profiles p JOIN ${SCHEMA}.campaign c ON p.id=c.account_id WHERE p.data->>'staged_validation_plan'=c.plan_hash`);
 write(`${PRIVATE}/evidence.json`,{campaign,jobs,profile:profiles[0]?.data});
 console.log(JSON.stringify({enabled:campaign[0].enabled,reservedGbp:campaign[0].reserved/1e6,calls:jobs.length,outcome:campaign[0].outcome?.status,reason:campaign[0].outcome?.reason,
 states:jobs.map(j=>({stage:j.id,state:j.state,durationMs:j.evidence?.durationMs,costUsd:j.evidence?.costUsd}))}));
}
async function cleanup(){
 const planHash=state?.planHash??recover("plan.json")?.planHash;
 const known=[deployment,recover("deployment.json"),...(recover("deployment-recovery.json")??[])].filter(Boolean),identities=new Map(known.map(d=>[d.id,d]));
 const result=await cleanupCampaign({projectId:PROJECT,planHash,attempted:existsSync(`${PRIVATE}/deployment-attempted`),knownDeployments:known,
  databaseSteps:bindDatabaseActions(client,SCHEMA,planHash,{
   disable:()=>client.query(`UPDATE ${SCHEMA}.campaign SET enabled=false,stopped_at=coalesce(stopped_at,clock_timestamp()) WHERE id`),
   noLogin:()=>client.query(`ALTER ROLE ${ROLE} NOLOGIN`),
   revokeFunctions:()=>client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} FROM ${ROLE}`),
   revokeSchema:()=>client.query(`REVOKE ALL ON SCHEMA ${SCHEMA} FROM ${ROLE}`),
   terminateSessions:async()=>{const {rows}=await client.query("SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE usename=$1 AND pid<>pg_backend_pid()",[ROLE]);demand(rows.every(r=>r.terminated),"termination_uncertain");},
   verifyRevocation:async()=>{const {rows}=await client.query("SELECT rolcanlogin,has_schema_privilege(oid,$1,'USAGE') AS access FROM pg_roles WHERE rolname=$2",[SCHEMA,ROLE]);demand(rows.length===1&&!rows[0].rolcanlogin&&!rows[0].access,"revocation_uncertain");}
  }),exportAudit:async()=>{await bindDatabaseActions(client,SCHEMA,planHash,{report}).report();},
  listDeployments:cursor=>{const q=new URLSearchParams({projectId:PROJECT,limit:"100","meta-benchmarkPlanHash":planHash});if(cursor!==null)q.set("until",String(cursor));const p=api(`/v6/deployments?${q}`);return {deployments:p.deployments,next:p.pagination?.next??null};},
  getDeployment:id=>{const r=cli(["api",`/v13/deployments/${encodeURIComponent(id)}?teamId=${TEAM}`,"--scope",SCOPE]);if(r.status===0)return JSON.parse(r.stdout);demand(isDeploymentNotFound(r),"lookup_uncertain");return null;},
  deleteDeployment:id=>{const r=cli(["api",`/v13/deployments/${encodeURIComponent(id)}?teamId=${TEAM}`,"--scope",SCOPE,"--method","DELETE","--dangerously-skip-permissions"]);demand(r.status===0,"delete_uncertain");},
  rememberDeployment:d=>{identities.set(d.id,d);write(`${PRIVATE}/deployment-recovery.json`,[...identities.values()]);}
 });
 write(`${PRIVATE}/cleanup.json`,{at:new Date().toISOString(),...result});
 if(result.safeToEraseRecovery){rmSync(STAGE,{recursive:true,force:true});rmSync(`${PRIVATE}/state.json`,{force:true});}
 console.log(JSON.stringify({cleanupComplete:result.safeToEraseRecovery,deleted:result.deletedDeploymentIds.length,auditRetained:result.auditExported,errors:result.errors}));
 demand(result.safeToEraseRecovery,"cleanup_incomplete");
}
try{
 demand(["prepare","execute","report","cleanup","preflight"].includes(mode),"invalid_mode");
 demand(!process.env.OPENAI_API_KEY&&!process.env.STRIPE_SECRET_KEY,"provider_credential_forbidden_locally");
 if(mode==="preflight"){console.log(JSON.stringify(preflight()));process.exit(0);}
 const url=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;
 demand(url||mode==="cleanup","not_isolated_owner");
 if(url){
  demand(process.env.CONTENTOS_ISOLATED_BRANCH==="br-divine-term-b2rihbxv"&&url.hostname==="ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech"&&url.pathname==="/contentos"&&url.username==="contentos_owner","not_isolated_owner");
  url.search="?sslmode=verify-full";
  client=new pg.Client({connectionString:url.href,connectionTimeoutMillis:15000,statement_timeout:15000});client.on("error",()=>{});
  try{await client.connect();}catch(e){if(mode!=="cleanup")throw e;}
 }
 if(mode==="prepare"){
  demand(!existsSync(PRIVATE)&&!existsSync(STAGE),"campaign_exists");const protection=preflight(),expires=Date.now()+3*3600000;
  const plan=buildPlan(expires),{publicKey,privateKey}=generateKeyPairSync("ed25519"),manifest=JSON.stringify(plan),publicPem=publicKey.export({type:"spki",format:"pem"});
  const signed={manifest,signature:sign(null,Buffer.from(manifest),privateKey).toString("base64")};validateManifest(signed,publicPem);
  mkdirSync(PRIVATE,{mode:0o700});write(`${PRIVATE}/plan.json`,plan);write(`${PRIVATE}/protection.json`,protection);
  const password=randomBytes(32).toString("hex");
  await client.query("BEGIN");
  try{
   await client.query(readFileSync(new URL("./ledger.sql",import.meta.url),"utf8"));
   await client.query(`CREATE ROLE ${ROLE} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}' VALID UNTIL '${new Date(expires).toISOString()}'`);
   await client.query(`GRANT USAGE ON SCHEMA ${SCHEMA} TO ${ROLE}`);await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} TO ${ROLE}`);
   await client.query(`INSERT INTO ${SCHEMA}.campaign(id,plan_hash,account_id,expires_at,enabled) VALUES(true,$1,$2,$3,true)`,[plan.planHash,plan.account,new Date(expires)]);
   const email=`${plan.account}@example.invalid`;
   await client.query("INSERT INTO contentos_app.profiles(id,email,data) VALUES($1,$2,$3::jsonb)",[plan.account,email,JSON.stringify({id:plan.account,email,plan:"pro_studio",subscription_status:"active",staged_validation_plan:plan.planHash,synthetic:true})]);
   await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}
  url.username=ROLE;url.password=password;state={databaseUrl:url.href,expires,planHash:plan.planHash};write(`${PRIVATE}/state.json`,state);
  mkdirSync(STAGE,{mode:0o700});mkdirSync(`${STAGE}/.vercel`,{mode:0o700});
  write(`${STAGE}/signed-plan.json`,signed);writeFileSync(`${STAGE}/operator-public.pem`,publicPem,{mode:0o600});
  for(const name of ["build.mjs","runtime.mjs","database.mjs"])copyFileSync(new URL(name,import.meta.url),`${STAGE}/${name}`);
  write(`${STAGE}/package.json`,{name:"contentos-staged-validation",private:true,type:"module",engines:{node:"24.x"},dependencies:{pg:"8.23.0"}});
  write(`${STAGE}/vercel.json`,{framework:null,installCommand:"npm ci --ignore-scripts --omit=dev",buildCommand:"node build.mjs",outputDirectory:"public"});
  write(`${STAGE}/.vercel/project.json`,{projectId:PROJECT,orgId:TEAM,projectName:"content-os"});
  console.log(JSON.stringify({prepared:true,planHash:plan.planHash,maxGbp:2.7,maxCalls:13,providerCalls:0}));
 }else if(mode==="execute"){
  state=recover("state.json");demand(state&&Date.now()<state.expires&&!existsSync(`${PRIVATE}/deployment-attempted`)&&existsSync(`${STAGE}/package-lock.json`),"cannot_execute");
  preflight();writeFileSync(`${PRIVATE}/deployment-attempted`,new Date().toISOString(),{mode:0o600,flag:"wx"});
  try{
   const r=cli(["deploy",STAGE,"--project",PROJECT,"--scope",SCOPE,"--target","preview","--meta",`benchmarkPlanHash=${state.planHash}`,"--build-env","BENCHMARK_DATABASE_URL","--no-wait","--yes","--json"],{BENCHMARK_DATABASE_URL:state.databaseUrl});
   write(`${PRIVATE}/deployment-result.json`,{status:r.status,stdout:r.stdout,stderr:r.stderr});demand(r.status===0,"deployment_uncertain");
   const o=JSON.parse(r.stdout),id=o.id??o.deployment?.id,url=o.url??o.deployment?.url;demand(id||url,"missing_identity");
   deployment=api(`/v13/deployments/${id??url}`);demand(deployment.projectId===PROJECT&&deployment.target!=="production","wrong_deployment");
   write(`${PRIVATE}/deployment.json`,{id:deployment.id,url:deployment.url,projectId:deployment.projectId,target:deployment.target,meta:deployment.meta});
   console.log(JSON.stringify({temporaryPreview:deployment.url,id:deployment.id}));
   const until=Date.now()+40*60000;
   while(!["READY","ERROR","CANCELED"].includes(deployment.readyState)&&Date.now()<until){await new Promise(r=>setTimeout(r,15000));deployment=api(`/v13/deployments/${deployment.id}`);}
   write(`${PRIVATE}/deployment-final.json`,{id:deployment.id,state:deployment.readyState,errorCode:deployment.errorCode});
   if(deployment.readyState==="READY"){
    const r=await fetch(`https://${deployment.url}`,{redirect:"manual",signal:AbortSignal.timeout(15000)}),location=r.headers.get("location")??"";
    const protectedResponse=[302,307,401,403].includes(r.status)&&(r.status>=400||location.startsWith("https://vercel.com/"));
    write(`${PRIVATE}/http-protection.json`,{status:r.status,protected:protectedResponse});demand(protectedResponse,"unprotected");
   }
  }finally{await cleanup();}
 }else if(mode==="report")await report();else await cleanup();
}catch{
 console.error(JSON.stringify({error:"staged_validation_operator_failed_closed",mode,localProviderCalls:0}));process.exitCode=1;
 if(mode==="prepare"&&client&&recover("plan.json")){
  try{
   const {rows}=await client.query(`SELECT plan_hash FROM ${SCHEMA}.campaign WHERE id`);
   if(rows[0]?.plan_hash===recover("plan.json").planHash)await cleanup();
  }catch{console.error("Preparation stopped; no provider call was made. Check isolated recovery state before any continuation.");}
 }
}
finally{await client?.end().catch(()=>{});}
