CREATE TABLE "contentos_app"."migration_mail_campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"operator_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contentos_app"."migration_mail_recipient" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"recipient_key" text,
	"status" text NOT NULL,
	"reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_id" text,
	"provider_status" text,
	"first_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contentos_app"."migration_mail_recipient" ADD CONSTRAINT "migration_mail_recipient_campaign_id_migration_mail_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "contentos_app"."migration_mail_campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "migration_mail_account_once" ON "contentos_app"."migration_mail_recipient" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_mail_address_once" ON "contentos_app"."migration_mail_recipient" USING btree ("campaign_id","recipient_key");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_mail_provider_once" ON "contentos_app"."migration_mail_recipient" USING btree ("provider_id");
--> statement-breakpoint
ALTER TABLE contentos_app.migration_mail_recipient ADD CONSTRAINT migration_mail_status_valid CHECK (status IN ('pending','sending','sent','failed','skipped'));
--> statement-breakpoint
ALTER TABLE contentos_app.migration_mail_recipient ADD CONSTRAINT migration_mail_sent_evidence CHECK (status <> 'sent' OR (provider_id IS NOT NULL AND sent_at IS NOT NULL));
--> statement-breakpoint
CREATE FUNCTION contentos_app.preserve_migration_mail_send() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF OLD.status IN ('sent','skipped','failed') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Terminal migration email result cannot be reopened';
  END IF;
  IF OLD.status = 'sending' AND NEW.status = 'pending' THEN
    RAISE EXCEPTION 'An interrupted send requires reconciliation, not a fresh send';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER migration_mail_terminal_result BEFORE UPDATE ON contentos_app.migration_mail_recipient FOR EACH ROW EXECUTE FUNCTION contentos_app.preserve_migration_mail_send();
--> statement-breakpoint
REVOKE ALL ON contentos_app.migration_mail_campaign,contentos_app.migration_mail_recipient FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION contentos_app.preserve_migration_mail_send() FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT ON contentos_app.migration_mail_campaign,contentos_app.migration_mail_recipient TO contentos_runtime;
--> statement-breakpoint
GRANT UPDATE(completed_at) ON contentos_app.migration_mail_campaign TO contentos_runtime;
--> statement-breakpoint
GRANT UPDATE(status,reason,attempts,provider_id,provider_status,first_attempt_at,sent_at,updated_at) ON contentos_app.migration_mail_recipient TO contentos_runtime;
