import { COST_POLICY } from "@/lib/ai-cost";
import type { PoolClient } from "pg";
import { LIFETIME_INITIAL_SALES_LIMIT } from "@/lib/lifetime-access";

// Advisory only: sales stay hard-disabled. Unknown opening spend must never imply zero.
export function proposedLifetimeSales(input: {
  reconciled: boolean;
  opening: number | null;
  currentReservations: number;
  outstandingLifetimeCommitments: number;
  protectedCustomerReserve: number;
}) {
  const amounts=[input.opening,input.currentReservations,input.outstandingLifetimeCommitments,input.protectedCustomerReserve];
  if(!input.reconciled || amounts.some(n=>n===null || !Number.isSafeInteger(n) || n<0)) return {available:0,maximumSales:0};
  const available=Math.max(0,COST_POLICY.monthly-amounts.reduce<number>((total,n)=>total+n!,0));
  return {available,maximumSales:Math.floor(available/COST_POLICY.lifetime)};
}

// Called inside the same global transaction as checkout-attempt creation.
export async function assertLifetimeSalesCapacity(c: PoolClient) {
  if(LIFETIME_INITIAL_SALES_LIMIT<1 || new Date()>=new Date(COST_POLICY.expires)) throw new Error("Lifetime sales have not been approved.");
  const config=(await c.query("SELECT * FROM contentos_app.ai_budget_configuration WHERE singleton=true")).rows[0];
  const month=(await c.query("SELECT to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM') AS month")).rows[0].month;
  if(!config || config.suspended || month<config.starts_month || !config.evidence_reference) throw new Error("Opening budget requires reconciliation.");
  const sold=Number((await c.query("SELECT count(*) n FROM contentos_app.lifetime_purchases WHERE state NOT IN ('expired','failed')")).rows[0].n);
  if(sold>=LIFETIME_INITIAL_SALES_LIMIT) throw new Error("The approved initial Lifetime allocation is full.");
  const current=Number((await c.query("SELECT COALESCE(sum(accounted_microgbp),0) n FROM contentos_app.ai_spend_requests WHERE month=$1",[month])).rows[0].n);
  const commitments=Number((await c.query(`SELECT COALESCE(sum(GREATEST(0,10000000-COALESCE(s.used,0))),0) n
    FROM contentos_app.lifetime_purchases p LEFT JOIN
    (SELECT account_id,sum(accounted_microgbp) used FROM contentos_app.ai_spend_requests WHERE lifetime GROUP BY account_id) s USING(account_id)
    WHERE p.state IN ('creating','open','paid','disputed')`)).rows[0].n);
  const capacity=proposedLifetimeSales({reconciled:true,opening:month===config.starts_month?Number(config.opening_microgbp):0,currentReservations:current,
    outstandingLifetimeCommitments:commitments,protectedCustomerReserve:10_000_000});
  if(capacity.maximumSales<1) throw new Error("Insufficient reconciled capacity for a Lifetime commitment.");
}
