import fs from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";
const [ownerFile, outputFile] = process.argv.slice(2);
const ownerUrl = new URL(fs.readFileSync(ownerFile, "utf8").trim());
ownerUrl.searchParams.set("sslmode", "verify-full");
const db = new pg.Client({ connectionString: ownerUrl.toString() });
await db.connect();
try {
  const existing = await db.query("SELECT rolname FROM pg_roles WHERE rolname='contentos_runtime'");
  if (existing.rowCount) throw new Error("Runtime role already exists; refusing to rotate automatically.");
  const password = randomBytes(48).toString("hex");
  await db.query("BEGIN");
  await db.query(`CREATE ROLE contentos_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
  await db.query('REVOKE ALL ON SCHEMA contentos_auth,contentos_app FROM PUBLIC');
  await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await db.query('REVOKE ALL ON ALL TABLES IN SCHEMA contentos_auth,contentos_app FROM PUBLIC');
  await db.query('GRANT CONNECT ON DATABASE contentos TO contentos_runtime');
  await db.query('GRANT USAGE ON SCHEMA contentos_auth,contentos_app TO contentos_runtime');
  await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA contentos_auth TO contentos_runtime');
  await db.query('GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA contentos_app TO contentos_runtime');
  await db.query('COMMIT');
  const runtimeUrl = new URL(ownerUrl);
  runtimeUrl.username = "contentos_runtime"; runtimeUrl.password = password;
  runtimeUrl.hostname = runtimeUrl.hostname.replace(/(-pooler)+(?=\.)/, "").replace(/^(ep-[^.]+)(?=\.)/, "$1-pooler");
  fs.writeFileSync(outputFile, runtimeUrl.toString(), { mode: 0o600 });
  console.log("Restricted runtime role created; private pooled URL saved. No schema, role, or ownership grants.");
} finally { await db.end(); }
