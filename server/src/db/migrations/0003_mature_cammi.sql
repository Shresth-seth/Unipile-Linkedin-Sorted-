CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "linkedin_accounts" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "linkedin_accounts" ADD COLUMN "auth_method" text;--> statement-breakpoint
ALTER TABLE "linkedin_accounts" ADD COLUMN "encrypted_credentials" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;