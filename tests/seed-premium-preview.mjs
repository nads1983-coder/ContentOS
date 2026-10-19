import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { validateImageIsolatedEnvironment } from "./image-isolated.mjs";

validateImageIsolatedEnvironment(process.env);
const path = process.env.PREVIEW_ACCOUNTS_FILE;
assert.ok(path?.startsWith("/tmp/contentos-premium-private/"));
assert.equal(existsSync(path), false, "Never overwrite existing review credentials");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const users = [];
try {
  await pool.query("BEGIN");
  for (const plan of ["pro_studio", "free", "founder"]) {
    const id = "premium-preview-" + randomUUID();
    const email = id + "@example.invalid", password = randomBytes(24).toString("base64url");
    await pool.query('INSERT INTO contentos_auth."user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)', [id, "Preview " + plan, email]);
    await pool.query("INSERT INTO contentos_auth.account (id,account_id,provider_id,user_id,password,updated_at) VALUES ($1,$2,'credential',$2,$3,now())", [randomUUID(), id, await hashPassword(password)]);
    const data = { id, email, full_name: "Preview " + plan, plan, subscription_status: "active", premium_preview_fixture: true,
      ...(plan === "founder" ? { founder_offer: "founding100", manual_lifetime_access: true } : {}) };
    await pool.query("INSERT INTO contentos_app.profiles (id,email,data) VALUES ($1,$2,$3::jsonb)", [id, email, JSON.stringify(data)]);
    users.push({ id, email, password, plan });
  }
  // Credentials stay private even if the final commit acknowledgement is interrupted.
  writeFileSync(path, JSON.stringify({ users }, null, 2), { mode: 0o600, flag: "wx" });
  await pool.query("COMMIT");
  console.log("Created three isolated synthetic review accounts. Credentials saved privately; no mail, payments or AI calls.");
} catch (error) { await pool.query("ROLLBACK"); throw error; }
finally { await pool.end(); }
