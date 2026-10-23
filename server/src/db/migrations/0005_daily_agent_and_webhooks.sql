CREATE TABLE IF NOT EXISTS "daily_agent_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL UNIQUE,
	"daily_agent_enabled" boolean DEFAULT false NOT NULL,
	"daily_agent_mode" text DEFAULT 'AUTONOMOUS' NOT NULL,
	"target_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"networking_goal" text,
	"auto_connection_requests" boolean DEFAULT true NOT NULL,
	"auto_follow_ups" boolean DEFAULT true NOT NULL,
	"auto_message_replies" boolean DEFAULT true NOT NULL,
	"reply_mode" text DEFAULT 'AUTO' NOT NULL,
	"preferred_daily_start_time" text DEFAULT '09:00' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"daily_quota" integer DEFAULT 10 NOT NULL,
	"personality" text,
	"next_daily_run_at" timestamp,
	"last_daily_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_agent_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"prospects_reviewed" integer DEFAULT 0 NOT NULL,
	"strong_matches_found" integer DEFAULT 0 NOT NULL,
	"connection_requests_sent" integer DEFAULT 0 NOT NULL,
	"follow_ups_sent" integer DEFAULT 0 NOT NULL,
	"replies_handled" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"log_details" jsonb DEFAULT '[]'::jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL UNIQUE,
	"event_type" text NOT NULL,
	"account_id" text,
	"user_id" uuid,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'PROCESSED' NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text,
	CONSTRAINT "webhook_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "match_score" integer;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "match_reason" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "opted_out" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "opted_out_at" timestamp;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "opt_out_reason" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "draft_reply" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "draft_reply_reason" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "draft_reply_at" timestamp;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "automated_reply_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "last_inbound_message_id" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "last_outbound_message_id" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "last_automated_reply_at" timestamp;
