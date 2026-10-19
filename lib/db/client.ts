import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import { previewFixturesEnabled } from "@/lib/preview-fixtures";

let pool: Pool | undefined;
export function getPool() {
  if (process.env.VERCEL_ENV === "preview" && process.env.CONTENTOS_PREVIEW_FIXTURES !== "1") throw new Error("This integration Preview requires isolated fixtures.");
  previewFixturesEnabled();
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000, statement_timeout: 10000 });
    pool.on("error", () => console.error("[database] idle connection closed"));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}
export function getDb() { return drizzle(getPool()); }
