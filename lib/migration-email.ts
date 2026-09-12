import { createHash, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";

export const CAMPAIGN = "contentos-appwrite-signin-update-20260912-v1";
export const SUBJECT = "A quick ContentOS sign-in update";
export const TEXT = `Hi,

ContentOS has had an upgrade behind the scenes to make the platform more reliable and easier to maintain.

Your account, profile and membership are all still in place. The only thing you’ll need to do is reset your password once before signing in again.

Simply head to the ContentOS sign-in page (https://getcontentos.co/login), select Forgot password, and follow the reset link sent to your email.

Once that’s done, you can sign in and continue using ContentOS as normal.

Thanks for being part of ContentOS.

Best,
Nadine`;
export const HTML = TEXT.split("\n\n").map(p => `<p>${p.replace("ContentOS sign-in page (https://getcontentos.co/login)", '<a href="https://getcontentos.co/login">ContentOS sign-in page</a>').replace("select Forgot password", "select <strong>Forgot password</strong>").replaceAll("\n", "<br>")}</p>`).join("\n");
export function payload(email: string) {
  return { from: "ContentOS <support@getcontentos.co>", to: [email], subject: SUBJECT, text: TEXT, html: HTML,
    tags: [{ name: "campaign", value: CAMPAIGN }] };
}
export const CONTENT_HASH = createHash("sha256").update(JSON.stringify(payload("RECIPIENT"))).digest("hex");
export function validToken(token: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(hash, "hex"));
}
export async function authorize(pool: Pool, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const r = await pool.query("SELECT operator_token_hash,content_hash FROM contentos_app.migration_mail_campaign WHERE id=$1 AND expires_at>now()", [CAMPAIGN]);
  return !!r.rows[0] && r.rows[0].content_hash === CONTENT_HASH && validToken(token, r.rows[0].operator_token_hash);
}
export async function summary(pool: Pool) {
  const r = await pool.query("SELECT status,count(*)::int AS count FROM contentos_app.migration_mail_recipient WHERE campaign_id=$1 GROUP BY status", [CAMPAIGN]);
  return Object.fromEntries(r.rows.map(row => [row.status, row.count])) as Record<string, number>;
}

// Same payload and provider key for every retry. Never retry a sent row, or silently
// reopen an interrupted/failed row outside this invocation (provider keys expire after 24h).
export async function sendWithRetry(email: string, id: string, key: string, attempt: () => Promise<void>,
  transport: typeof fetch = fetch, sleep = (ms: number) => new Promise(r => setTimeout(r, ms))) {
  for (let n = 0; n < 3; n++) {
    await attempt(); // If durable logging fails, do not contact the provider.
    let transient = true;
    let reason = "network_or_timeout";
    try {
      const response = await transport("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": id },
        body: JSON.stringify(payload(email))
      });
      const result = await response.json().catch(() => ({})) as { id?: string };
      if (response.ok && typeof result.id === "string" && /^[a-f0-9-]{36}$/.test(result.id)) return { id: result.id };
      reason = `provider_http_${response.status}`;
      transient = response.status === 429 || response.status >= 500 || response.ok;
    } catch { /* Never log raw provider errors, headers, or recipient data. */ }
    if (!transient || n === 2) return { reason };
    await sleep(1500 * (n + 1));
  }
  return { reason: "retry_exhausted" };
}

