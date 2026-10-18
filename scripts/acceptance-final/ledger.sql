-- Isolated validation branch only. No public access; runner has EXECUTE only.
CREATE SCHEMA contentos_final_a7cd_20261018;
REVOKE ALL ON SCHEMA contentos_final_a7cd_20261018 FROM PUBLIC;
CREATE TABLE contentos_final_a7cd_20261018.campaign (
 id boolean PRIMARY KEY CHECK(id), plan_hash text NOT NULL CHECK(plan_hash ~ '^[a-f0-9]{64}$'),
 account_id text NOT NULL CHECK(account_id LIKE 'staged-validation-%'), expires_at timestamptz NOT NULL,
 origin_plan_hash text NOT NULL, origin_checkpoint_hash text NOT NULL, origin_snapshot jsonb NOT NULL,
 enabled boolean NOT NULL DEFAULT false, reserved integer NOT NULL DEFAULT 605550 CHECK(reserved BETWEEN 605550 AND 3080000 AND reserved-605550<=2470000),
 revision integer NOT NULL DEFAULT 0, outcome jsonb, stopped_at timestamptz
);
CREATE TABLE contentos_final_a7cd_20261018.jobs (
 id text PRIMARY KEY CHECK(id ~ '^1:(review:0:[1-6]|revalidation:1:[0-6])$'),
 body text NOT NULL CHECK(octet_length(body)<=56000), payload_hash text NOT NULL,
 reserved integer NOT NULL CHECK(reserved>0), state text NOT NULL CHECK(state IN ('reserved','succeeded','failed','unknown')),
 reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz, evidence jsonb,
 CHECK(evidence IS NULL OR (jsonb_typeof(evidence)='object' AND octet_length(evidence::text)<=2000000))
);
CREATE UNIQUE INDEX one_active_call ON contentos_final_a7cd_20261018.jobs ((true)) WHERE state='reserved';
CREATE FUNCTION contentos_final_a7cd_20261018.inspect(h text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c contentos_final_a7cd_20261018.campaign%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM contentos_final_a7cd_20261018.campaign WHERE id;
 IF c.plan_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
 RETURN jsonb_build_object('enabled',c.enabled AND clock_timestamp()<c.expires_at,'reserved',c.reserved,'revision',c.revision,'outcome',c.outcome,
 'originPlanHash',c.origin_plan_hash,'originCheckpointHash',c.origin_checkpoint_hash,
 'jobs',(SELECT coalesce(jsonb_agg(to_jsonb(j) - 'body' ORDER BY reserved_at),'[]') FROM contentos_final_a7cd_20261018.jobs j));
END $$;
CREATE FUNCTION contentos_final_a7cd_20261018.snapshot(h text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c contentos_final_a7cd_20261018.campaign%ROWTYPE; d jsonb;
BEGIN
 SELECT * INTO STRICT c FROM contentos_final_a7cd_20261018.campaign WHERE id FOR UPDATE;
 IF c.plan_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
 SELECT data INTO STRICT d FROM contentos_app.profiles WHERE id=c.account_id AND data->>'staged_validation_plan'=h FOR UPDATE;
 RETURN jsonb_build_object('revision',c.revision,'data',d);
END $$;
CREATE FUNCTION contentos_final_a7cd_20261018.save(h text, r integer, d jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c contentos_final_a7cd_20261018.campaign%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM contentos_final_a7cd_20261018.campaign WHERE id FOR UPDATE;
 IF c.plan_hash IS DISTINCT FROM h OR c.revision IS DISTINCT FROM r OR d IS NULL OR jsonb_typeof(d)<>'object' OR
   d->>'id' IS DISTINCT FROM c.account_id OR d->>'staged_validation_plan' IS DISTINCT FROM h OR octet_length(d::text)>1500000 THEN RAISE EXCEPTION 'profile_binding'; END IF;
 UPDATE contentos_app.profiles SET data=d,updated_at=clock_timestamp() WHERE id=c.account_id AND data->>'staged_validation_plan'=h;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing_fixture'; END IF;
 UPDATE contentos_final_a7cd_20261018.campaign SET revision=revision+1 WHERE id;
END $$;
CREATE FUNCTION contentos_final_a7cd_20261018.reserve(h text, k text, b text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c contentos_final_a7cd_20261018.campaign%ROWTYPE; p jsonb; d jsonb; m jsonb; cost integer; application_cost integer; digest text;
BEGIN
 SELECT * INTO STRICT c FROM contentos_final_a7cd_20261018.campaign WHERE id FOR UPDATE;
 IF c.plan_hash IS DISTINCT FROM h OR NOT c.enabled OR clock_timestamp()>=c.expires_at OR c.outcome IS NOT NULL THEN RAISE EXCEPTION 'closed'; END IF;
 IF b IS NULL OR octet_length(b)>56000 OR k IS NULL OR k !~ '^1:(review:0:[1-6]|revalidation:1:[0-6])$' THEN RAISE EXCEPTION 'invalid_body'; END IF;
 p:=b::jsonb;
 IF p->>'model' IS DISTINCT FROM 'gpt-5.2' OR p->'store' IS DISTINCT FROM 'false'::jsonb OR p->>'service_tier' IS DISTINCT FROM 'default' OR
 p->>'max_output_tokens' IS DISTINCT FROM '4800' OR p->'text'->'format'->>'name' IS DISTINCT FROM 'content_grounding_batch' OR
 jsonb_typeof(p->'input') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'instructions') IS DISTINCT FROM 'string' OR
 (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(p) x) IS DISTINCT FROM ARRAY['input','instructions','max_output_tokens','model','service_tier','store','text'] THEN RAISE EXCEPTION 'unpriced'; END IF;
 digest:=encode(sha256(convert_to(b,'UTF8')),'hex');
 IF EXISTS(SELECT 1 FROM contentos_final_a7cd_20261018.jobs WHERE id=k) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM contentos_final_a7cd_20261018.jobs WHERE state<>'succeeded') THEN RAISE EXCEPTION 'previous_uncertain'; END IF;
 SELECT data INTO STRICT d FROM contentos_app.profiles WHERE id=c.account_id AND data->>'staged_validation_plan'=h;
 SELECT value INTO STRICT m FROM jsonb_array_elements(d->'generation_reservations_json'->0->'pipeline'->'metrics') WHERE value->>'key'=k;
 application_cost:=ceil(((octet_length(b)+4096)*1.75+(p->>'max_output_tokens')::integer*14)*1.25);
 cost:=ceil(((octet_length(b)+4096)*1.75+(p->>'max_output_tokens')::integer*14)*1.10);
 IF m->>'status' IS DISTINCT FROM 'running' OR m->>'payloadHash' IS DISTINCT FROM digest OR (m->>'reservedMicroUsd')::integer IS DISTINCT FROM application_cost THEN RAISE EXCEPTION 'stage_mismatch'; END IF;
 IF c.reserved+cost>3080000 OR c.reserved+cost-605550>2470000 OR (SELECT count(*) FROM contentos_final_a7cd_20261018.jobs)>=13 THEN RAISE EXCEPTION 'budget'; END IF;
 INSERT INTO contentos_final_a7cd_20261018.jobs(id,body,payload_hash,reserved,state) VALUES(k,b,digest,cost,'reserved');
 UPDATE contentos_final_a7cd_20261018.campaign SET reserved=reserved+cost WHERE id;
 RETURN true;
END $$;
CREATE FUNCTION contentos_final_a7cd_20261018.finish(h text,k text,s text,e jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c contentos_final_a7cd_20261018.campaign%ROWTYPE; j contentos_final_a7cd_20261018.jobs%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM contentos_final_a7cd_20261018.campaign WHERE id FOR UPDATE;
 IF c.plan_hash IS DISTINCT FROM h OR s IS NULL OR s NOT IN ('succeeded','failed','unknown') OR e IS NULL OR jsonb_typeof(e)<>'object' THEN RAISE EXCEPTION 'invalid_finish'; END IF;
 SELECT * INTO STRICT j FROM contentos_final_a7cd_20261018.jobs WHERE id=k;
 IF j.state=s AND j.evidence=e THEN RETURN; END IF;
 IF j.state<>'reserved' THEN RAISE EXCEPTION 'conflicting_finish'; END IF;
 UPDATE contentos_final_a7cd_20261018.jobs SET state=s,evidence=e,completed_at=clock_timestamp() WHERE id=k;
 IF s<>'succeeded' THEN UPDATE contentos_final_a7cd_20261018.campaign SET enabled=false,stopped_at=coalesce(stopped_at,clock_timestamp()) WHERE id; END IF;
END $$;
CREATE FUNCTION contentos_final_a7cd_20261018.outcome(h text,e jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c contentos_final_a7cd_20261018.campaign%ROWTYPE; d jsonb;
BEGIN
 SELECT * INTO STRICT c FROM contentos_final_a7cd_20261018.campaign WHERE id FOR UPDATE;
 IF c.plan_hash IS DISTINCT FROM h OR e IS NULL OR e->>'status' IS NULL OR e->>'status' NOT IN ('delivered','blocked') THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
 IF c.outcome IS NOT NULL THEN
   IF c.outcome=e THEN RETURN; END IF;
   RAISE EXCEPTION 'outcome_conflict';
 END IF;
 IF e->>'status'='delivered' THEN
   SELECT data INTO STRICT d FROM contentos_app.profiles WHERE id=c.account_id AND data->>'staged_validation_plan'=h;
   IF d->'generation_reservations_json'->0->>'status' IS DISTINCT FROM 'completed' OR
     d->'generation_history_json'->0->'payload' IS DISTINCT FROM e->'result' OR jsonb_array_length(d->'usage_events_json') IS DISTINCT FROM 1 OR
     NOT EXISTS(SELECT 1 FROM contentos_final_a7cd_20261018.jobs WHERE id LIKE '1:review:%' AND state='succeeded') OR
     EXISTS(SELECT 1 FROM contentos_final_a7cd_20261018.jobs WHERE state<>'succeeded') THEN RAISE EXCEPTION 'not_delivered'; END IF;
 END IF;
 UPDATE contentos_final_a7cd_20261018.campaign SET outcome=e,enabled=false,stopped_at=coalesce(stopped_at,clock_timestamp()) WHERE id;
END $$;
CREATE FUNCTION contentos_final_a7cd_20261018.disable(h text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE contentos_final_a7cd_20261018.campaign SET enabled=false,stopped_at=coalesce(stopped_at,clock_timestamp()) WHERE plan_hash=h;
 IF NOT FOUND THEN RAISE EXCEPTION 'plan_mismatch'; END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA contentos_final_a7cd_20261018 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contentos_final_a7cd_20261018 FROM PUBLIC;
