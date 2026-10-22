CREATE TYPE "public"."assigned_role" AS ENUM('agency', 'admin');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('terms', 'privacy', 'analytics', 'marketing', 'third_party_referral');--> statement-breakpoint
CREATE TABLE "consents" (
	"user_id" uuid NOT NULL,
	"type" "consent_type" NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "consents_user_id_type_version_pk" PRIMARY KEY("user_id","type","version")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"municipality" text,
	"meets_vpp_requirements" boolean DEFAULT false NOT NULL,
	"is_over_65" boolean DEFAULT false NOT NULL,
	"assigned_role" "assigned_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;