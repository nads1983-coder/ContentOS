CREATE TABLE "contentos_app"."founder_checkout_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"attempt_key" text NOT NULL,
	"promotion_code_id" text NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_checkout_url" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"amount_total" integer,
	"error" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE contentos_app.founder_checkout_claims ADD CONSTRAINT founder_checkout_claim_status_valid CHECK (status IN ('preparing','open','completed','expired','canceled','invalid','failed'));
--> statement-breakpoint
ALTER TABLE contentos_app.founder_checkout_claims ADD CONSTRAINT founder_checkout_open_session_evidence CHECK (status <> 'open' OR (stripe_checkout_session_id IS NOT NULL AND stripe_checkout_url IS NOT NULL));
--> statement-breakpoint
ALTER TABLE contentos_app.founder_checkout_claims ADD CONSTRAINT founder_checkout_completed_evidence CHECK (status <> 'completed' OR (stripe_checkout_session_id IS NOT NULL AND stripe_customer_id IS NOT NULL AND stripe_subscription_id IS NOT NULL AND amount_total = 0));
--> statement-breakpoint
CREATE INDEX "founder_checkout_claims_user_idx" ON "contentos_app"."founder_checkout_claims" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "founder_checkout_claims_attempt_once" ON "contentos_app"."founder_checkout_claims" USING btree ("attempt_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "founder_checkout_claims_session_once" ON "contentos_app"."founder_checkout_claims" USING btree ("stripe_checkout_session_id");
--> statement-breakpoint
CREATE INDEX "founder_checkout_claims_subscription_idx" ON "contentos_app"."founder_checkout_claims" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "founder_checkout_one_active_per_user" ON "contentos_app"."founder_checkout_claims" USING btree ("user_id") WHERE status IN ('preparing','open');
--> statement-breakpoint
REVOKE ALL ON contentos_app.founder_checkout_claims FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT,INSERT ON contentos_app.founder_checkout_claims TO contentos_runtime;
--> statement-breakpoint
GRANT UPDATE(status,stripe_checkout_session_id,stripe_checkout_url,stripe_customer_id,stripe_subscription_id,amount_total,error,expires_at,updated_at) ON contentos_app.founder_checkout_claims TO contentos_runtime;
