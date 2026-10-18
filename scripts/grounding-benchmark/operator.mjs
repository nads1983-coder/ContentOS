// Authenticated local operator. Provider credentials never leave the Vercel build.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { randomBytes, generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { buildPlan } from "./plan.mjs";
import { PROJECT, SCHEMA, ROLE, demand, validateManifest } from "./runtime.mjs";
import { cleanupCampaign, isDeploymentNotFound } from "./cleanup.mjs";

const PRIVATE = "/tmp/contentos-grounding-benchmark-20261018";
const STAGE = "/tmp/contentos-grounding-preview-20261018";
const TEAM = "team_wWnaRKEI1csVqPME4o84cn7k", SCOPE = "nads1983-9570s-projects";
const CLI = "/Users/nadinepierre/.npm/_npx/67eb4586ca667318/node_modules/vercel/dist/vc.js";
const mode = process.argv[2]; let client, state, deployment;
// Authorization consumed. Audit/cleanup remain available; this campaign cannot dispatch again.
if (["prepare", "execute"].includes(mode)) {
  console.error(JSON.stringify({ error: "controlled_grounding_campaign_closed", providerCalls: 0 }));
  process.exit(1);
}
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
function cli(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: existsSync(STAGE) ? STAGE : process.cwd(),
    env: { PATH: process.env.PATH, HOME: process.env.HOME, VERCEL_CLI_USE_NATIVE_BINARY: "0", ...env }, encoding: "utf8", timeout: 120000, maxBuffer: 4000000 });
}
function api(path, extra = []) {
  const r = cli(["api", `${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`, "--scope", SCOPE, ...extra]);
  demand(r.status === 0, "vercel_api_failed"); return JSON.parse(r.stdout);
}
function protectedProject() {
  const p = api(`/v9/projects/${PROJECT}`);
  demand(p.id === PROJECT && p.accountId === TEAM && p.ssoProtection?.deploymentType === "all_except_custom_domains", "preview_not_protected");
  return { projectId: p.id, teamId: p.accountId, ssoProtection: p.ssoProtection, checkedAt: new Date().toISOString() };
}
async function report() {
  const { rows: campaign } = await client.query(`SELECT * FROM ${SCHEMA}.campaign`);
  const { rows: jobs } = await client.query(`SELECT * FROM ${SCHEMA}.jobs ORDER BY reserved_at NULLS LAST,id`);
  const { rows: outcomes } = await client.query(`SELECT * FROM ${SCHEMA}.outcomes ORDER BY pack_id`);
  write(`${PRIVATE}/evidence.json`, { campaign, jobs, outcomes });
  console.log(JSON.stringify({ reservedGbp: campaign[0].reserved_gbp_micros / 1000000, enabled: campaign[0].enabled,
    states: jobs.map(j => ({ id: j.id, state: j.state, latencyMs: j.evidence?.latencyMs, costUsd: j.evidence?.costUsd })),
    outcomes: outcomes.map(o => ({ pack: o.pack_id, status: o.evidence.status, reason: o.evidence.reason })) }));
}
async function cleanup() {
  const recover = name => { try { return JSON.parse(readFileSync(`${PRIVATE}/${name}`, "utf8")); } catch { return null; } };
  const planHash = state?.planHash ?? recover("state.json")?.planHash ?? recover("plan.json")?.planHash;
  const journal = recover("deployment-recovery.json");
  const identities = new Map((Array.isArray(journal) ? journal : []).filter(d => typeof d?.id === "string").map(d => [d.id, d]));
  const knownDeployments = [deployment, recover("deployment.json"), ...identities.values()].filter(Boolean);
  const getDeployment = id => {
    const r = cli(["api", `/v13/deployments/${encodeURIComponent(id)}?teamId=${TEAM}`, "--scope", SCOPE]);
    if (r.status === 0) return JSON.parse(r.stdout);
    // Only an explicit API not-found result confirms absence, never a timeout or authorization failure.
    demand(isDeploymentNotFound(r), "deployment_lookup_failed");
    return null;
  };
  const result = await cleanupCampaign({ projectId: PROJECT, planHash,
    attempted: existsSync(`${PRIVATE}/deployment-attempted`), knownDeployments,
    databaseSteps: {
      disable: () => client.query(`UPDATE ${SCHEMA}.campaign SET enabled=false, stopped_at=coalesce(stopped_at,clock_timestamp()),stopped_reason=coalesce(stopped_reason,'operator_cleanup') WHERE id`),
      noLogin: () => client.query(`ALTER ROLE ${ROLE} NOLOGIN`),
      revokeFunctions: () => client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} FROM ${ROLE}`),
      revokeSchema: () => client.query(`REVOKE ALL ON SCHEMA ${SCHEMA} FROM ${ROLE}`),
      terminateSessions: async () => {
        const { rows } = await client.query("SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE usename=$1 AND pid<>pg_backend_pid()", [ROLE]);
        demand(rows.every(row => row.terminated === true), "runner_session_termination_unconfirmed");
      },
      verifyRevocation: async () => {
        const { rows } = await client.query("SELECT rolcanlogin,has_schema_privilege(oid,$1,'USAGE') AS schema_usage FROM pg_roles WHERE rolname=$2", [SCHEMA, ROLE]);
        demand(rows.length === 1 && rows[0].rolcanlogin === false && rows[0].schema_usage === false, "runner_revocation_unconfirmed");
      }
    },
    exportAudit: report,
    listDeployments: cursor => {
      const query = new URLSearchParams({ projectId: PROJECT, limit: "100", "meta-benchmarkPlanHash": planHash });
      if (cursor !== null) query.set("until", String(cursor));
      const page = api(`/v6/deployments?${query}`);
      return { deployments: page.deployments, next: page.pagination?.next ?? null };
    },
    getDeployment,
    deleteDeployment: id => {
      const deleted = cli(["api", `/v13/deployments/${encodeURIComponent(id)}?teamId=${TEAM}`, "--scope", SCOPE,
        "--method", "DELETE", "--dangerously-skip-permissions"]);
      demand(deleted.status === 0, "deployment_delete_failed");
      // Successful DELETE may have an empty body. The helper separately verifies GET 404.
    },
    rememberDeployment: value => { identities.set(value.id, value); write(`${PRIVATE}/deployment-recovery.json`, [...identities.values()]); }
  });
  write(`${PRIVATE}/cleanup.json`, { stoppedAt: new Date().toISOString(), ...result });
  // Retain credentials, marker and journal on any uncertainty. Never erase recovery before a confirmed audit.
  if (result.safeToEraseRecovery) {
    rmSync(STAGE, { recursive: true, force: true });
    rmSync(`${PRIVATE}/state.json`, { force: true });
  }
  console.log(JSON.stringify({ executionDisabled: result.database.disable === true,
    roleRevoked: result.database.noLogin === true && result.database.revokeFunctions === true && result.database.revokeSchema === true && result.database.verifyRevocation === true,
    deploymentDeleted: result.deletedDeploymentIds.length > 0, auditRetained: result.auditExported,
    cleanupComplete: result.safeToEraseRecovery, errors: result.errors }));
  demand(result.safeToEraseRecovery, "cleanup_incomplete_recovery_retained");
}
try {
  demand(["prepare", "execute", "report", "cleanup"].includes(mode), "invalid_mode");
  demand(!process.env.OPENAI_API_KEY && !process.env.STRIPE_SECRET_KEY, "provider_credential_forbidden_locally");
  const url = new URL(process.env.DATABASE_URL);
  demand(process.env.CONTENTOS_ISOLATED_BRANCH === "br-divine-term-b2rihbxv" && url.hostname === "ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech" && url.pathname === "/contentos" && url.username === "contentos_owner", "not_isolated_owner");
  url.search = "?sslmode=verify-full";
  client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 15000, statement_timeout: 15000 }); client.on("error", () => {}); await client.connect();
  if (mode === "prepare") {
    demand(!existsSync(PRIVATE) && !existsSync(STAGE), "campaign_already_exists");
    const protection = protectedProject(), expires = Date.now() + 3 * 3600000;
    const plan = buildPlan("/tmp/contentos-grounding-heldout-inputs.json", expires);
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const manifest = JSON.stringify(plan), publicPem = publicKey.export({ type: "spki", format: "pem" });
    const signed = { manifest, signature: sign(null, Buffer.from(manifest), privateKey).toString("base64") };
    validateManifest(signed, publicPem);
    const password = randomBytes(32).toString("hex");
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(new URL("./ledger.sql", import.meta.url), "utf8"));
      await client.query(`CREATE ROLE ${ROLE} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}' VALID UNTIL '${new Date(expires).toISOString()}'`);
      await client.query(`GRANT USAGE ON SCHEMA ${SCHEMA} TO ${ROLE}`);
      await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} TO ${ROLE}`);
      await client.query(`INSERT INTO ${SCHEMA}.campaign(id,plan_hash,expires_at,enabled) VALUES(true,$1,$2,true)`, [plan.planHash, new Date(expires)]);
      for (const pack of plan.packs) {
        await client.query(`INSERT INTO ${SCHEMA}.jobs(id,payload_hash) VALUES($1,$2)`, [`${pack.id}:draft`, pack.payloadHash]);
        if (pack.variant === "candidate") for (const stage of ["review1", "review2"]) await client.query(`INSERT INTO ${SCHEMA}.jobs(id) VALUES($1)`, [`${pack.id}:${stage}`]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    url.username = ROLE; url.password = password;
    mkdirSync(PRIVATE, { mode: 0o700 }); mkdirSync(STAGE, { mode: 0o700 }); mkdirSync(`${STAGE}/.vercel`, { mode: 0o700 });
    state = { databaseUrl: url.href, expires, planHash: plan.planHash };
    write(`${PRIVATE}/state.json`, state); write(`${PRIVATE}/plan.json`, plan); write(`${PRIVATE}/protection.json`, protection);
    write(`${STAGE}/signed-plan.json`, signed); writeFileSync(`${STAGE}/operator-public.pem`, publicPem, { mode: 0o600 });
    for (const name of ["build.mjs", "runtime.mjs"]) copyFileSync(new URL(name, import.meta.url), `${STAGE}/${name}`);
    write(`${STAGE}/package.json`, { name: "contentos-private-grounding-benchmark", private: true, type: "module", engines: { node: "24.x" }, dependencies: { pg: "8.23.0" } });
    write(`${STAGE}/vercel.json`, { framework: null, installCommand: "npm ci --ignore-scripts --omit=dev", buildCommand: "node build.mjs", outputDirectory: "public" });
    write(`${STAGE}/.vercel/project.json`, { projectId: PROJECT, orgId: TEAM, projectName: "content-os" });
    console.log(JSON.stringify({ prepared: true, planHash: plan.planHash, maxGbp: 8.507520, maxRequests: 12, providerCalls: 0, expires: new Date(expires).toISOString() }));
  } else if (mode === "execute") {
    state = JSON.parse(readFileSync(`${PRIVATE}/state.json`, "utf8"));
    demand(Date.now() < state.expires && !existsSync(`${PRIVATE}/deployment-attempted`) && existsSync(`${STAGE}/package-lock.json`), "cannot_execute");
    protectedProject();
    writeFileSync(`${PRIVATE}/deployment-attempted`, new Date().toISOString(), { mode: 0o600, flag: "wx" });
    try {
      const r = cli(["deploy", STAGE, "--project", PROJECT, "--scope", SCOPE, "--target", "preview", "--meta", `benchmarkPlanHash=${state.planHash}`, "--build-env", "BENCHMARK_DATABASE_URL", "--no-wait", "--yes", "--json"], { BENCHMARK_DATABASE_URL: state.databaseUrl });
      write(`${PRIVATE}/deployment-result.json`, { status: r.status, stdout: r.stdout, stderr: r.stderr });
      demand(r.status === 0, "deployment_uncertain");
      const output = JSON.parse(r.stdout), id = output.id ?? output.deployment?.id, deploymentUrl = output.url ?? output.deployment?.url;
      demand(id || deploymentUrl, "missing_deployment_identity");
      deployment = api(`/v13/deployments/${id ?? deploymentUrl}`);
      demand(deployment.projectId === PROJECT && deployment.target !== "production", "wrong_deployment");
      write(`${PRIVATE}/deployment.json`, { id: deployment.id, url: deployment.url, projectId: deployment.projectId, target: deployment.target, meta: deployment.meta });
      console.log(JSON.stringify({ temporaryPreview: deployment.url, id: deployment.id }));
      const deadline = Date.now() + 25 * 60000;
      while (!["READY", "ERROR", "CANCELED"].includes(deployment.readyState) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 15000));
        deployment = api(`/v13/deployments/${deployment.id}`);
      }
      write(`${PRIVATE}/deployment-final.json`, { id: deployment.id, state: deployment.readyState, errorCode: deployment.errorCode });
      if (deployment.readyState === "READY") {
        const r = await fetch(`https://${deployment.url}`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
        const location = r.headers.get("location") ?? "";
        const protectedResponse = [302, 307, 401, 403].includes(r.status) && (r.status >= 400 || location.startsWith("https://vercel.com/"));
        write(`${PRIVATE}/http-protection.json`, { status: r.status, protected: protectedResponse });
        demand(protectedResponse, "preview_access_not_protected");
      }
      console.log(JSON.stringify({ buildState: deployment.readyState }));
    } finally { await cleanup(); }
  } else {
    if (mode === "report") await report(); else await cleanup();
  }
} catch { console.error(JSON.stringify({ error: "grounding_benchmark_operator_failed_closed", mode, providerCallsFromLocalOperator: 0 })); process.exitCode = 1; }
finally { await client?.end().catch(() => {}); }
