import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { validateManifest, validateRuntime, demand, executePlan, SCHEMA, ROLE } from "./runtime.mjs";

let client, plan;
try {
  plan = validateManifest(JSON.parse(readFileSync("signed-plan.json", "utf8")), readFileSync("operator-public.pem", "utf8"));
  const connectionString = validateRuntime(process.env), apiKey = process.env.OPENAI_API_KEY;
  for (const name of Object.keys(process.env)) if (/DATABASE|POSTGRES|STRIPE|RESEND|BETTER_AUTH|OPENAI/.test(name)) delete process.env[name];
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 15000, application_name: "contentos-grounding-benchmark" });
  client.on("error", () => {}); await client.connect();
  const { rows: [access] } = await client.query(`select current_user as role,current_database() as db,
    has_schema_privilege(current_user,'contentos_auth','USAGE') as auth,
    has_schema_privilege(current_user,'contentos_app','USAGE') as app,
    has_table_privilege(current_user,'${SCHEMA}.campaign','SELECT') as direct_read,
    has_table_privilege(current_user,'${SCHEMA}.campaign','UPDATE') as direct_write`);
  demand(access.role === ROLE && access.db === "contentos" && !access.auth && !access.app && !access.direct_read && !access.direct_write, "excess_privilege");
  const query = async (name, args) => (await client.query(`select ${SCHEMA}.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args)).rows[0].value;
  const ledger = { inspect: h => query("inspect", [h]), reserve: (h, j, p, prev) => query("reserve", [h, j, p, prev]),
    finish: (h, j, s, e) => query("finish", [h, j, s, JSON.stringify(e)]), outcome: (h, p, e) => query("outcome", [h, p, JSON.stringify(e)]), disable: h => query("disable", [h]) };
  console.log("Protected Preview build preflight passed. Existing provider credential remains in process memory only.");
  console.log(JSON.stringify({ benchmarkFinished: true, ...await executePlan(plan, { ledger, apiKey }) }));
  mkdirSync("public", { recursive: true });
  writeFileSync("public/index.html", "<!doctype html><meta name=robots content=noindex><title>Benchmark closed</title><p>Execution has ended. No benchmark endpoint exists.</p>");
} catch {
  console.error("Benchmark stopped closed. Inspect isolated audit; no automatic provider retry.");
  process.exitCode = 1;
} finally {
  if (client && plan) await client.query(`select ${SCHEMA}.disable($1)`, [plan.planHash]).catch(() => {});
  await client?.end().catch(() => {});
}
