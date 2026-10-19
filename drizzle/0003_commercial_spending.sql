-- Preview first. No automatic production bootstrap: reconcile the opening month first.
CREATE TABLE contentos_app.ai_budget_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  starts_month text NOT NULL CHECK (starts_month ~ '^\d{4}-\d{2}$'),
  opening_microgbp bigint NOT NULL CHECK (opening_microgbp BETWEEN 0 AND 30000000),
  suspended boolean NOT NULL DEFAULT false,
  approved_at timestamptz NOT NULL DEFAULT now(),
  evidence_reference text NOT NULL
);
CREATE TABLE contentos_app.ai_spend_requests (
  account_id text NOT NULL REFERENCES contentos_app.profiles(id),
  kind text NOT NULL CHECK (kind IN ('text','image')),
  request_id text NOT NULL,
  fingerprint text NOT NULL,
  month text NOT NULL,
  quote jsonb NOT NULL,
  reserved_microgbp bigint NOT NULL CHECK (reserved_microgbp > 0),
  accounted_microgbp bigint NOT NULL CHECK (accounted_microgbp >= 0),
  lifetime boolean NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved','dispatched','settled','uncertain','released')),
  delivered boolean NOT NULL DEFAULT false,
  provider_usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id,kind,request_id)
);
CREATE INDEX ai_spend_month ON contentos_app.ai_spend_requests(month);
CREATE INDEX ai_spend_lifetime ON contentos_app.ai_spend_requests(account_id,kind) WHERE lifetime;
CREATE TABLE contentos_app.ai_budget_alerts (
  month text NOT NULL,
  threshold_microgbp bigint NOT NULL CHECK (threshold_microgbp IN (20000000,25000000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  PRIMARY KEY (month,threshold_microgbp)
);
CREATE TABLE contentos_app.lifetime_purchases (
  account_id text PRIMARY KEY REFERENCES contentos_app.profiles(id),
  attempt_id uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('creating','open','paid','expired','failed','revoked','disputed')),
  checkout_session_id text UNIQUE,
  payment_intent_id text UNIQUE,
  checkout_url text,
  expires_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contentos_app.lifetime_payment_events (
  event_id text PRIMARY KEY,
  payment_intent_id text NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON contentos_app.ai_budget_configuration, contentos_app.ai_spend_requests,
  contentos_app.ai_budget_alerts, contentos_app.lifetime_purchases, contentos_app.lifetime_payment_events FROM PUBLIC;
GRANT SELECT ON contentos_app.ai_budget_configuration, contentos_app.ai_spend_requests,
  contentos_app.ai_budget_alerts, contentos_app.lifetime_purchases, contentos_app.lifetime_payment_events TO contentos_runtime;
GRANT UPDATE(suspended,evidence_reference) ON contentos_app.ai_budget_configuration TO contentos_runtime;
GRANT INSERT ON contentos_app.ai_spend_requests, contentos_app.ai_budget_alerts,
  contentos_app.lifetime_purchases, contentos_app.lifetime_payment_events TO contentos_runtime;
GRANT UPDATE(state,accounted_microgbp,delivered,provider_usage,month,updated_at)
  ON contentos_app.ai_spend_requests TO contentos_runtime;
GRANT UPDATE(attempt_id,state,checkout_session_id,payment_intent_id,checkout_url,expires_at,evidence,attempt_history,created_at,updated_at)
  ON contentos_app.lifetime_purchases TO contentos_runtime;
