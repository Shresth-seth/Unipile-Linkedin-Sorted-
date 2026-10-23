import { db } from "./src/db/index.js";

async function migrate() {
  try {
    await db.execute('ALTER TABLE "daily_agent_settings" ADD COLUMN IF NOT EXISTS "auto_new_connection_message" boolean NOT NULL DEFAULT true;');
    await db.execute('ALTER TABLE "daily_agent_settings" ADD COLUMN IF NOT EXISTS "new_connection_message_template" text;');
    console.log("Migration successful");
  } catch (err) {
    console.log("Migration error or already applied", err);
  }
  process.exit(0);
}
migrate();
