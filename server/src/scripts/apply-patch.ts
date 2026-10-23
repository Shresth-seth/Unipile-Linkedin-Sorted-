import "../config/dotenv.config.js";
import { client } from "../db/index.js";

const runPatch = async () => {
  console.log("⏳ Applying schema patch...");
  try {
    await client`
      ALTER TABLE "linkedin_accounts" ADD COLUMN IF NOT EXISTS "headline" text;
    `;
    await client`
      ALTER TABLE "linkedin_accounts" ADD COLUMN IF NOT EXISTS "auth_method" text;
    `;
    await client`
      ALTER TABLE "linkedin_accounts" ADD COLUMN IF NOT EXISTS "encrypted_credentials" text;
    `;
    await client`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'USER' NOT NULL;
    `;
    await client`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "description" text,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "updated_by" uuid REFERENCES "public"."users"("id") ON DELETE set null
      );
    `;
    console.log("✅ Patch applied successfully!");
  } catch (error) {
    console.error("❌ Patch failed:", error);
  } finally {
    await client.end();
  }
};

runPatch();
