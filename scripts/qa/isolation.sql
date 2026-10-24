-- Apply only to the EMPTY contentos_pr7_qa database on the existing test branch.
-- Install the selected auth/profile DDL and schema.sql first. Never copy database rows.
DO $$ BEGIN
  IF current_database() <> 'contentos_pr7_qa' THEN RAISE EXCEPTION 'QA database required'; END IF;
END $$;

REVOKE ALL ON DATABASE contentos_pr7_qa FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA contentos_auth, contentos_app, contentos_pr7_qa FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA contentos_auth, contentos_app, contentos_pr7_qa FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contentos_auth, contentos_app, contentos_pr7_qa FROM PUBLIC;
GRANT CONNECT ON DATABASE contentos_pr7_qa TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
GRANT USAGE ON SCHEMA contentos_auth, contentos_app TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;

-- Owner-managed binding: caller-controlled settings never establish the account.
CREATE TABLE contentos_pr7_qa.actors (
  role_name name PRIMARY KEY CHECK (role_name IN ('pr7_qa_synthetic_a','pr7_qa_synthetic_b','pr7_qa_synthetic_c')),
  account_id text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE CHECK (email ~ '^premium-preview-[a-z0-9-]+@example\.invalid$')
);
REVOKE ALL ON contentos_pr7_qa.actors FROM PUBLIC, pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
CREATE FUNCTION contentos_pr7_qa.actor_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT account_id FROM contentos_pr7_qa.actors WHERE role_name = session_user
$$;
REVOKE ALL ON FUNCTION contentos_pr7_qa.actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contentos_pr7_qa.actor_id() TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;

ALTER TABLE contentos_auth."user" ADD CONSTRAINT qa_synthetic_email CHECK (email ~ '^premium-preview-[a-z0-9-]+@example\.invalid$');
ALTER TABLE contentos_app.profiles ADD CONSTRAINT qa_synthetic_profile CHECK ((
  email ~ '^premium-preview-[a-z0-9-]+@example\.invalid$' AND
  data->>'premium_preview_fixture' = 'true' AND data->>'id' = id AND data->>'email' = email
) IS TRUE);
ALTER TABLE contentos_app.profiles ADD FOREIGN KEY (id) REFERENCES contentos_auth."user"(id);
ALTER TABLE contentos_auth.rate_limit ADD COLUMN qa_role name NOT NULL DEFAULT session_user;

DO $$
DECLARE t text; predicate text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contentos_auth.user','contentos_auth.account','contentos_auth.session',
    'contentos_auth.verification','contentos_auth.rate_limit','contentos_app.profiles','contentos_pr7_qa.campaigns'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
    predicate := CASE t
      WHEN 'contentos_auth.user' THEN 'id = contentos_pr7_qa.actor_id()'
      WHEN 'contentos_app.profiles' THEN 'id = contentos_pr7_qa.actor_id()'
      WHEN 'contentos_auth.account' THEN 'user_id = contentos_pr7_qa.actor_id()'
      WHEN 'contentos_auth.session' THEN 'user_id = contentos_pr7_qa.actor_id()'
      WHEN 'contentos_auth.rate_limit' THEN 'qa_role = session_user'
      WHEN 'contentos_pr7_qa.campaigns' THEN 'document->>''account'' = contentos_pr7_qa.actor_id()'
      ELSE 'false' END;
    EXECUTE format('CREATE POLICY qa_account ON %s USING (%s) WITH CHECK (%s)',t,predicate,predicate);
  END LOOP;
END $$;

GRANT SELECT ON contentos_auth."user", contentos_auth.account, contentos_app.profiles
  TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
GRANT UPDATE(data,updated_at) ON contentos_app.profiles TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
GRANT SELECT, INSERT, UPDATE, DELETE ON contentos_auth.session TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
GRANT SELECT, INSERT, DELETE ON contentos_auth.rate_limit TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
GRANT UPDATE(key,count,last_request) ON contentos_auth.rate_limit TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
-- No user registration, password/email mutation, verification, DDL, billing or mail grants.
