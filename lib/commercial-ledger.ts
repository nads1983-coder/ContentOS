import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { AICapacityError, COST_POLICY, usageCost } from "@/lib/ai-cost";
import type { CostQuote } from "@/lib/ai-cost";
import type { UserProfile } from "@/types/saas";
export type CommercialDocument = UserProfile & Record<string, unknown>;
export type Mutation<T> = (data: CommercialDocument) => { data: CommercialDocument; result: T };
// Shared transaction lock coordinates every admission/settlement and profile mutation.
// No provider/network operation is allowed inside this callback.
export async function commercialTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(1949019030)");
    const result = await fn(client);
    await client.query("COMMIT"); return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
async function lockedProfile(client: PoolClient, id: string) {
  const row = (await client.query("SELECT data FROM contentos_app.profiles WHERE id=$1 FOR UPDATE", [id])).rows[0];
  if (!row || row.data.id !== id) throw new AICapacityError("account_unavailable");
  return row.data as CommercialDocument;
}
async function writeProfile(client: PoolClient, id: string, data: CommercialDocument) {
  await client.query("UPDATE contentos_app.profiles SET data=$2::jsonb,updated_at=now() WHERE id=$1", [id, JSON.stringify(data)]);
}
export async function reserveCommercial<T extends { status: string }>(id: string, requestId: string, quote: CostQuote, fn: Mutation<T>) {
  return commercialTransaction(async client => {
    const data = await lockedProfile(client, id);
    const changed = fn(data);
    if (changed.result.status === "replay") return changed.result;
    const configuration = (await client.query("SELECT * FROM contentos_app.ai_budget_configuration WHERE singleton=true")).rows[0];
    const month = (await client.query("SELECT to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM') AS month")).rows[0].month;
    if (!configuration || configuration.suspended || month < configuration.starts_month) throw new AICapacityError("budget_not_initialised");
    if (quote.version !== COST_POLICY.version || new Date() >= new Date(COST_POLICY.expires) || !Number.isSafeInteger(quote.maximum) || quote.maximum <= 0) throw new AICapacityError("invalid_cost_quote");
    const previous = await client.query("SELECT 1 FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND kind=$2 AND request_id=$3", [id, quote.kind, requestId]);
    if (previous.rowCount) throw new AICapacityError("provider_attempt_already_exists");
    const global = Number((await client.query("SELECT COALESCE(sum(accounted_microgbp),0) AS used FROM contentos_app.ai_spend_requests WHERE month=$1", [month])).rows[0].used) + (month === configuration.starts_month ? Number(configuration.opening_microgbp) : 0);
    if (global + quote.maximum > COST_POLICY.monthly) throw new AICapacityError("global_capacity_exhausted");
    await client.query(`INSERT INTO contentos_app.ai_spend_requests
      (account_id,kind,request_id,fingerprint,month,quote,reserved_microgbp,accounted_microgbp,state)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7,'reserved')`, [id, quote.kind, requestId, quote.hash, month, JSON.stringify(quote), quote.maximum]);
    for (const threshold of [20_000_000,25_000_000]) if (global + quote.maximum >= threshold) {
      await client.query("INSERT INTO contentos_app.ai_budget_alerts(month,threshold_microgbp) VALUES ($1,$2) ON CONFLICT DO NOTHING", [month,threshold]);
    }
    await writeProfile(client,id,changed.data); return changed.result;
  });
}
export async function dispatchCommercial(id: string, requestId: string, quote: CostQuote) {
  // Lost acknowledgement is terminal uncertainty, never permission to redispatch.
  await commercialTransaction(async c => {
    const row = (await c.query("SELECT * FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND kind=$2 AND request_id=$3 FOR UPDATE",[id,quote.kind,requestId])).rows[0];
    const configuration = (await c.query("SELECT * FROM contentos_app.ai_budget_configuration WHERE singleton=true")).rows[0];
    if (!row || row.state !== "reserved" || row.fingerprint !== quote.hash || !configuration || configuration.suspended || new Date() >= new Date(COST_POLICY.expires)) throw new AICapacityError("dispatch_not_authorised");
    const month = (await c.query("SELECT to_char(now() AT TIME ZONE 'Europe/London','YYYY-MM') AS month")).rows[0].month;
    // A reservation made before midnight must not spend the previous month's capacity.
    if (month !== row.month) {
      const total = Number((await c.query("SELECT COALESCE(sum(accounted_microgbp),0) AS used FROM contentos_app.ai_spend_requests WHERE month=$1",[month])).rows[0].used) + (month === configuration.starts_month ? Number(configuration.opening_microgbp) : 0);
      if (total + Number(row.accounted_microgbp) > COST_POLICY.monthly) throw new AICapacityError("global_capacity_exhausted");
      for (const threshold of [20_000_000,25_000_000]) if (total + Number(row.accounted_microgbp) >= threshold) await c.query("INSERT INTO contentos_app.ai_budget_alerts(month,threshold_microgbp) VALUES ($1,$2) ON CONFLICT DO NOTHING",[month,threshold]);
    }
    await c.query("UPDATE contentos_app.ai_spend_requests SET state='dispatched',month=$4,updated_at=now() WHERE account_id=$1 AND kind=$2 AND request_id=$3",[id,quote.kind,requestId,month]);
  });
}
export async function settleCommercialUsage(id: string, requestId: string, quote: CostQuote, usage: unknown) {
  let cost: number | null;
  try { cost = usageCost(quote, usage); }
  catch (error) {
    // A violated provider bound disables further admissions until an operator reconciles it.
    await commercialTransaction(async c => {
      await c.query("UPDATE contentos_app.ai_budget_configuration SET suspended=true, evidence_reference='provider-bound-review-required' WHERE singleton=true");
    });
    throw error;
  }
  await commercialTransaction(async c => {
    const row = (await c.query("SELECT * FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND kind=$2 AND request_id=$3 FOR UPDATE", [id,quote.kind,requestId])).rows[0];
    if (!row || row.fingerprint !== quote.hash || !["dispatched","settled","uncertain"].includes(row.state)) throw new AICapacityError("spend_state_mismatch");
    if (row.state === "settled") return;
    await c.query(`UPDATE contentos_app.ai_spend_requests SET state=$4,accounted_microgbp=$5,provider_usage=$6::jsonb,updated_at=now()
      WHERE account_id=$1 AND kind=$2 AND request_id=$3`, [id,quote.kind,requestId,cost === null ? "uncertain" : "settled",cost ?? row.reserved_microgbp,JSON.stringify(usage ?? null)]);
  });
}
export async function finishCommercial<T>(id: string, requestId: string, quote: CostQuote, delivered: boolean, fn: Mutation<T>) {
  return commercialTransaction(async c => {
    const data = await lockedProfile(c,id);
    const row = (await c.query("SELECT * FROM contentos_app.ai_spend_requests WHERE account_id=$1 AND kind=$2 AND request_id=$3 FOR UPDATE", [id,quote.kind,requestId])).rows[0];
    if (!row || row.fingerprint !== quote.hash) throw new AICapacityError("spend_state_mismatch");
    if (delivered && !["settled","uncertain"].includes(row.state)) throw new AICapacityError("provider_not_reconciled");
    const changed = fn(data);
    const state = row.state === "reserved" ? "released" : row.state === "dispatched" ? "uncertain" : row.state;
    await c.query("UPDATE contentos_app.ai_spend_requests SET state=$4,accounted_microgbp=$5,delivered=delivered OR $6,updated_at=now() WHERE account_id=$1 AND kind=$2 AND request_id=$3", [id,quote.kind,requestId,state,state === "released" ? 0 : row.accounted_microgbp,delivered]);
    await writeProfile(c,id,changed.data); return changed.result;
  });
}
