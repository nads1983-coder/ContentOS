-- Preserve legacy reversed rows as frozen pending review; full refunds are terminal.
ALTER TABLE contentos_app.ai_topup_purchases DROP CONSTRAINT ai_topup_purchases_status_check;
ALTER TABLE contentos_app.ai_topup_purchases ADD CONSTRAINT ai_topup_purchases_status_check
  CHECK(status IN ('preparing','open','paid','expired','failed','reversed','revoked'));
ALTER TABLE contentos_app.ai_topup_reversals
  ADD COLUMN reason text NOT NULL DEFAULT 'review' CHECK(reason IN ('review','full_refund','dispute')),
  ADD COLUMN evidence_key text;
CREATE TABLE contentos_app.ai_topup_adjudications (
  id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES contentos_app.ai_topup_purchases(id),
  payment_intent_id text NOT NULL,
  administrator_id text NOT NULL,
  administrator_email text NOT NULL,
  decision text NOT NULL CHECK(decision IN ('reinstate','retain_freeze')),
  reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),
  covered_event_ids text[] NOT NULL,
  covered_evidence_keys text[] NOT NULL,
  stripe_charge_id text NOT NULL,
  stripe_refunded_pence integer NOT NULL CHECK(stripe_refunded_pence>=0),
  dispute_ids text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_topup_adjudications_purchase ON contentos_app.ai_topup_adjudications(purchase_id);
REVOKE ALL ON contentos_app.ai_topup_adjudications FROM PUBLIC;
GRANT SELECT,INSERT ON contentos_app.ai_topup_adjudications TO contentos_runtime;