export async function dispatchOne(pool: Pool, key: string) {
  const client = await pool.connect();
  let recipient: { id: string; email: string } | undefined;
  try {
    await client.query("BEGIN");
    const campaign = await client.query("SELECT completed_at FROM contentos_app.migration_mail_campaign WHERE id=$1 AND content_hash=$2 AND expires_at>now() FOR UPDATE", [CAMPAIGN, CONTENT_HASH]);
    if (!campaign.rows[0] || campaign.rows[0].completed_at) { await client.query("ROLLBACK"); return { outcome: "closed" }; }
    const row = await client.query(`SELECT r.id,r.email,u.id AS live_id,u.disabled,u.email AS live_email
      FROM contentos_app.migration_mail_recipient r LEFT JOIN contentos_auth."user" u ON u.id=r.user_id
      WHERE r.campaign_id=$1 AND r.status='pending' ORDER BY r.id LIMIT 1 FOR UPDATE OF r`, [CAMPAIGN]);
    if (!row.rows[0]) {
      await client.query(`UPDATE contentos_app.migration_mail_campaign SET completed_at=now() WHERE id=$1
        AND NOT EXISTS (SELECT 1 FROM contentos_app.migration_mail_recipient WHERE campaign_id=$1 AND status NOT IN ('sent','skipped'))`, [CAMPAIGN]);
      await client.query("COMMIT"); return { outcome: "no_pending" };
    }
    const r = row.rows[0];
    const reason = !r.live_id ? "deleted_account" : r.disabled ? "disabled_account" : r.email.toLowerCase() !== r.live_email.toLowerCase() ? "email_changed_since_review" : null;
    if (reason) {
      await client.query("UPDATE contentos_app.migration_mail_recipient SET status='skipped',reason=$2,updated_at=now() WHERE id=$1", [r.id, reason]);
      await client.query("COMMIT"); return { outcome: "skipped" };
    }
    for (const [period, limit] of [[new Date().toISOString().slice(0, 10), 100], [new Date().toISOString().slice(0, 7), 3000]] as const) {
      const budget = await client.query("INSERT INTO contentos_app.mail_budget(period,count) VALUES ($1,1) ON CONFLICT(period) DO UPDATE SET count=mail_budget.count+1 WHERE mail_budget.count<$2 RETURNING count", [period, limit]);
      if (!budget.rowCount) throw new Error("budget_unavailable");
    }
    await client.query("UPDATE contentos_app.migration_mail_recipient SET status='sending',first_attempt_at=now(),updated_at=now() WHERE id=$1", [r.id]);
    await client.query("COMMIT");
    recipient = r;
  } catch { await client.query("ROLLBACK"); throw new Error("campaign_storage_or_budget_unavailable"); }
  finally { client.release(); }
  if (!recipient) throw new Error("no_recipient");
  const { id, email } = recipient;
  const result = await sendWithRetry(email, id, key, async () => {
    const r = await pool.query("UPDATE contentos_app.migration_mail_recipient SET attempts=attempts+1,updated_at=now() WHERE id=$1 AND status='sending' RETURNING id", [id]);
    if (!r.rowCount) throw new Error("reservation_unavailable");
  });
  if (result.id) {
    // A failed result write leaves 'sending' for reconciliation, never eligible again.
    await pool.query("UPDATE contentos_app.migration_mail_recipient SET status='sent',provider_id=$2,sent_at=now(),updated_at=now() WHERE id=$1 AND status='sending'", [id, result.id]);
    console.info("[migration-mail] sent", { id, providerId: result.id });
    return { outcome: "sent" };
  }
  await pool.query("UPDATE contentos_app.migration_mail_recipient SET status='failed',reason=$2,updated_at=now() WHERE id=$1 AND status='sending'", [id, result.reason]);
  console.error("[migration-mail] failed", { id, reason: result.reason });
  return { outcome: "failed" };
}

export async function verifyDeliveries(pool: Pool, key: string) {
  const rows = await pool.query("SELECT id,provider_id FROM contentos_app.migration_mail_recipient WHERE campaign_id=$1 AND status='sent' ORDER BY id", [CAMPAIGN]);
  const statuses: Record<string, number> = {};
  for (const row of rows.rows) {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.provider_id)}`, {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(12000)
    });
    const result = await response.json().catch(() => ({})) as { last_event?: string };
    const status = response.ok && /^[a-z_]{1,40}$/.test(result.last_event || "") ? result.last_event! : `lookup_http_${response.status}`;
    await pool.query("UPDATE contentos_app.migration_mail_recipient SET provider_status=$2,updated_at=now() WHERE id=$1", [row.id, status]);
    statuses[status] = (statuses[status] || 0) + 1;
    await new Promise(r => setTimeout(r, 600));
  }
  return statuses;
}
