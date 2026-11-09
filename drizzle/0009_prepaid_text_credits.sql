-- Additive only. Purchases are disabled in application code pending verification.
ALTER TABLE contentos_app.ai_spend_requests ADD COLUMN text_credit_source text NOT NULL DEFAULT 'included'
  CHECK (text_credit_source IN ('included','purchased'));
ALTER TABLE contentos_app.lifetime_reconciliation_alerts
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN last_attempt_at timestamptz;
CREATE TABLE contentos_app.ai_topup_purchases (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES contentos_app.profiles(id),
  package text NOT NULL CHECK (package IN ('starter','popular','power')),
  price_pence integer NOT NULL,
  credits integer NOT NULL,
  attempt_key text NOT NULL UNIQUE,
  checkout_params text,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','open','paid','expired','failed','reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,account_id),
  CHECK ((package='starter' AND price_pence=500 AND credits=25) OR
         (package='popular' AND price_pence=900 AND credits=50) OR
         (package='power' AND price_pence=1500 AND credits=100))
);
CREATE INDEX ai_topup_account_history ON contentos_app.ai_topup_purchases(account_id,created_at DESC);
CREATE UNIQUE INDEX ai_topup_one_open_attempt ON contentos_app.ai_topup_purchases(account_id) WHERE status IN ('preparing','open');
CREATE TABLE contentos_app.ai_topup_reversals (
  event_id text PRIMARY KEY,
  payment_intent_id text NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_topup_reversals_intent ON contentos_app.ai_topup_reversals(payment_intent_id);
CREATE TABLE contentos_app.ai_topup_reservations (
  account_id text NOT NULL REFERENCES contentos_app.profiles(id),
  request_id text NOT NULL,
  purchase_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved','consumed','released','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,request_id),
  FOREIGN KEY(purchase_id,account_id) REFERENCES contentos_app.ai_topup_purchases(id,account_id)
);
CREATE INDEX ai_topup_reservations_purchase ON contentos_app.ai_topup_reservations(purchase_id,state);
-- Append-only operational evidence. Amounts are credit units, not money.
CREATE TABLE contentos_app.ai_topup_ledger (
  id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL,
  account_id text NOT NULL REFERENCES contentos_app.profiles(id),
  request_id text,
  action text NOT NULL CHECK (action IN ('grant','reserve','consume','release','reverse','void')),
  credits integer NOT NULL CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(purchase_id,account_id) REFERENCES contentos_app.ai_topup_purchases(id,account_id)
);
CREATE UNIQUE INDEX ai_topup_single_grant ON contentos_app.ai_topup_ledger(purchase_id) WHERE action='grant';
CREATE TABLE contentos_app.ai_topup_reconciliation_jobs (
  purchase_id uuid PRIMARY KEY REFERENCES contentos_app.ai_topup_purchases(id),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','attention')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  error_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_topup_jobs_due ON contentos_app.ai_topup_reconciliation_jobs(state,next_attempt_at);
CREATE TABLE contentos_app.ai_topup_reconciliation_alerts (
  purchase_id uuid NOT NULL REFERENCES contentos_app.ai_topup_purchases(id),
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  delivery_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  PRIMARY KEY(purchase_id,code)
);
CREATE TABLE contentos_app.ai_topup_reconciliation_actions (
  id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES contentos_app.ai_topup_purchases(id),
  administrator_id text NOT NULL,
  administrator_email text NOT NULL,
  reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON contentos_app.ai_topup_purchases,contentos_app.ai_topup_reversals,contentos_app.ai_topup_reservations,contentos_app.ai_topup_ledger FROM PUBLIC;
GRANT SELECT,INSERT ON contentos_app.ai_topup_purchases,contentos_app.ai_topup_reversals,contentos_app.ai_topup_reservations,contentos_app.ai_topup_ledger TO contentos_runtime;
GRANT UPDATE(checkout_params,stripe_session_id,stripe_payment_intent_id,status,updated_at) ON contentos_app.ai_topup_purchases TO contentos_runtime;
GRANT UPDATE(state,updated_at) ON contentos_app.ai_topup_reservations TO contentos_runtime;
REVOKE ALL ON contentos_app.ai_topup_reconciliation_jobs,contentos_app.ai_topup_reconciliation_alerts FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON contentos_app.ai_topup_reconciliation_jobs TO contentos_runtime;
GRANT SELECT,INSERT,UPDATE ON contentos_app.ai_topup_reconciliation_alerts TO contentos_runtime;
REVOKE ALL ON contentos_app.ai_topup_reconciliation_actions FROM PUBLIC;
GRANT SELECT,INSERT ON contentos_app.ai_topup_reconciliation_actions TO contentos_runtime;
