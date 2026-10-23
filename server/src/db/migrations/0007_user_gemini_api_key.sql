ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gemini_api_key" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gemini_model" text;
