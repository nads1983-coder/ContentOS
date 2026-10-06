# Founder checkout claims migration

This PR adds `contentos_app.founder_checkout_claims` for durable Founding 100 checkout coordination.

## Apply

Run against a direct, non-pooled Neon connection on an isolated branch first:

```bash
DATABASE_URL_UNPOOLED="<direct branch connection string>" npx drizzle-kit migrate
```

The migration is `drizzle/0002_founder_checkout_claims.sql`.

## Rollback

Only roll back before production traffic depends on this table:

```sql
drop table if exists contentos_app.founder_checkout_claims;
delete from drizzle.__drizzle_migrations
where hash in (
  select hash
  from drizzle.__drizzle_migrations
  order by created_at desc
  limit 1
);
```

If the migration has been used in production, do not drop the table without first exporting its rows. The rows are the audit trail for open, completed, failed, invalid and expired Founder checkout attempts.

## Notes

- `founder_checkout_one_active_per_user` enforces one active `preparing` or `open` claim per account across app instances.
- `founder_checkout_claims_attempt_once` supports stable Stripe idempotency for the same logical attempt.
- `founder_checkout_claims_session_once` prevents a Stripe Checkout Session from being associated with more than one claim.
- Stripe still enforces the global Founding 100 redemption limit.
