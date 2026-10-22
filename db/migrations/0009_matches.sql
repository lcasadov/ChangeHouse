CREATE TYPE "public"."match_status" AS ENUM('open', 'confirmed', 'in_operation', 'closed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('pending', 'confirmed', 'withdrawn');--> statement-breakpoint
CREATE TABLE "match_participants" (
	"match_id" uuid NOT NULL,
	"home_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"gives_home_id" uuid NOT NULL,
	"receives_home_id" uuid NOT NULL,
	"compensation_cents" bigint NOT NULL,
	"status" "participant_status" DEFAULT 'pending' NOT NULL,
	"shares_phone" boolean DEFAULT false NOT NULL,
	CONSTRAINT "match_participants_match_id_home_id_pk" PRIMARY KEY("match_id","home_id"),
	CONSTRAINT "match_participants_gives_own_home" CHECK ("match_participants"."gives_home_id" = "match_participants"."home_id"),
	CONSTRAINT "match_participants_not_self" CHECK ("match_participants"."receives_home_id" <> "match_participants"."gives_home_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" smallint NOT NULL,
	"status" "match_status" DEFAULT 'open' NOT NULL,
	"cycle_key" text NOT NULL,
	"chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_cycle_key_unique" UNIQUE("cycle_key"),
	CONSTRAINT "matches_type_range" CHECK ("matches"."type" IN (2, 3))
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_home_id_homes_id_fk" FOREIGN KEY ("home_id") REFERENCES "public"."homes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_gives_home_id_homes_id_fk" FOREIGN KEY ("gives_home_id") REFERENCES "public"."homes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_receives_home_id_homes_id_fk" FOREIGN KEY ("receives_home_id") REFERENCES "public"."homes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_participants_user_idx" ON "match_participants" USING btree ("user_id","match_id");--> statement-breakpoint
CREATE INDEX "match_participants_gives_receives_idx" ON "match_participants" USING btree ("gives_home_id","receives_home_id");