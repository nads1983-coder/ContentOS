import {readFileSync} from "node:fs";
import pg from "pg";
import {validateManifest,validateRuntime,demand,SCHEMA,ROLE} from "../runtime.mjs";
import {database} from "../database.mjs";
import {verifyOperation,step} from "../step.mjs";
export default async function handler(req,res){
 let client,ledger,phase="operator_auth";
 res.setHeader("Cache-Control","no-store");
 try{
  demand(req.method==="POST","method");
  const publicKey=readFileSync("operator-public.pem","utf8"),plan=validateManifest(JSON.parse(readFileSync("signed-plan.json","utf8")),publicKey);
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
  const op=verifyOperation(body,publicKey,plan);
  phase="runtime_environment";
  const connectionString=validateRuntime(process.env),apiKey=process.env.OPENAI_API_KEY;
  phase="database_connection";
  client=new pg.Client({connectionString,connectionTimeoutMillis:15000,statement_timeout:15000});client.on("error",()=>{});await client.connect();
  phase="database_privileges";
  const {rows:[a]}=await client.query(`SELECT current_user AS role,current_database() AS db,has_schema_privilege(current_user,'contentos_auth','USAGE') AS auth,
   has_schema_privilege(current_user,'contentos_app','USAGE') AS app,has_table_privilege(current_user,'${SCHEMA}.campaign','SELECT') AS read,has_table_privilege(current_user,'${SCHEMA}.campaign','UPDATE') AS write`);
  demand(a.role===ROLE&&a.db==="contentos"&&!a.auth&&!a.app&&!a.read&&!a.write,"excess_privilege");
  ledger=database(client,plan);phase="stage";
  const result=await step(plan,op,{ledger,apiKey});
  res.statusCode=result.status==="blocked"?409:200;res.end(JSON.stringify(result));
 }catch{
  // Fixed phase labels only, never exception strings or credential-bearing logs.
  console.error(JSON.stringify({acceptanceFailurePhase:phase}));
  if(ledger)await ledger.disable().catch(()=>{});
  res.statusCode=phase==="operator_auth"?403:503;res.end(JSON.stringify({status:"blocked",reason:phase}));
 }finally{await client?.end().catch(()=>{});}
}
