-- Fresh isolated benchmark only. The operator owns setup; the runner receives EXECUTE only.
-- Role: contentos_grounding_runner_20261018. Never grant it table or customer-schema access.
-- Seed campaign(id, plan_hash, expires_at, enabled) and exactly 12 jobs(id, payload_hash).
-- Draft hashes are prebound; review hashes start NULL and bind once during admission.
CREATE SCHEMA contentos_grounding_benchmark_20261018;
REVOKE ALL ON SCHEMA contentos_grounding_benchmark_20261018 FROM PUBLIC;

CREATE TABLE contentos_grounding_benchmark_20261018.campaign (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  plan_hash text NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  reserved_gbp_micros integer NOT NULL DEFAULT 0 CHECK (reserved_gbp_micros BETWEEN 0 AND 9000000),
  stopped_at timestamptz,
  stopped_reason text
);
CREATE TABLE contentos_grounding_benchmark_20261018.jobs (
  id text PRIMARY KEY CHECK (id ~ '^H[1-3]:(baseline:draft|candidate:(draft|review1|review2))$'),
  pack_id text GENERATED ALWAYS AS (split_part(id, ':', 1) || ':' || split_part(id, ':', 2)) STORED,
  stage text GENERATED ALWAYS AS (CASE WHEN split_part(id, ':', 3) = 'draft' THEN 'draft' ELSE 'review' END) STORED,
  depends_on text GENERATED ALWAYS AS (CASE split_part(id, ':', 3)
    WHEN 'review1' THEN split_part(id, ':', 1) || ':candidate:draft'
    WHEN 'review2' THEN split_part(id, ':', 1) || ':candidate:review1'
    ELSE NULL END) STORED,
  reservation_gbp_micros integer GENERATED ALWAYS AS (CASE WHEN split_part(id, ':', 3) = 'draft' THEN 568960 ELSE 848960 END) STORED,
  payload_hash text CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  previous_response_hash text CHECK (previous_response_hash ~ '^[a-f0-9]{64}$'),
  response_hash text CHECK (response_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready', 'reserved', 'succeeded', 'failed', 'unknown')),
  reserved_gbp_micros integer NOT NULL DEFAULT 0,
  reserved_at timestamptz,
  completed_at timestamptz,
  evidence jsonb,
  FOREIGN KEY (depends_on) REFERENCES contentos_grounding_benchmark_20261018.jobs(id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (reserved_gbp_micros = 0 OR reserved_gbp_micros = reservation_gbp_micros),
  CHECK ((state = 'ready') = (reserved_gbp_micros = 0)),
  CHECK (payload_hash IS NOT NULL OR (stage = 'review' AND state = 'ready')),
  CHECK ((stage = 'draft' AND previous_response_hash IS NULL) OR (stage = 'review' AND (state = 'ready' OR previous_response_hash IS NOT NULL))),
  CHECK (state <> 'succeeded' OR response_hash IS NOT NULL),
  CHECK (evidence IS NULL OR (jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 2000000))
);
-- Defense in depth: even an erroneous future mutation cannot admit two active calls.
CREATE UNIQUE INDEX one_active_grounding_call ON contentos_grounding_benchmark_20261018.jobs ((true)) WHERE state = 'reserved';
CREATE TABLE contentos_grounding_benchmark_20261018.outcomes (
  pack_id text PRIMARY KEY CHECK (pack_id ~ '^H[1-3]:(baseline|candidate)$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object' AND octet_length(evidence::text) <= 2000000),
  CHECK (evidence->>'status' IS NOT NULL AND evidence->>'status' IN ('delivered', 'blocked'))
);

CREATE FUNCTION contentos_grounding_benchmark_20261018.inspect(p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_grounding_benchmark_20261018.campaign%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_grounding_benchmark_20261018.campaign WHERE id;
  IF c.plan_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
  RETURN jsonb_build_object('enabled', c.enabled, 'unexpired', clock_timestamp() < c.expires_at,
    'reservedGbpMicros', c.reserved_gbp_micros,
    'jobs', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'stage', j.stage,
      'dependsOn', j.depends_on, 'state', j.state, 'payloadHash', j.payload_hash,
      'previousResponseHash', j.previous_response_hash, 'responseHash', j.response_hash,
      'reservationGbpMicros', j.reservation_gbp_micros, 'reservedGbpMicros', j.reserved_gbp_micros) ORDER BY j.id), '[]'::jsonb)
      FROM contentos_grounding_benchmark_20261018.jobs j),
    'outcomes', (SELECT coalesce(jsonb_agg(jsonb_build_object('packId', o.pack_id, 'status', o.evidence->>'status') ORDER BY o.pack_id), '[]'::jsonb)
      FROM contentos_grounding_benchmark_20261018.outcomes o));
