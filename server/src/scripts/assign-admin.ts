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

const targetEmail = process.env.ADMIN_EMAIL || process.argv[2] || "admin@workpilot.co.in";
const adminPassword =
  process.env.ADMIN_INITIAL_PASSWORD ||
  process.argv[3] ||
  crypto.randomBytes(16).toString("hex");

async function main() {
  console.log(`Checking user: ${targetEmail}...`);

  const existing = await db.execute(
    sql`SELECT id, name, email, role FROM users WHERE LOWER(email) = LOWER(${targetEmail})`
  );

  if (existing.length > 0 && existing[0]) {
    const user = existing[0] as any;
    console.log(`Found existing user (id: ${user.id}, role: ${user.role}). Updating role to ADMIN...`);
    const updated = await db.execute(
      sql`UPDATE users SET role = 'ADMIN', updated_at = NOW() WHERE id = ${user.id} RETURNING id, name, email, role`
    );
    console.log("✅ User successfully updated to ADMIN:", updated[0]);
  } else {
    console.log(`User ${targetEmail} not found. Creating new ADMIN user...`);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const created = await db.execute(
      sql`INSERT INTO users (name, email, password, role, created_at, updated_at)
          VALUES ('WorkPilot Admin', ${targetEmail}, ${hashedPassword}, 'ADMIN', NOW(), NOW())
          RETURNING id, name, email, role`
    );
    console.log("✅ New ADMIN user created:", created[0]);
    if (process.env.ADMIN_INITIAL_PASSWORD || process.argv[3]) {
      console.log(`🔑 Admin user initialized with environment-supplied password.`);
    } else {
      console.log(`🔑 One-time generated password (set ADMIN_INITIAL_PASSWORD to customize): ${adminPassword}`);
    }
  }

  // Also list all admin users
  const allAdmins = await db.execute(
    sql`SELECT id, name, email, role FROM users WHERE role = 'ADMIN'`
  );
  console.log("📋 Current Admins in Database:", JSON.stringify(allAdmins, null, 2));

  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Error assigning admin:", err);
  await client.end();
  process.exit(1);
});
