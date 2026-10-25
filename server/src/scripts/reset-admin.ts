import "../config/dotenv.config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import bcrypt from "bcrypt";
import crypto from "crypto";

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  console.error("❌ Fatal: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const client = postgres(dbUrl, { prepare: false });
const db = drizzle(client);

const targetEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const newPassword =
  process.env.ADMIN_NEW_PASSWORD ||
  process.argv[2] ||
  crypto.randomBytes(16).toString("hex");

const newHash = await bcrypt.hash(newPassword, 10);

const result = await db.execute(
  sql`UPDATE users SET password = ${newHash}, role = 'ADMIN' WHERE LOWER(email) = LOWER(${targetEmail}) RETURNING id, name, email, role`
);

if (result.length === 0) {
  console.log("❌ No user found with email admin@example.com");
} else {
  console.log("✅ Admin user updated:", JSON.stringify(result[0], null, 2));
}

await client.end();
process.exit(0);
