CREATE TABLE "action_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid,
	"action_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"executed_at" timestamp,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"linkedin_id" text NOT NULL,
	"profile_url" text,
	"company" text,
	"designation" text,
	"location" text,
	"industry" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"connection_sent_at" timestamp,
	"connected_at" timestamp,
	"last_message_sent_at" timestamp,
	"last_message_received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linkedin_accounts" ADD COLUMN "daily_connections_limit" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "linkedin_accounts" ADD COLUMN "daily_messages_limit" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "action_queue" ADD CONSTRAINT "action_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_queue" ADD CONSTRAINT "action_queue_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;