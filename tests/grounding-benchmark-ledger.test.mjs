import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const SCHEMA = "contentos_grounding_benchmark_20261018";
const ROLE = "contentos_grounding_runner_20261018";
const sql = readFileSync(new URL("../scripts/grounding-benchmark/ledger.sql", import.meta.url), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const planHash = hash("synthetic-grounding-ledger-plan");
const packs = ["H1", "H2", "H3"].flatMap(id => [`${id}:baseline`, `${id}:candidate`]);
const jobs = packs.flatMap(pack => pack.endsWith("baseline") ? [`${pack}:draft`] : [`${pack}:draft`, `${pack}:review1`, `${pack}:review2`]);
const functions = name => {
  const match = sql.match(new RegExp(`CREATE FUNCTION ${SCHEMA}\\.${name}\\([\\s\\S]*?END \\$\\$;`));
  assert.ok(match, `missing function ${name}`);
  return match[0];
};

// Offline checks inspect the actual SQL; they are not a PostgreSQL execution substitute.
test("fixed slots allow six drafts and six reviews with an exact GBP8.507520 ceiling", () => {
  assert.equal(new Set(jobs).size, 12);
  assert.equal(jobs.filter(id => id.endsWith(":draft")).length, 6);
  assert.equal(6 * 568960 + 6 * 848960, 8507520);
  assert.ok(8507520 < 9000000);
  const pattern = new RegExp(sql.match(/CHECK \(id ~ '([^']+)'\)/)[1]);
  assert.ok(jobs.every(id => pattern.test(id)));
  for (const id of ["H4:candidate:draft", "H1:baseline:review1", "H1:candidate:review3", "H1:candidate:draft:retry"]) assert.equal(pattern.test(id), false);
  assert.match(sql, /reservation_gbp_micros integer GENERATED ALWAYS AS[\s\S]*?568960 ELSE 848960/);
});

test("stage dependencies and prices are derived, not writable runner parameters", () => {
  assert.match(sql, /depends_on text GENERATED ALWAYS AS/);
  assert.match(sql, /WHEN 'review1' THEN split_part\(id, ':', 1\) \|\| ':candidate:draft'/);
  assert.match(sql, /WHEN 'review2' THEN split_part\(id, ':', 1\) \|\| ':candidate:review1'/);
  assert.match(sql, /FOREIGN KEY \(depends_on\)[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(functions("reserve"), /dependency\.state <> 'succeeded'[\s\S]*?dependency\.response_hash IS DISTINCT FROM p_previous_response/);
});

test("every definer function pins search_path and rejects null or wrong plan hashes", () => {
  for (const name of ["inspect", "reserve", "finish", "outcome", "disable"]) {
    const body = functions(name);
    assert.match(body, /SECURITY DEFINER SET search_path = pg_catalog/);
    assert.match(body, /c\.plan_hash IS DISTINCT FROM p_hash/);
  }
  assert.match(sql, new RegExp(`REVOKE ALL ON ALL TABLES IN SCHEMA ${SCHEMA} FROM PUBLIC`));
  assert.match(sql, new RegExp(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} FROM PUBLIC`));
  assert.doesNotMatch(sql, /contentos_auth|contentos_app|stripe|CREATE ROLE|GRANT .*PUBLIC/i);
});

test("admission locks campaign before jobs, expiry, binding and irreversible reservation", () => {
  const body = functions("reserve");
  const campaignLock = body.indexOf("campaign WHERE id FOR UPDATE");
  const jobLock = body.indexOf("WHERE id = p_job FOR UPDATE");
  assert.ok(campaignLock >= 0 && campaignLock < jobLock);
  assert.match(body, /clock_timestamp\(\) >= c\.expires_at/);
  assert.match(body, /p_payload IS NULL OR p_payload !~/);
  assert.match(body, /j\.payload_hash IS NOT NULL AND j\.payload_hash IS DISTINCT FROM p_payload/);
  assert.match(body, /j\.state <> 'ready' THEN RETURN false/);
  assert.match(body, /count\(\*\)[\s\S]*?<> 12/);
  assert.match(body, /state IN \('reserved', 'failed', 'unknown'\)/);
  assert.match(body, /reserved_gbp_micros \+ j\.reservation_gbp_micros > 9000000/);
  assert.match(body, /payload_hash = p_payload,[\s\S]*?previous_response_hash = p_previous_response/);
  assert.match(sql, /CREATE UNIQUE INDEX one_active_grounding_call[\s\S]*?WHERE state = 'reserved'/);
  assert.doesNotMatch(sql, /reserved_gbp_micros\s*=\s*reserved_gbp_micros\s*-|DELETE FROM|TRUNCATE|DROP /i);
});

test("completion requires a response digest, permits late recording and never reopens admission", () => {
  const body = functions("finish");
  assert.match(body, /response_digest := p_evidence->>'responseHash'/);
  assert.match(body, /p_state = 'succeeded' AND response_digest IS NULL/);
  assert.match(body, /j\.state = p_state AND j\.evidence = p_evidence THEN RETURN/);
  assert.match(body, /j\.state <> 'reserved'/);
  assert.match(body, /p_state IN \('failed', 'unknown'\)/);
  assert.doesNotMatch(body, /SET enabled = true|clock_timestamp\(\) >= c\.expires_at/);
});

test("outcomes are nonchargeable, one-write and close optional review slots", () => {
  const body = functions("outcome");
  assert.match(body, /existing = p_evidence THEN RETURN/);
  assert.match(body, /RAISE EXCEPTION 'outcome_conflict'/);
  assert.match(body, /p_pack \|\| ':draft' AND state = 'succeeded'/);
  assert.match(body, /p_pack \|\| ':review1' AND state = 'succeeded'/);
  assert.match(body, /'delivered', 'blocked'/);
  assert.match(body, /count\(\*\)[\s\S]*?outcomes\) = 6/);
  assert.doesNotMatch(body, /SET reserved_gbp_micros/);
  assert.match(functions("reserve"), /outcomes WHERE pack_id = j\.pack_id[\s\S]*?'pack_closed'/);
});

test("evidence byte limits count logical JSON bytes rather than compressed storage", () => {
  assert.match(sql, /octet_length\(evidence::text\) <= 2000000/);
  for (const name of ["finish", "outcome"]) assert.match(functions(name), /octet_length\(p_evidence::text\) > 2000000/);
  assert.doesNotMatch(sql, /pg_column_size/);
});

// Explicit opt-in through the existing isolated credential launcher only. No provider transport exists here.
test("isolated PostgreSQL: restricted-role atomic admission, dependencies, failures, outcomes and cap", {
  skip: process.env.GROUNDING_LEDGER_ISOLATED_TEST !== "1",
  timeout: 180000
}, async t => {
  const schema = `${SCHEMA}_test`, role = `${ROLE}_test`;
  assert.equal(process.env.CONTENTOS_ISOLATED_BRANCH, "br-divine-term-b2rihbxv");
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.ok(["ep-proud-field-b291xbnc.c-6.eu-central-1.aws.neon.tech", "ep-proud-field-b291xbnc-pooler.c-6.eu-central-1.aws.neon.tech"].includes(url.hostname));
  assert.equal(url.pathname, "/contentos");
  assert.equal(decodeURIComponent(url.username), "contentos_owner");
  url.search = "?sslmode=verify-full";
  const { default: pg } = await import("pg");
  const clients = [];
  const connect = async connectionString => {
    const c = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, statement_timeout: 10000 });
    c.on("error", () => {});
    clients.push(c);
    await c.connect();
    return c;
  };
  let owner, created = false;
  try {
    owner = await connect(url.href);
    const password = randomBytes(32).toString("hex");
    await owner.query("BEGIN");
    try {
      // CREATE (never DROP/replace) refuses any existing test schema or role.
      await owner.query(sql.replaceAll(SCHEMA, schema));
      await owner.query(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}' VALID UNTIL '${new Date(Date.now() + 3600000).toISOString()}'`);
      await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role}`);
      await owner.query(`INSERT INTO ${schema}.campaign(id,plan_hash,expires_at,enabled) VALUES(true,$1,clock_timestamp()+interval '1 hour',true)`, [planHash]);
      for (const id of jobs) await owner.query(`INSERT INTO ${schema}.jobs(id,payload_hash) VALUES($1,$2)`, [id, id.endsWith(":draft") ? hash(id) : null]);
      await owner.query("COMMIT");
      created = true;
    } catch (error) { await owner.query("ROLLBACK"); throw error; }
    const restricted = new URL(url); restricted.username = role; restricted.password = password;
    const a = await connect(restricted.href), b = await connect(restricted.href);
    const invoke = async (c, name, args) => (await c.query(`SELECT ${schema}.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) AS value`, args)).rows[0].value;
    const inspect = (c = a) => invoke(c, "inspect", [planHash]);
    const dependency = id => id.endsWith(":draft") ? null : id.replace(/review[12]$/, id.endsWith("review1") ? "draft" : "review1");
    const reserve = (c, id, previous = dependency(id) && hash(`response:${dependency(id)}`)) => invoke(c, "reserve", [planHash, id, hash(id), previous]);
    const evidence = id => ({ responseHash: hash(`response:${id}`), synthetic: true });
    const finish = (c, id, state = "succeeded", value = evidence(id)) => invoke(c, "finish", [planHash, id, state, value]);
    const outcome = (c, pack, status = "delivered") => invoke(c, "outcome", [planHash, pack, { status, synthetic: true }]);

    await t.test("restricted role has function access but no direct table access", async () => {
      for (const table of ["campaign", "jobs", "outcomes"]) {
        await assert.rejects(a.query(`SELECT * FROM ${schema}.${table}`));
        await assert.rejects(a.query(`DELETE FROM ${schema}.${table}`));
      }
      assert.equal((await inspect()).reservedGbpMicros, 0);
    });
    await t.test("null, wrong hashes, invalid slots and unsatisfied dependencies do not spend", async () => {
      for (const args of [[null, jobs[0], hash(jobs[0]), null], [planHash, jobs[0], null, null], [planHash, jobs[0], hash("wrong"), null], [planHash, "H4:baseline:draft", hash("x"), null]]) {
        await assert.rejects(invoke(a, "reserve", args));
      }
      for (const fn of ["inspect", "disable"]) await assert.rejects(invoke(a, fn, [null]));
      await assert.rejects(reserve(a, "H1:candidate:review1"));
      await assert.rejects(reserve(a, jobs[0], hash("unexpected")));
      assert.equal((await inspect()).reservedGbpMicros, 0);
    });
    await t.test("rolled-back admission does not spend; concurrent duplicate admits exactly once", async () => {
      await a.query("BEGIN"); assert.equal(await reserve(a, jobs[0]), true); await a.query("ROLLBACK");
      assert.equal((await inspect()).reservedGbpMicros, 0);
      const race = await Promise.all([reserve(a, jobs[0]), reserve(b, jobs[0])]);
      assert.deepEqual(race.sort(), [false, true]);
      await assert.rejects(reserve(b, "H1:candidate:draft"));
      assert.equal((await inspect()).reservedGbpMicros, 568960);
    });
    await t.test("bad evidence cannot release a reserved call; completion is immutable/idempotent", async () => {
      await assert.rejects(finish(a, jobs[0], "succeeded", {}));
      await assert.rejects(finish(a, jobs[0], "succeeded", { ...evidence(jobs[0]), extra: "x".repeat(2000000) }));
      await assert.rejects(finish(a, jobs[0], null));
      await finish(a, jobs[0]); await finish(b, jobs[0]);
      await assert.rejects(finish(a, jobs[0], "unknown", {}));
      assert.equal(await reserve(b, jobs[0]), false);
    });
    await t.test("expiry and GBP9 cap refuse new work without changing the ledger", async () => {
      await owner.query("BEGIN");
      await owner.query(`UPDATE ${schema}.campaign SET expires_at=clock_timestamp()-interval '1 second'`);
      await owner.query("SAVEPOINT denied");
      await assert.rejects(reserve(owner, "H1:candidate:draft"));
      await owner.query("ROLLBACK TO denied"); await owner.query("ROLLBACK");
      await owner.query("BEGIN");
      await owner.query(`UPDATE ${schema}.campaign SET reserved_gbp_micros=8999999`);
      await owner.query("SAVEPOINT denied");
      await assert.rejects(reserve(owner, "H1:candidate:draft"));
      await owner.query("ROLLBACK TO denied"); await owner.query("ROLLBACK");
      assert.equal((await inspect()).reservedGbpMicros, 568960);
    });
    await t.test("durable admission cannot replay after acknowledgement loss; dependency digest binds atomically", async () => {
      await reserve(a, "H1:candidate:draft"); // Discard the acknowledgement; never dispatch/re-reserve it.
      assert.equal(await reserve(b, "H1:candidate:draft"), false);
      await finish(a, "H1:candidate:draft");
      await assert.rejects(outcome(a, "H1:candidate"));
      await assert.rejects(reserve(a, "H1:candidate:review1", null));
      await assert.rejects(reserve(a, "H1:candidate:review1", hash("wrong-response")));
      assert.equal(await reserve(a, "H1:candidate:review1"), true);
      const job = (await inspect()).jobs.find(j => j.id === "H1:candidate:review1");
      assert.equal(job.payloadHash, hash(job.id));
      assert.equal(job.previousResponseHash, hash("response:H1:candidate:draft"));
      await assert.rejects(invoke(a, "reserve", [planHash, job.id, hash("changed"), job.previousResponseHash]));
    });
    await t.test("failed and uncertain outcomes disable the entire campaign without refunds", async () => {
      for (const state of ["failed", "unknown"]) {
        await a.query("BEGIN");
        await finish(a, "H1:candidate:review1", state, { failure: "synthetic" });
        const closed = await inspect(a);
        assert.equal(closed.enabled, false);
        assert.equal(closed.reservedGbpMicros, 2 * 568960 + 848960);
        await a.query("SAVEPOINT denied");
        await assert.rejects(reserve(a, "H2:baseline:draft"));
        await a.query("ROLLBACK TO denied"); await a.query("ROLLBACK");
      }
      await finish(a, "H1:candidate:review1");
    });
    await t.test("normal blocked outcomes consume no credit, prevent optional retries and preserve other packs", async () => {
      await a.query("BEGIN");
      const before = await inspect();
      await outcome(a, "H1:candidate", "blocked");
      const after = await inspect();
      assert.equal(after.enabled, true);
      assert.equal(after.reservedGbpMicros, before.reservedGbpMicros);
      await outcome(a, "H1:candidate", "blocked");
      await a.query("SAVEPOINT denied");
      await assert.rejects(reserve(a, "H1:candidate:review2"));
      await a.query("ROLLBACK TO denied");
      assert.equal(await reserve(a, "H2:baseline:draft"), true);
      await a.query("ROLLBACK");
    });
    await t.test("all twelve paid slots consume exactly GBP8.507520, then admissions close", async () => {
      for (const stage of ["draft", "review1", "review2"]) for (const id of jobs.filter(id => id.endsWith(`:${stage}`))) {
        if ((await inspect()).jobs.find(j => j.id === id).state === "succeeded") continue;
        assert.equal(await reserve(a, id), true); await finish(a, id);
      }
      const end = await inspect();
      assert.equal(end.reservedGbpMicros, 8507520);
      assert.equal(end.jobs.filter(j => j.state === "succeeded").length, 12);
      assert.equal(end.enabled, false);
      await assert.rejects(reserve(a, jobs[0]));
    });
    await t.test("final evidence records after disable, cannot overwrite, and is nonchargeable", async () => {
      for (const pack of packs) { await outcome(a, pack); await outcome(b, pack); }
      await assert.rejects(outcome(a, packs[0], "blocked"));
      await assert.rejects(invoke(a, "outcome", [null, packs[0], { status: "delivered" }]));
      await assert.rejects(outcome(a, "H4:baseline"));
      await invoke(a, "disable", [planHash]);
      const end = await inspect();
      assert.equal(end.outcomes.length, 6);
      assert.equal(end.reservedGbpMicros, 8507520);
    });
  } finally {
    // Roll back only our sessions, and drop only artifacts successfully created by this invocation.
    for (const c of clients.slice(1)) { await c.query("ROLLBACK").catch(() => {}); await c.end().catch(() => {}); }
    if (owner) {
      await owner.query("ROLLBACK").catch(() => {});
      if (created) {
        await owner.query(`ALTER ROLE ${role} NOLOGIN`);
        await owner.query(`DROP SCHEMA ${schema} CASCADE`);
        await owner.query(`DROP ROLE ${role}`);
      }
      await owner.end();
    }
  }
});
