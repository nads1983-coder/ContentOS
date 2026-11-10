CREATE TABLE contentos_app.paid_lifetime_adjudications (
  id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES contentos_app.paid_creator_lifetime_purchases(id),
  payment_intent_id text NOT NULL,
  administrator_id text NOT NULL,
  administrator_email text NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
  dispute_ids text[] NOT NULL,
  covered_event_ids text[] NOT NULL,
  stripe_charge_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paid_lifetime_adjudications_intent ON contentos_app.paid_lifetime_adjudications(payment_intent_id);
REVOKE ALL ON contentos_app.paid_lifetime_adjudications FROM PUBLIC;
GRANT SELECT,INSERT ON contentos_app.paid_lifetime_adjudications TO contentos_runtime;