END $$;

CREATE FUNCTION contentos_grounding_benchmark_20261018.reserve(p_hash text, p_job text, p_payload text, p_previous_response text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_grounding_benchmark_20261018.campaign%ROWTYPE;
  j contentos_grounding_benchmark_20261018.jobs%ROWTYPE;
  dependency contentos_grounding_benchmark_20261018.jobs%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_grounding_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF c.plan_hash IS DISTINCT FROM p_hash OR NOT c.enabled OR clock_timestamp() >= c.expires_at THEN RAISE EXCEPTION 'campaign_closed'; END IF;
  IF p_payload IS NULL OR p_payload !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_payload_hash'; END IF;
  IF (SELECT count(*) FROM contentos_grounding_benchmark_20261018.jobs) <> 12 THEN RAISE EXCEPTION 'incomplete_manifest'; END IF;
  SELECT * INTO STRICT j FROM contentos_grounding_benchmark_20261018.jobs WHERE id = p_job FOR UPDATE;
  IF j.payload_hash IS NOT NULL AND j.payload_hash IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'payload_mismatch'; END IF;
  IF j.state <> 'ready' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.outcomes WHERE pack_id = j.pack_id) THEN RAISE EXCEPTION 'pack_closed'; END IF;
  IF EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.jobs WHERE state IN ('reserved', 'failed', 'unknown')) THEN RAISE EXCEPTION 'previous_attempt_uncertain'; END IF;
  IF j.depends_on IS NULL THEN
    IF p_previous_response IS NOT NULL THEN RAISE EXCEPTION 'unexpected_dependency_hash'; END IF;
  ELSE
    SELECT * INTO STRICT dependency FROM contentos_grounding_benchmark_20261018.jobs WHERE id = j.depends_on;
    IF dependency.state <> 'succeeded' OR p_previous_response IS NULL OR dependency.response_hash IS DISTINCT FROM p_previous_response THEN RAISE EXCEPTION 'dependency_not_satisfied'; END IF;
  END IF;
  IF c.reserved_gbp_micros + j.reservation_gbp_micros > 9000000 OR
    (SELECT count(*) FROM contentos_grounding_benchmark_20261018.jobs WHERE state <> 'ready') >= 12 THEN RAISE EXCEPTION 'budget_exhausted'; END IF;
  UPDATE contentos_grounding_benchmark_20261018.campaign SET reserved_gbp_micros = reserved_gbp_micros + j.reservation_gbp_micros WHERE id;
  UPDATE contentos_grounding_benchmark_20261018.jobs SET state = 'reserved', payload_hash = p_payload,
    previous_response_hash = p_previous_response, reserved_gbp_micros = j.reservation_gbp_micros, reserved_at = clock_timestamp() WHERE id = p_job;
  RETURN true;
END $$;

