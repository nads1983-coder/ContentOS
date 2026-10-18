import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { validateManifest, validateRuntime, demand, executePlan, SCHEMA, ROLE } from "./runner.mjs";

let client, plan;
try {
  plan=validateManifest(JSON.parse(readFileSync("signed-plan.json","utf8")),readFileSync("operator-public.pem","utf8"));
  const connectionString=validateRuntime(process.env), apiKey=process.env.OPENAI_API_KEY;
  // Never import the application or use any inherited auth/customer/billing connection.
  for (const name of Object.keys(process.env)) if (/DATABASE|POSTGRES|STRIPE|RESEND|BETTER_AUTH|OPENAI/.test(name)) delete process.env[name];
  client=new pg.Client({connectionString,connectionTimeoutMillis:15000,statement_timeout:15000,application_name:"contentos-isolated-benchmark"});
  client.on("error",()=>{});
  await client.connect();
  const {rows:[access]}=await client.query(`select current_user as role,current_database() as db,
    has_schema_privilege(current_user,'contentos_auth','USAGE') as auth_access,
    has_schema_privilege(current_user,'contentos_app','USAGE') as app_access,
    has_table_privilege(current_user,'${SCHEMA}.campaign','UPDATE') as direct_update`);
  demand(access.role===ROLE && access.db==="contentos" && !access.auth_access && !access.app_access && !access.direct_update,"excess_database_privilege");
  const query=async(name,args)=>{const r=await client.query(`select ${SCHEMA}.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as value`,args);return r.rows[0].value;};
  const ledger={inspect:h=>query("inspect",[h]),reserve:(h,j,p)=>query("reserve",[h,j,p]),finish:(h,j,s,e)=>query("finish",[h,j,s,JSON.stringify(e)]),disable:h=>query("disable",[h])};
  console.log("Benchmark preflight passed: authenticated Preview build, isolated restricted role, existing credential present.");
  const result=await executePlan(plan,{ledger,apiKey});
  console.log(JSON.stringify({benchmarkComplete:true,...result}));
  // The deployment contains only this inert page: there is no callable execution route.
  mkdirSync("public",{recursive:true});
  writeFileSync("public/index.html","<!doctype html><meta name=robots content=noindex><title>Benchmark disabled</title><p>One-shot benchmark finished. No execution endpoint exists.</p>");
} catch {
  console.error("Benchmark stopped closed. Inspect isolated audit ledger; no automatic retry.");
  process.exitCode=1;
} finally {
  if(client && plan) await client.query(`select ${SCHEMA}.disable($1)`,[plan.planHash]).catch(()=>{});
  await client?.end().catch(()=>{});
}
