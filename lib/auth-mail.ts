import "server-only";
import { randomUUID } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { getPool } from "@/lib/db/client";

async function deliver(user: { id: string; email: string }, url: string, kind: "verification" | "reset" | "signup_notice") {
  const pool = getPool();
  const account = await pool.query('SELECT disabled,legacy_account FROM contentos_auth."user" WHERE id=$1', [user.id]);
  if (!account.rows[0] || account.rows[0].disabled) return;
  if (kind === "signup_notice" && account.rows[0].legacy_account) return;
  const id = kind === "signup_notice" ? `signup-notice-${user.id}` : randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query('INSERT INTO contentos_app.mail_delivery(id,user_id,kind,status) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id', [id, user.id, kind, "pending"]);
    if (!inserted.rowCount) { await client.query("ROLLBACK"); return; }
    // Serialize two tiny budget counters. No scheduled traffic or paid overage.
    for (const [period, limit] of [[new Date().toISOString().slice(0, 10), 100], [new Date().toISOString().slice(0, 7), 3000]] as const) {
      const r = await client.query('INSERT INTO contentos_app.mail_budget(period,count) VALUES ($1,1) ON CONFLICT(period) DO UPDATE SET count=mail_budget.count+1 WHERE mail_budget.count < $2 RETURNING count', [period, limit]);
      if (!r.rowCount) throw new Error("mail_budget_exhausted");
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    console.error("[auth-mail] budget or storage unavailable");
    return;
  } finally { client.release(); }
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("mail_not_configured");
    const subject = kind === "signup_notice" ? "New ContentOS signup" : kind === "reset" ? "Reset your ContentOS password" : "Verify your ContentOS email";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": id },
      body: JSON.stringify({ from: "ContentOS <support@getcontentos.co>", to: [kind === "signup_notice" ? "nads1983@gmail.com" : user.email], subject,
        text: kind === "signup_notice" ? `New ContentOS signup\n\nSigned-up email address: ${user.email}\nTimestamp: ${new Date().toISOString()}\nApp name: ContentOS` : `${subject}\n\n${kind === "reset" ? "Use this single-use link within 30 minutes to choose your password. Existing members keep their account and saved content." : "Confirm this email address to finish setting up your account."}\n\n${url}\n\nIf you did not request this, you can ignore this email.\n\nContentOS` })
    });
    const result = await response.json() as { id?: string };
    if (!response.ok || !result.id) throw new Error("mail_provider_failed");
    await pool.query("UPDATE contentos_app.mail_delivery SET status='accepted',provider_id=$2,updated_at=now() WHERE id=$1", [id, result.id]);
    console.info("[auth-mail] accepted", { id, kind });
  } catch {
    await pool.query("UPDATE contentos_app.mail_delivery SET status='failed',updated_at=now() WHERE id=$1", [id]).catch(() => {});
    console.error("[auth-mail] delivery failed", { id, kind });
  }
}
export function queueAuthMail(user: { id: string; email: string }, url: string, kind: "verification" | "reset" | "signup_notice") {
  // Vercel keeps the function alive without leaking account-existence through response timing.
  const work = deliver(user, url, kind).catch(() => console.error("[auth-mail] delivery unavailable"));
  if (process.env.VERCEL) waitUntil(work);
  return work;
}
