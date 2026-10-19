CREATE TYPE "public"."home_type" AS ENUM('piso', 'atico', 'duplex', 'estudio', 'bajo', 'chalet', 'adosado', 'pareado', 'casa');--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"municipality" text NOT NULL,
	"home_type" "home_type" NOT NULL,
	"looking_for" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
