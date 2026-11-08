-- Additive to already-applied 0004; never edit migration history.
ALTER TABLE contentos_app.lifetime_recurring_checkout_guards
  ADD COLUMN checked_at timestamptz;
GRANT UPDATE(checked_at) ON contentos_app.lifetime_recurring_checkout_guards TO contentos_runtime;
