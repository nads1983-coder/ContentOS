import { notFound } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { getPool } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI capacity operations", robots: { index: false, follow: false } };
export default async function BudgetPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  const pool = getPool();
  const { rows } = await pool.query(`SELECT m.month,
    COALESCE(sum(r.accounted_microgbp),0) + CASE WHEN c.starts_month=m.month THEN c.opening_microgbp ELSE 0 END AS held,
    c.suspended FROM (SELECT to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM') AS month) m
    LEFT JOIN contentos_app.ai_spend_requests r ON r.month=m.month
    CROSS JOIN contentos_app.ai_budget_configuration c GROUP BY m.month,c.starts_month,c.opening_microgbp,c.suspended`);
  const alerts = (await pool.query("SELECT month,threshold_microgbp,created_at FROM contentos_app.ai_budget_alerts ORDER BY created_at DESC LIMIT 24")).rows;
  const current = rows[0];
  const pounds = (value: string | number) => (Number(value)/1_000_000).toFixed(2);
  return <main className="mx-auto max-w-3xl px-5 py-10 text-bone">
    <h1 className="text-2xl font-semibold">AI capacity</h1>
    <p className="mt-4">{current ? `${current.month}: £${pounds(current.held)} accounted or reserved of £30.00` : "Opening balance has not been approved. Generation is blocked."}</p>
    {current?.suspended ? <p role="alert" className="mt-3 text-red-300">Provider-cost investigation required. New AI requests are blocked.</p> : null}
    <h2 className="mt-8 text-lg font-semibold">Budget warnings</h2>
    <ul className="mt-3 space-y-2">{alerts.map(a=><li key={`${a.month}-${a.threshold_microgbp}`} role="status">{a.month}: £{pounds(a.threshold_microgbp)} threshold reached ({Number(a.threshold_microgbp)===25_000_000?"critical":"early warning"}).</li>)}</ul>
    <p className="mt-6 text-sm text-muted">Includes uncertain provider calls. No automatic budget increases or retries. Provider invoices, taxes and spending outside this application require separate reconciliation.</p>
  </main>;
}
