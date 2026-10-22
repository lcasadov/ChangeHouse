CREATE TABLE "dismissals" (
	"home_id" uuid NOT NULL,
	"dismissed_home_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dismissals_home_id_dismissed_home_id_pk" PRIMARY KEY("home_id","dismissed_home_id"),
	CONSTRAINT "dismissals_not_self" CHECK ("dismissals"."home_id" <> "dismissals"."dismissed_home_id")
);
--> statement-breakpoint
ALTER TABLE "homes" ADD COLUMN "municipality" text;--> statement-breakpoint
ALTER TABLE "homes" ADD COLUMN "municipality_normalized" text;--> statement-breakpoint
ALTER TABLE "homes" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dismissals" ADD CONSTRAINT "dismissals_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissals" ADD CONSTRAINT "dismissals_dismissed_home_id_homes_id_fk" FOREIGN KEY ("dismissed_home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homes_discovery_feed_idx" ON "homes" USING btree ("published_at","id") WHERE "homes"."status" = 'published';--> statement-breakpoint
CREATE INDEX "homes_approx_location_published_idx" ON "homes" USING gist ("approx_location") WHERE "homes"."status" = 'published';--> statement-breakpoint
CREATE INDEX "homes_exact_location_published_idx" ON "homes" USING gist ("exact_location") WHERE "homes"."status" = 'published';--> statement-breakpoint
CREATE INDEX "homes_municipality_published_idx" ON "homes" USING btree ("municipality_normalized") WHERE "homes"."status" = 'published';--> statement-breakpoint
CREATE INDEX "search_preferences_center_idx" ON "search_preferences" USING gist ("center");--> statement-breakpoint
CREATE INDEX "search_preferences_municipalities_idx" ON "search_preferences" USING gin ("municipalities_normalized");--> statement-breakpoint
-- Relleno: las viviendas que ya se publicaron toman como fecha de publicación su último envío (o su alta), al milisegundo, como el cursor
UPDATE "homes" SET "published_at" = date_trunc('milliseconds', COALESCE("submitted_at", "created_at")) WHERE "status" IN ('published', 'paused', 'in_operation', 'closed');
