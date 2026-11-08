import fs from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const connectionString = fs.readFileSync(process.argv[2], "utf8").trim();
const pool = new pg.Pool({ connectionString, max: 1, options: "-c lock_timeout=5000 -c statement_timeout=30000" });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("Versioned database migrations applied.");
} finally { await pool.end(); }
