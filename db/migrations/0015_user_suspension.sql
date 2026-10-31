ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_suspension_complete" CHECK (("users"."suspended_at" IS NULL) = ("users"."suspension_reason" IS NULL));