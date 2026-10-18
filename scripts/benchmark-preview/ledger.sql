-- ISOLATED VALIDATION BRANCH ONLY. Never a production migration.
-- No application/customer schema is read. The runner gets EXECUTE, not table access.
CREATE SCHEMA contentos_benchmark_20261018;
REVOKE ALL ON SCHEMA contentos_benchmark_20261018 FROM PUBLIC;
CREATE TABLE contentos_benchmark_20261018.campaign (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  plan_hash text NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  reserved_gbp_micros integer NOT NULL DEFAULT 0 CHECK (reserved_gbp_micros BETWEEN 0 AND 5000000),
  stopped_at timestamptz,
  stopped_reason text
);
CREATE TABLE contentos_benchmark_20261018.jobs (
  id text PRIMARY KEY CHECK (id IN ('pilot:baseline','pilot:candidate','launch:baseline','launch:candidate','sparse:baseline','sparse:candidate')),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','reserved','succeeded','unknown')),
  reserved_gbp_micros integer NOT NULL DEFAULT 0 CHECK (reserved_gbp_micros IN (0,568960)),
  reserved_at timestamptz,
  completed_at timestamptz,
  evidence jsonb,
  CHECK ((state = 'ready') = (reserved_gbp_micros = 0)),
  CHECK (evidence IS NULL OR pg_column_size(evidence) <= 2000000)
);
CREATE FUNCTION contentos_benchmark_20261018.inspect(p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_benchmark_20261018.campaign%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_benchmark_20261018.campaign WHERE id;
  IF c.plan_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
  RETURN jsonb_build_object('enabled',c.enabled,'unexpired',clock_timestamp()<c.expires_at,
    'reservedGbpMicros',c.reserved_gbp_micros,'jobs',
    (SELECT jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'payloadHash',j.payload_hash)) FROM contentos_benchmark_20261018.jobs j));
END $$;
CREATE FUNCTION contentos_benchmark_20261018.reserve(p_hash text,p_job text,p_payload text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_benchmark_20261018.campaign%ROWTYPE; j contentos_benchmark_20261018.jobs%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF NOT c.enabled OR clock_timestamp() >= c.expires_at OR c.plan_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'campaign_closed'; END IF;
  SELECT * INTO STRICT j FROM contentos_benchmark_20261018.jobs WHERE id=p_job FOR UPDATE;
  IF j.payload_hash IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'payload_mismatch'; END IF;
  IF j.state <> 'ready' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM contentos_benchmark_20261018.jobs WHERE state IN ('reserved','unknown')) THEN RAISE EXCEPTION 'previous_attempt_uncertain'; END IF;
  IF c.reserved_gbp_micros + 568960 > 5000000 OR (SELECT count(*) FROM contentos_benchmark_20261018.jobs WHERE state <> 'ready') >= 6 THEN RAISE EXCEPTION 'budget_exhausted'; END IF;
  UPDATE contentos_benchmark_20261018.campaign SET reserved_gbp_micros=reserved_gbp_micros+568960 WHERE id;
  UPDATE contentos_benchmark_20261018.jobs SET state='reserved',reserved_gbp_micros=568960,reserved_at=clock_timestamp() WHERE id=p_job;
  RETURN true;
END $$;
CREATE FUNCTION contentos_benchmark_20261018.finish(p_hash text,p_job text,p_state text,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_benchmark_20261018.campaign%ROWTYPE; j contentos_benchmark_20261018.jobs%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF c.plan_hash IS DISTINCT FROM p_hash OR p_state IS NULL OR p_state NOT IN ('succeeded','unknown') OR p_evidence IS NULL OR pg_column_size(p_evidence)>2000000 THEN RAISE EXCEPTION 'invalid_completion'; END IF;
  SELECT * INTO STRICT j FROM contentos_benchmark_20261018.jobs WHERE id=p_job FOR UPDATE;
  IF j.state=p_state AND j.evidence=p_evidence THEN RETURN; END IF;
  IF j.state <> 'reserved' THEN RAISE EXCEPTION 'completion_conflict'; END IF;
  UPDATE contentos_benchmark_20261018.jobs SET state=p_state,evidence=p_evidence,completed_at=clock_timestamp() WHERE id=p_job;
  IF p_state='unknown' OR NOT EXISTS (SELECT 1 FROM contentos_benchmark_20261018.jobs WHERE state <> 'succeeded') THEN
    UPDATE contentos_benchmark_20261018.campaign SET enabled=false,stopped_at=clock_timestamp(),stopped_reason=CASE WHEN p_state='unknown' THEN 'uncertain' ELSE 'complete' END WHERE id;
  END IF;
END $$;
CREATE FUNCTION contentos_benchmark_20261018.disable(p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  UPDATE contentos_benchmark_20261018.campaign SET enabled=false,stopped_at=coalesce(stopped_at,clock_timestamp()),stopped_reason=coalesce(stopped_reason,'runner_stopped') WHERE id AND plan_hash=p_hash;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA contentos_benchmark_20261018 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contentos_benchmark_20261018 FROM PUBLIC;
