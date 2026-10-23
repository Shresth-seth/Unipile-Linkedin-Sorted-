ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'STARTER' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'FREE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_cycle" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_subscription_id" text UNIQUE;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" text NOT NULL UNIQUE,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "type" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "users" SET "email_verified_at" = COALESCE("email_verified_at", now());
--> statement-breakpoint
ALTER TABLE "action_queue" ADD COLUMN IF NOT EXISTS "locked_at" timestamp;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_user_created_idx" ON "contacts" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_queue_status_scheduled_idx" ON "action_queue" ("status", "scheduled_for");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_queue_user_status_idx" ON "action_queue" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_user_created_idx" ON "messages" ("user_id", "sent_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_tokens_user_type_idx" ON "auth_tokens" ("user_id", "type", "used_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_events_type_processed_idx" ON "billing_events" ("event_type", "processed_at" DESC);
