import "../config/dotenv.config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const client = postgres(
  process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/workpilot",
  { prepare: false }
);
const db = drizzle(client);

// New password: WorkPilot@2026
const newHash =
  "$2b$10$A1JW0UvbBnmt.ixDvkumO.m6rNPMYASqijto0kNnPozVFxzIh2iqO";

const result = await db.execute(
  sql`UPDATE users SET password = ${newHash}, role = 'ADMIN' WHERE email = 'admin@example.com' RETURNING id, name, email, role`
);

if (result.length === 0) {
  console.log("❌ No user found with email admin@example.com");
} else {
  console.log("✅ Admin user updated:", JSON.stringify(result[0], null, 2));
}

await client.end();
process.exit(0);
