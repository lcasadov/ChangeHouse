CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homes" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "homes_review_queue_idx" ON "homes" USING btree ("submitted_at","id") WHERE "homes"."status" = 'in_review';--> statement-breakpoint
UPDATE "homes" SET "submitted_at" = "created_at" WHERE "status" = 'in_review';--> statement-breakpoint
CREATE FUNCTION "audit_log_reject_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'audit_log es de solo inserción' USING ERRCODE = 'insufficient_privilege';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_log_insert_only" BEFORE UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION "audit_log_reject_change"();--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'changehouse_app') THEN
		REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM changehouse_app;
	END IF;
END
$$;
