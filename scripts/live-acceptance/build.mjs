import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import pg from "pg";
import {validateManifest,validateRuntime,demand,execute,SCHEMA,ROLE} from "./runtime.mjs";
import {database} from "./database.mjs";
let client,ledger;
try {
  const plan=validateManifest(JSON.parse(readFileSync("signed-plan.json","utf8")),readFileSync("operator-public.pem","utf8"));
  const connectionString=validateRuntime(process.env),apiKey=process.env.OPENAI_API_KEY;
  for(const name of Object.keys(process.env)) if(/DATABASE|POSTGRES|STRIPE|RESEND|BETTER_AUTH|OPENAI/.test(name)) delete process.env[name];
  client=new pg.Client({connectionString,connectionTimeoutMillis:15000,statement_timeout:15000,application_name:"contentos-staged-validation"});
  client.on("error",()=>{});await client.connect();
  const {rows:[a]}=await client.query(`SELECT current_user AS role,current_database() AS db,
    has_schema_privilege(current_user,'contentos_auth','USAGE') AS auth,has_schema_privilege(current_user,'contentos_app','USAGE') AS app,
    has_table_privilege(current_user,'${SCHEMA}.campaign','SELECT') AS read,has_table_privilege(current_user,'${SCHEMA}.campaign','UPDATE') AS write`);
  demand(a.role===ROLE&&a.db==="contentos"&&!a.auth&&!a.app&&!a.read&&!a.write,"excess_privilege");
  ledger=database(client,plan);
  let refused=false;
  try { await ledger.mutate(d=>({data:{...d,id:"synthetic-other-account"},result:null})); } catch { refused=true; }
  demand(refused && (await ledger.snapshot()).id===plan.account,"account_binding_not_enforced");
  refused=false;
  try { await database(client,{...plan,planHash:"0".repeat(64)}).inspect(); } catch { refused=true; }
  demand(refused,"campaign_binding_not_enforced");
  console.log("Protected staged validation preflight passed; existing provider credential remains in memory only.");
  const outcome=await execute(plan,{ledger,apiKey});
  console.log(JSON.stringify({status:outcome.status,reason:outcome.reason,calls:outcome.calls,durationMs:outcome.durationMs}));
  mkdirSync("public",{recursive:true});
  writeFileSync("public/index.html","<!doctype html><meta name=robots content=noindex><title>Validation closed</title><p>Execution ended. No execution endpoint exists.</p>");
}catch{console.error("Staged validation stopped closed. Inspect isolated audit; no paid retry.");process.exitCode=1;}
finally{await ledger?.disable().catch(()=>{});await client?.end().catch(()=>{});}
