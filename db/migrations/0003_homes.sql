-- PostGIS: drizzle-kit entrecomilla el tipo geography(Point,4326) y no es un identificador; se corrige a mano.

CREATE TYPE "public"."home_regime" AS ENUM('libre', 'VPPB', 'VPPL', 'VPO');--> statement-breakpoint
CREATE TYPE "public"."home_status" AS ENUM('draft', 'in_review', 'published', 'paused', 'in_operation', 'closed');--> statement-breakpoint
CREATE TYPE "public"."location_visibility" AS ENUM('exact', 'area');--> statement-breakpoint
CREATE TABLE "homes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "home_type" NOT NULL,
	"status" "home_status" DEFAULT 'draft' NOT NULL,
	"regime" "home_regime" DEFAULT 'libre' NOT NULL,
	"vpp_qualification_date" date,
	"vpp_protection_end" date,
	"vpp_max_legal_price_cents" bigint,
	"useful_m2" numeric(7, 2),
	"built_m2" numeric(7, 2),
	"bedrooms" smallint,
	"bathrooms" smallint,
	"floor" text,
	"has_lift" boolean,
	"garage" boolean,
	"storage_room" boolean,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"energy_rating" text,
	"year_built" smallint,
	"value_min_cents" bigint,
	"value_max_cents" bigint,
	"is_primary_residence" boolean,
	"mortgage_outstanding_cents" bigint,
	"exact_address" "bytea" NOT NULL,
	"location_visibility" "location_visibility" DEFAULT 'area' NOT NULL,
	"exact_location" geography(Point,4326) NOT NULL,
	"approx_location" geography(Point,4326) NOT NULL,
	"area_name" text NOT NULL,
	"moderation_note" text,
	"relevant_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homes" ADD CONSTRAINT "homes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homes_owner_id_idx" ON "homes" USING btree ("owner_id");