CREATE FUNCTION contentos_grounding_benchmark_20261018.finish(p_hash text, p_job text, p_state text, p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_grounding_benchmark_20261018.campaign%ROWTYPE;
  j contentos_grounding_benchmark_20261018.jobs%ROWTYPE;
  response_digest text;
BEGIN
  SELECT * INTO STRICT c FROM contentos_grounding_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF c.plan_hash IS DISTINCT FROM p_hash OR p_state IS NULL OR p_state NOT IN ('succeeded', 'failed', 'unknown') OR
    p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' OR octet_length(p_evidence::text) > 2000000 THEN RAISE EXCEPTION 'invalid_completion'; END IF;
  response_digest := p_evidence->>'responseHash';
  IF (p_state = 'succeeded' AND response_digest IS NULL) OR (response_digest IS NOT NULL AND response_digest !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'invalid_response_hash'; END IF;
  SELECT * INTO STRICT j FROM contentos_grounding_benchmark_20261018.jobs WHERE id = p_job FOR UPDATE;
  IF j.state = p_state AND j.evidence = p_evidence THEN RETURN; END IF;
  IF j.state <> 'reserved' THEN RAISE EXCEPTION 'completion_conflict'; END IF;
  -- A dispatched call may finish after expiry or operator disable. Recording it never reopens admission.
  UPDATE contentos_grounding_benchmark_20261018.jobs SET state = p_state, evidence = p_evidence,
    response_hash = response_digest, completed_at = clock_timestamp() WHERE id = p_job;
  IF p_state IN ('failed', 'unknown') OR NOT EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.jobs WHERE state <> 'succeeded') THEN
    UPDATE contentos_grounding_benchmark_20261018.campaign SET enabled = false,
      stopped_at = coalesce(stopped_at, clock_timestamp()),
      stopped_reason = coalesce(stopped_reason, CASE WHEN p_state = 'succeeded' THEN 'complete' ELSE p_state END) WHERE id;
  END IF;
END $$;

CREATE FUNCTION contentos_grounding_benchmark_20261018.outcome(p_hash text, p_pack text, p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_grounding_benchmark_20261018.campaign%ROWTYPE;
  existing jsonb;
BEGIN
  SELECT * INTO STRICT c FROM contentos_grounding_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF c.plan_hash IS DISTINCT FROM p_hash OR p_pack IS NULL OR p_pack !~ '^H[1-3]:(baseline|candidate)$' OR
    p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' OR octet_length(p_evidence::text) > 2000000 OR
    p_evidence->>'status' IS NULL OR p_evidence->>'status' NOT IN ('delivered', 'blocked') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
  SELECT evidence INTO existing FROM contentos_grounding_benchmark_20261018.outcomes WHERE pack_id = p_pack;
  IF FOUND THEN
    IF existing = p_evidence THEN RETURN; END IF;
    RAISE EXCEPTION 'outcome_conflict';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.jobs WHERE id = p_pack || ':draft' AND state = 'succeeded') OR
    EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.jobs WHERE pack_id = p_pack AND state = 'reserved') THEN RAISE EXCEPTION 'pack_not_finished'; END IF;
  IF p_evidence->>'status' = 'delivered' AND split_part(p_pack, ':', 2) = 'candidate' AND (
    NOT EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.jobs WHERE id = p_pack || ':review1' AND state = 'succeeded') OR
    EXISTS (SELECT 1 FROM contentos_grounding_benchmark_20261018.jobs WHERE pack_id = p_pack AND state IN ('failed', 'unknown'))
  ) THEN RAISE EXCEPTION 'review_not_finished'; END IF;
  INSERT INTO contentos_grounding_benchmark_20261018.outcomes(pack_id, evidence) VALUES(p_pack, p_evidence);
  IF (SELECT count(*) FROM contentos_grounding_benchmark_20261018.outcomes) = 6 THEN
    UPDATE contentos_grounding_benchmark_20261018.campaign SET enabled = false,
      stopped_at = coalesce(stopped_at, clock_timestamp()), stopped_reason = coalesce(stopped_reason, 'complete') WHERE id;
  END IF;
END $$;

CREATE FUNCTION contentos_grounding_benchmark_20261018.disable(p_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE c contentos_grounding_benchmark_20261018.campaign%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM contentos_grounding_benchmark_20261018.campaign WHERE id FOR UPDATE;
  IF c.plan_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
  UPDATE contentos_grounding_benchmark_20261018.campaign SET enabled = false,
    stopped_at = coalesce(stopped_at, clock_timestamp()), stopped_reason = coalesce(stopped_reason, 'runner_stopped') WHERE id;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA contentos_grounding_benchmark_20261018 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contentos_grounding_benchmark_20261018 FROM PUBLIC;
