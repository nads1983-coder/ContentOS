-- Append-only continuation on the SAME isolated audit; never reset spend or prior rows.
CREATE TABLE contentos_benchmark_20261018.authorizations (
  id text PRIMARY KEY CHECK(id='followup-1'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  prior_stopped_at timestamptz NOT NULL,
  prior_stopped_reason text NOT NULL,
  starting_reserved_gbp_micros integer NOT NULL CHECK(starting_reserved_gbp_micros=3413760),
  manifest jsonb NOT NULL
);
REVOKE ALL ON contentos_benchmark_20261018.authorizations FROM PUBLIC;
ALTER TABLE contentos_benchmark_20261018.jobs DROP CONSTRAINT jobs_id_check;
ALTER TABLE contentos_benchmark_20261018.jobs ADD CHECK (id IN (
  'pilot:baseline','pilot:candidate','launch:baseline','launch:candidate','sparse:baseline','sparse:candidate',
  'pilot:corrected','launch:corrected','sparse:corrected'));
ALTER TABLE contentos_benchmark_20261018.jobs ADD COLUMN reservation_gbp_micros integer NOT NULL DEFAULT 568960 CHECK (reservation_gbp_micros BETWEEN 1 AND 568960);
ALTER TABLE contentos_benchmark_20261018.jobs DROP CONSTRAINT jobs_reserved_gbp_micros_check;
ALTER TABLE contentos_benchmark_20261018.jobs ADD CHECK (reserved_gbp_micros=0 OR reserved_gbp_micros=reservation_gbp_micros);

CREATE OR REPLACE FUNCTION contentos_benchmark_20261018.inspect(p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_benchmark_20261018.campaign%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_benchmark_20261018.campaign WHERE id;
  IF c.plan_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
  RETURN jsonb_build_object('enabled',c.enabled,'unexpired',clock_timestamp()<c.expires_at,
    'reservedGbpMicros',c.reserved_gbp_micros,'jobs',
    (SELECT jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'payloadHash',j.payload_hash,'reservationGbpMicros',j.reservation_gbp_micros)) FROM contentos_benchmark_20261018.jobs j));
END $$;
CREATE OR REPLACE FUNCTION contentos_benchmark_20261018.reserve(p_hash text,p_job text,p_payload text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_benchmark_20261018.campaign%ROWTYPE; j contentos_benchmark_20261018.jobs%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF NOT c.enabled OR clock_timestamp() >= c.expires_at OR c.plan_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'campaign_closed'; END IF;
  SELECT * INTO STRICT j FROM contentos_benchmark_20261018.jobs WHERE id=p_job FOR UPDATE;
  IF j.payload_hash IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'payload_mismatch'; END IF;
  IF j.state <> 'ready' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM contentos_benchmark_20261018.jobs WHERE state IN ('reserved','unknown')) THEN RAISE EXCEPTION 'previous_attempt_uncertain'; END IF;
  IF c.reserved_gbp_micros+j.reservation_gbp_micros>5000000 OR (SELECT count(*) FROM contentos_benchmark_20261018.jobs WHERE state<>'ready')>=9 THEN RAISE EXCEPTION 'budget_exhausted'; END IF;
  UPDATE contentos_benchmark_20261018.campaign SET reserved_gbp_micros=reserved_gbp_micros+j.reservation_gbp_micros WHERE id;
  UPDATE contentos_benchmark_20261018.jobs SET state='reserved',reserved_gbp_micros=j.reservation_gbp_micros,reserved_at=clock_timestamp() WHERE id=p_job;
  RETURN true;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contentos_benchmark_20261018 FROM PUBLIC;
