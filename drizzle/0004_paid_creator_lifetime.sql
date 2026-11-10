-- NOT applied to production by this migration file's presence.
-- Distinct from founder_checkout_claims: the retired Founding 100 is immutable.
CREATE TABLE contentos_app.paid_creator_lifetime_purchases (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES contentos_app.profiles(id),
  email text NOT NULL,
  offer_code text NOT NULL CHECK (offer_code = 'creator_lifetime_2026'),
  status text NOT NULL CHECK (status IN ('preparing','open','completed','expired','canceled','invalid','failed','refunded','disputed','review')),
  price_pence integer NOT NULL CHECK (price_pence IN (9900,14900)),
  currency text NOT NULL DEFAULT 'gbp' CHECK (currency = 'gbp'),
  early_bird_slot smallint CHECK (early_bird_slot BETWEEN 1 AND 25),
  attempt_key text NOT NULL UNIQUE,
  stripe_checkout_session_id text UNIQUE,
  stripe_checkout_url text,
  stripe_payment_intent_id text UNIQUE,
  stripe_customer_id text,
  checkout_params text,
  expires_at timestamptz,
  completed_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_lifetime_slot_price CHECK (
    (early_bird_slot IS NOT NULL AND price_pence = 9900)
    OR (early_bird_slot IS NULL AND price_pence = 14900)
  ),
  CONSTRAINT paid_lifetime_completed_payment CHECK (
    status <> 'completed' OR
    (stripe_checkout_session_id IS NOT NULL AND stripe_payment_intent_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

-- Active reservations hold their £99 slot until Stripe confirms expiry or
-- terminal failure; completed payments retain the slot permanently.
CREATE UNIQUE INDEX paid_lifetime_early_bird_slot_once
  ON contentos_app.paid_creator_lifetime_purchases(early_bird_slot)
  WHERE early_bird_slot IS NOT NULL AND status IN ('preparing','open','completed','refunded','disputed','review');

CREATE UNIQUE INDEX paid_lifetime_one_active_attempt_per_user
  ON contentos_app.paid_creator_lifetime_purchases(user_id)
  WHERE status IN ('preparing','open');

CREATE UNIQUE INDEX paid_lifetime_one_purchase_per_user
  ON contentos_app.paid_creator_lifetime_purchases(user_id)
  WHERE status IN ('completed','refunded','disputed','review');

CREATE INDEX paid_lifetime_user_history
  ON contentos_app.paid_creator_lifetime_purchases(user_id,created_at DESC);

REVOKE ALL ON contentos_app.paid_creator_lifetime_purchases FROM PUBLIC;
GRANT SELECT, INSERT ON contentos_app.paid_creator_lifetime_purchases TO contentos_runtime;
GRANT UPDATE(checkout_params,status,stripe_checkout_session_id,stripe_payment_intent_id,
  stripe_checkout_url,stripe_customer_id,expires_at,completed_at,reversed_at,updated_at)
  ON contentos_app.paid_creator_lifetime_purchases TO contentos_runtime;

-- Durable inbox also retains unmatched reversals. Never discard an event because
-- checkout completion has not yet bound its PaymentIntent.
CREATE TABLE contentos_app.paid_lifetime_payment_events (
  event_id text PRIMARY KEY,
  payment_intent_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('refunded','disputed','review')),
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paid_lifetime_events_intent ON contentos_app.paid_lifetime_payment_events(payment_intent_id);
REVOKE ALL ON contentos_app.paid_lifetime_payment_events FROM PUBLIC;
GRANT SELECT, INSERT ON contentos_app.paid_lifetime_payment_events TO contentos_runtime;
CREATE TABLE contentos_app.lifetime_recurring_checkout_guards (
  user_id text PRIMARY KEY REFERENCES contentos_app.profiles(id),
  session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON contentos_app.lifetime_recurring_checkout_guards FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON contentos_app.lifetime_recurring_checkout_guards TO contentos_runtime;
GRANT UPDATE(session_id) ON contentos_app.lifetime_recurring_checkout_guards TO contentos_runtime;
