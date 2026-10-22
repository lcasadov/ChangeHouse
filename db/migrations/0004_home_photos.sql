CREATE TYPE "public"."photo_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "home_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"home_id" uuid NOT NULL,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"storage_path" text NOT NULL,
	"position" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_photos_home_id_position_key" UNIQUE("home_id","position"),
	CONSTRAINT "home_photos_position_range" CHECK ("home_photos"."position" BETWEEN 1 AND 20),
	CONSTRAINT "home_photos_ready_has_position" CHECK ("home_photos"."status" = 'pending' OR "home_photos"."position" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "home_photos" ADD CONSTRAINT "home_photos_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "home_photos_home_id_idx" ON "home_photos" USING btree ("home_id");