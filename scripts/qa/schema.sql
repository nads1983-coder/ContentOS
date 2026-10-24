-- QA ONLY: never add this file to production migration discovery.
DO $$ BEGIN
  IF current_database() <> 'contentos_pr7_qa' THEN
    RAISE EXCEPTION 'Synthetic-only QA database required';
  END IF;
END $$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS contentos_pr7_qa;
--> statement-breakpoint
REVOKE ALL ON SCHEMA contentos_pr7_qa FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS contentos_pr7_qa.campaigns (
  id uuid PRIMARY KEY,
  approval text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  document jsonb NOT NULL,
  CHECK (document->>'id' = id::text),
  CHECK (document->>'approval' = approval),
  CHECK (jsonb_array_length(document->'slots') = 6),
  CHECK ((document->>'reserved')::integer BETWEEN 1 AND 2680000),
  CHECK ((document->>'dispatches')::integer BETWEEN 0 AND 6)
);
--> statement-breakpoint
REVOKE ALL ON contentos_pr7_qa.campaigns FROM PUBLIC;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION contentos_pr7_qa.keep_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_slot jsonb; new_slot jsonb; i integer;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'QA audit records cannot be deleted'; END IF;
  IF NEW.id <> OLD.id OR NEW.approval <> OLD.approval OR
     NEW.document->>'manifestHash' IS DISTINCT FROM OLD.document->>'manifestHash' OR
     NEW.document->>'reserved' IS DISTINCT FROM OLD.document->>'reserved' OR
     (NEW.document->>'dispatches')::integer < (OLD.document->>'dispatches')::integer THEN
    RAISE EXCEPTION 'QA campaign identity and reservations are immutable';
  END IF;
  IF (NEW.document - 'slots' - 'dispatches' - 'status') IS DISTINCT FROM
     (OLD.document - 'slots' - 'dispatches' - 'status') THEN
    RAISE EXCEPTION 'QA campaign metadata is immutable';
  END IF;
  IF OLD.document->>'status' IN ('stopped','complete') AND NEW.document IS DISTINCT FROM OLD.document THEN
    RAISE EXCEPTION 'Closed QA campaign cannot change';
  END IF;
  FOR i IN 0..5 LOOP
    old_slot := OLD.document->'slots'->i; new_slot := NEW.document->'slots'->i;
    IF (old_slot->>'id',old_slot->>'kind',old_slot->>'reservation',old_slot->>'payloadHash') IS DISTINCT FROM
       (new_slot->>'id',new_slot->>'kind',new_slot->>'reservation',new_slot->>'payloadHash') OR
       (old_slot->>'state' <> 'reserved' AND new_slot->>'boundHash' IS DISTINCT FROM old_slot->>'boundHash') OR
       (old_slot->>'state' <> 'reserved' AND new_slot->>'state' = 'reserved') OR
       (old_slot->>'state' IN ('succeeded','failed','uncertain') AND new_slot IS DISTINCT FROM old_slot) THEN
      RAISE EXCEPTION 'QA slot cannot be reset or repriced';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER keep_qa_audit BEFORE UPDATE OR DELETE ON contentos_pr7_qa.campaigns
FOR EACH ROW EXECUTE FUNCTION contentos_pr7_qa.keep_audit();
--> statement-breakpoint

-- Only on the isolated branch. No privileges or schemas change in production.
GRANT USAGE ON SCHEMA contentos_pr7_qa TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
--> statement-breakpoint
GRANT SELECT, INSERT ON contentos_pr7_qa.campaigns TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
--> statement-breakpoint
GRANT UPDATE(document) ON contentos_pr7_qa.campaigns TO pr7_qa_synthetic_a, pr7_qa_synthetic_b, pr7_qa_synthetic_c;
