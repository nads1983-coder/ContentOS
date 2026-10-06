import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/client";
import type { FounderClaim, FounderCheckoutRepository, FounderClaimStatus } from "@/lib/founder-checkout-service";
import type { QueryResultRow } from "pg";

type ClaimRow = {
  id: string;
  user_id: string;
  email: string;
  status: FounderClaimStatus;
  attempt_key: string;
  promotion_code_id: string;
  stripe_checkout_session_id: string | null;
  stripe_checkout_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  amount_total: number | null;
  expires_at: Date | string | null;
};

function claim(row: ClaimRow): FounderClaim {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    status: row.status,
    attemptKey: row.attempt_key,
    promotionCodeId: row.promotion_code_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripeCheckoutUrl: row.stripe_checkout_url,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    amountTotal: row.amount_total,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null
  };
}

async function queryOne<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
  const result = await getPool().query<T>(sql, values);
  return result.rows[0] ?? null;
}

export const founderClaimRepository: FounderCheckoutRepository = {
  async getActiveClaim(userId) {
    const row = await queryOne<ClaimRow>(
      `select *
       from contentos_app.founder_checkout_claims
       where user_id = $1 and status in ('preparing','open')
       order by created_at desc
       limit 1`,
      [userId]
    );
    return row ? claim(row) : null;
  },

  async reserveClaim(input) {
    const client = await getPool().connect();

    try {
      await client.query("begin");
      const existing = await client.query<ClaimRow>(
        `select *
         from contentos_app.founder_checkout_claims
         where user_id = $1 and status in ('preparing','open')
         order by created_at desc
         limit 1
         for update`,
        [input.userId]
      );

      if (existing.rows[0]) {
        await client.query("commit");
        return claim(existing.rows[0]);
      }

      const inserted = await client.query<ClaimRow>(
        `insert into contentos_app.founder_checkout_claims
          (id, user_id, email, status, attempt_key, promotion_code_id)
         values ($1, $2, $3, 'preparing', $4, $5)
         returning *`,
        [
          randomUUID(),
          input.userId,
          input.email.trim().toLowerCase(),
          `founder:${input.userId}:${randomUUID()}`,
          input.promotionCodeId
        ]
      );
      await client.query("commit");
      return claim(inserted.rows[0]);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);

      if ((error as { code?: string }).code === "23505") {
        const existing = await this.getActiveClaim(input.userId);
        if (existing) return existing;
      }

      throw error;
    } finally {
      client.release();
    }
  },

  async saveOpenSession(input) {
    const row = await queryOne<ClaimRow>(
      `update contentos_app.founder_checkout_claims
       set status = 'open',
           stripe_checkout_session_id = $2,
           stripe_checkout_url = $3,
           amount_total = $4,
           expires_at = $5,
           error = null,
           updated_at = now()
       where id = $1 and status in ('preparing','open')
       returning *`,
      [
        input.claimId,
        input.stripeCheckoutSessionId,
        input.stripeCheckoutUrl,
        input.amountTotal,
        input.expiresAt ? new Date(input.expiresAt) : null
      ]
    );

    if (!row) throw new Error("Founder checkout claim is no longer active.");
    return claim(row);
  },

  async markTerminal(input) {
    await getPool().query(
      `update contentos_app.founder_checkout_claims
       set status = $2,
           error = coalesce($3, error),
           updated_at = now()
       where id = $1`,
      [input.claimId, input.status, input.error ?? null]
    );
  },

  async findClaimBySession(sessionId) {
    const row = await queryOne<ClaimRow>(
      `select *
       from contentos_app.founder_checkout_claims
       where stripe_checkout_session_id = $1
       limit 1`,
      [sessionId]
    );
    return row ? claim(row) : null;
  },

  async findActiveClaimForUser(userId) {
    return this.getActiveClaim(userId);
  },

  async findCompletedClaimBySubscription(subscriptionId) {
    const row = await queryOne<ClaimRow>(
      `select *
       from contentos_app.founder_checkout_claims
       where stripe_subscription_id = $1 and status = 'completed'
       limit 1`,
      [subscriptionId]
    );
    return row ? claim(row) : null;
  },

  async completeClaim(input) {
    await getPool().query(
      `update contentos_app.founder_checkout_claims
       set status = 'completed',
           stripe_checkout_session_id = coalesce(stripe_checkout_session_id, $2),
           stripe_customer_id = $3,
           stripe_subscription_id = $4,
           amount_total = $5,
           error = null,
           updated_at = now()
       where id = $1`,
      [
        input.claimId,
        input.stripeCheckoutSessionId,
        input.stripeCustomerId,
        input.stripeSubscriptionId,
        input.amountTotal
      ]
    );
  }
};
