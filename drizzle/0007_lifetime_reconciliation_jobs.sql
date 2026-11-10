CREATE TABLE contentos_app.lifetime_reconciliation_jobs (
  kind text NOT NULL CHECK (kind IN ('purchase','guard')),
  entity_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','attention')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,entity_id)
);
CREATE INDEX lifetime_reconciliation_due ON contentos_app.lifetime_reconciliation_jobs(kind,state,next_attempt_at);
CREATE TABLE contentos_app.lifetime_reconciliation_alerts (
  kind text NOT NULL,
  entity_id text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,entity_id,code)
);
CREATE TABLE contentos_app.lifetime_reconciliation_actions (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('purchase','guard')),
  entity_id text NOT NULL,
  administrator_id text NOT NULL,
  administrator_email text NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON contentos_app.lifetime_reconciliation_jobs,contentos_app.lifetime_reconciliation_alerts FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON contentos_app.lifetime_reconciliation_jobs TO contentos_runtime;
GRANT SELECT,INSERT,UPDATE ON contentos_app.lifetime_reconciliation_alerts TO contentos_runtime;
REVOKE ALL ON contentos_app.lifetime_reconciliation_actions FROM PUBLIC;
GRANT SELECT,INSERT ON contentos_app.lifetime_reconciliation_actions TO contentos_runtime;
