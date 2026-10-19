-- PostGIS: drizzle-kit entrecomilla el tipo geography(Point,4326) y no es un identificador; se corrige a mano.
CREATE TABLE "search_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"home_id" uuid,
	"center" geography(Point,4326),
	"radius_km" numeric(6, 2),
	"municipalities" text[] NOT NULL,
	"municipalities_normalized" text[] NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_to_pay_cents" bigint NOT NULL,
	"min_to_receive_cents" bigint NOT NULL,
	"value_reference_pct" smallint DEFAULT 50 NOT NULL,
	CONSTRAINT "search_preferences_has_zone" CHECK ("search_preferences"."center" IS NOT NULL OR cardinality("search_preferences"."municipalities") > 0),
	CONSTRAINT "search_preferences_center_with_radius" CHECK (("search_preferences"."center" IS NULL) = ("search_preferences"."radius_km" IS NULL)),
	CONSTRAINT "search_preferences_radius_range" CHECK ("search_preferences"."radius_km" IS NULL OR ("search_preferences"."radius_km" > 0 AND "search_preferences"."radius_km" <= 200)),
	CONSTRAINT "search_preferences_reference_range" CHECK ("search_preferences"."value_reference_pct" BETWEEN 0 AND 100),
	CONSTRAINT "search_preferences_amounts_non_negative" CHECK ("search_preferences"."max_to_pay_cents" >= 0 AND "search_preferences"."min_to_receive_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "search_preferences" ADD CONSTRAINT "search_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_preferences" ADD CONSTRAINT "search_preferences_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "search_preferences_user_default_key" ON "search_preferences" USING btree ("user_id") WHERE "search_preferences"."home_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "search_preferences_home_key" ON "search_preferences" USING btree ("home_id") WHERE "search_preferences"."home_id" IS NOT NULL;