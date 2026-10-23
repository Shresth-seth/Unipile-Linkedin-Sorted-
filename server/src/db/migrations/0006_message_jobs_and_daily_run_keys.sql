CREATE TABLE IF NOT EXISTS "message_agent_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"account_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" text NOT NULL UNIQUE,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"suggested_reply" text,
	"sent_reply" text,
	"reasoning" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "run_key" text UNIQUE;
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp;
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "remaining_capacity_at_start" integer DEFAULT 10;
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "prospects_discovered" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "prospects_qualified" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "connection_requests_failed" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "daily_agent_runs" ADD COLUMN IF NOT EXISTS "next_run_at" timestamp;
--> statement-breakpoint
ALTER TABLE "daily_agent_settings" ALTER COLUMN "preferred_daily_start_time" SET DEFAULT '04:00';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC';
--> statement-breakpoint
INSERT INTO "daily_agent_settings" ("user_id", "daily_agent_enabled", "daily_agent_mode", "preferred_daily_start_time", "timezone", "daily_quota", "auto_connection_requests", "auto_follow_ups", "auto_message_replies", "reply_mode", "created_at", "updated_at")
SELECT id, false, 'AUTONOMOUS', '04:00', 'UTC', 10, true, true, true, 'AUTO', now(), now()
FROM "users"
ON CONFLICT ("user_id") DO NOTHING;
