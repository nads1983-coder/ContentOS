import "server-only";
import { getPool } from "@/lib/db/client";
import { COST_POLICY } from "@/lib/ai-cost";
import { configuredAccountCapacity } from "@/lib/commercial-ledger";
import { fundedLifetimePlaces, LIFETIME_CAPACITY } from "@/lib/paid-lifetime-capacity";

/** Aggregate estimates only. Old rows without entitlement snapshots remain unknown. */
export async function currentFinancialReport() {
  const pool = await getPool().connect();
  try {
  await pool.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const month = (await pool.query<{month:string}>("SELECT to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM') AS month")).rows[0].month;
  const config = (await pool.query<{starts_month:string;opening_microgbp:string;suspended:boolean}>(
    "SELECT starts_month,opening_microgbp,suspended FROM contentos_app.ai_budget_configuration WHERE singleton=true")).rows[0];
  if (!config || month < config.starts_month) throw new Error("Financial budget is not initialised.");
  const commitments=Number((await pool.query<{count:string}>(`SELECT count(*) FROM contentos_app.paid_creator_lifetime_purchases
    WHERE status IN ('preparing','open','completed','review','disputed')`)).rows[0].count);
  const groups = await pool.query<{cohort:string;customers:string;text_generations:string;image_generations:string;input_tokens:string;output_tokens:string;estimated_settled_microgbp:string;reserved_or_uncertain_microgbp:string;prepaid_generations:string;prepaid_estimated_microgbp:string}>(`
    SELECT s.customer_cohort AS cohort,
      count(DISTINCT s.account_id)::text AS customers,
      count(*) FILTER (WHERE s.kind='text' AND s.delivered)::text AS text_generations,
      count(*) FILTER (WHERE s.kind='image' AND s.delivered)::text AS image_generations,
      count(*) FILTER (WHERE s.kind='text' AND s.delivered AND r.state='consumed')::text AS prepaid_generations,
      COALESCE(sum(s.accounted_microgbp) FILTER (WHERE r.purchase_id IS NOT NULL AND s.state='settled'),0)::text AS prepaid_estimated_microgbp,
      COALESCE(sum(CASE WHEN s.provider_usage->>'input_tokens' ~ '^[0-9]{1,12}$' THEN (s.provider_usage->>'input_tokens')::bigint ELSE 0 END),0)::text AS input_tokens,
      COALESCE(sum(CASE WHEN s.provider_usage->>'output_tokens' ~ '^[0-9]{1,12}$' THEN (s.provider_usage->>'output_tokens')::bigint ELSE 0 END),0)::text AS output_tokens,
      COALESCE(sum(s.accounted_microgbp) FILTER (WHERE s.state='settled'),0)::text AS estimated_settled_microgbp,
      COALESCE(sum(s.accounted_microgbp) FILTER (WHERE s.state IN ('reserved','dispatched','uncertain')),0)::text AS reserved_or_uncertain_microgbp
    FROM contentos_app.ai_spend_requests s
    LEFT JOIN contentos_app.ai_topup_reservations r ON r.account_id=s.account_id AND r.request_id=s.request_id AND s.kind='text'
    WHERE s.month=$1 GROUP BY 1 ORDER BY 1`,[month]);
  const cohorts = groups.rows.map(row => {
    const customers=Number(row.customers), settled=Number(row.estimated_settled_microgbp), held=Number(row.reserved_or_uncertain_microgbp);
    return {cohort:row.cohort, customersWithSpendRequests:customers, textGenerations:Number(row.text_generations), imageGenerations:Number(row.image_generations),
      reportedInputTokens:Number(row.input_tokens),reportedOutputTokens:Number(row.output_tokens),
      estimatedSettledMicroGBP:settled, reservedOrUncertainMicroGBP:held,
      prepaidGenerations:Number(row.prepaid_generations ?? 0),prepaidEstimatedSettledMicroGBP:Number(row.prepaid_estimated_microgbp ?? 0),
      averageEstimatedSettledMicroGBP:customers ? Math.round(settled/customers) : 0};
  });
  const opening = month === config.starts_month ? Number(config.opening_microgbp) : 0;
  const accounted = opening + cohorts.reduce((sum,row)=>sum+row.estimatedSettledMicroGBP+row.reservedOrUncertainMicroGBP,0);
  const report = {month, classification:"Cohort captured at request admission; earlier records are unknown. Current paid Studio takes precedence over Creator lifetime.",
    spending:"Settled values are conservative usage-derived estimates, not provider invoices; holds include uncertain calls.",
    providerInvoiceActualAvailable:false, budgetMicroGBP:COST_POLICY.monthly, accountCapacityMicroGBP:configuredAccountCapacity(),
    lifetimeCommitments:commitments,additionalFundedLifetimePlaces:fundedLifetimePlaces(LIFETIME_CAPACITY.protectedMonthlyMicroGBP,commitments),
    openingMicroGBP:opening, accountedMicroGBP:accounted, remainingMicroGBP:Math.max(0,COST_POLICY.monthly-accounted),
    utilisation:accounted/COST_POLICY.monthly, suspended:config.suspended, cohorts};
  await pool.query("COMMIT");return report;
  } catch(error) {await pool.query("ROLLBACK").catch(()=>{});throw error;} finally {pool.release();}
}
