ALTER TABLE "audit_log" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "entity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "chat_purged_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "matches_chat_purge_idx" ON "matches" USING btree ("closed_at") WHERE "matches"."status" = 'closed' AND "matches"."chat_purged_at" IS NULL;--> statement-breakpoint
-- Los matches ya cerrados toman como cierre su última entrada de auditoría (o, sin ella, su alta)
UPDATE "matches" SET "closed_at" = COALESCE((SELECT max(a."at") FROM "audit_log" a WHERE a."entity" = 'match' AND a."entity_id" = "matches"."id"), "matches"."created_at") WHERE "status" = 'closed';
