ALTER TABLE "daily_agent_settings" ADD COLUMN IF NOT EXISTS "auto_new_connection_message" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "daily_agent_settings" ADD COLUMN IF NOT EXISTS "new_connection_message_template" text;
