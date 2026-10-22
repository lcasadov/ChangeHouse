CREATE TABLE "account_dismissals" (
	"user_id" uuid NOT NULL,
	"dismissed_home_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_dismissals_user_id_dismissed_home_id_pk" PRIMARY KEY("user_id","dismissed_home_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"from_home_id" uuid NOT NULL,
	"to_home_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_from_home_id_to_home_id_pk" PRIMARY KEY("from_home_id","to_home_id"),
	CONSTRAINT "likes_not_self" CHECK ("likes"."from_home_id" <> "likes"."to_home_id")
);
--> statement-breakpoint
ALTER TABLE "account_dismissals" ADD CONSTRAINT "account_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_dismissals" ADD CONSTRAINT "account_dismissals_dismissed_home_id_homes_id_fk" FOREIGN KEY ("dismissed_home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_from_home_id_homes_id_fk" FOREIGN KEY ("from_home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_to_home_id_homes_id_fk" FOREIGN KEY ("to_home_id") REFERENCES "public"."homes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_dismissals_dismissed_home_idx" ON "account_dismissals" USING btree ("dismissed_home_id");--> statement-breakpoint
CREATE INDEX "likes_to_home_idx" ON "likes" USING btree ("to_home_id","from_home_id");--> statement-breakpoint
CREATE INDEX "likes_created_at_idx" ON "likes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dismissals_dismissed_home_idx" ON "dismissals" USING btree ("dismissed_home_id");