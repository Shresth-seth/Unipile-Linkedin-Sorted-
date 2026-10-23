import "../config/dotenv.config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NoBl2i9yPcpq@ep-little-recipe-ay9d5cov-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function main() {
  console.log("🧹 Starting database cleanup: Removing all users and dependent records...");

  const existingUsers = await db.execute(
    sql`SELECT id, name, email, role FROM users`
  );
  console.log(`📊 Currently registered users count: ${existingUsers.length}`);

  if (existingUsers.length > 0) {
    console.log("Existing users found:");
    for (const u of existingUsers) {
      console.log(` - ${(u as any).name} <${(u as any).email}> [role: ${(u as any).role}]`);
    }
  }

  // Deleting from users triggers ON DELETE CASCADE on:
  // - linkedin_accounts
  // - contacts
  // - daily_agent_settings
  // - daily_agent_runs
  // - message_agent_jobs
  // - messages
  // - action_queue
  // - agent_messages
  console.log("🗑️ Deleting all user rows (cascading to dependent tables)...");
  await db.execute(sql`DELETE FROM users`);

  const remaining = await db.execute(
    sql`SELECT count(*)::int as count FROM users`
  );
  const remainingCount = (remaining[0] as any)?.count ?? 0;

  console.log(`✅ All users cleared! Remaining users count: ${remainingCount}`);
  console.log("🚀 The next user who signs up via /signup will automatically become the ADMIN.");

  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Error clearing users:", err);
  await client.end();
  process.exit(1);
});
