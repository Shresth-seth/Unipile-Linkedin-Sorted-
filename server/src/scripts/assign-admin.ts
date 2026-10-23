import "../config/dotenv.config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

const client = postgres(
  process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_NoBl2i9yPcpq@ep-little-recipe-ay9d5cov-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require",
  { prepare: false }
);
const db = drizzle(client);

const targetEmail = "admin@workpilot.co.in";
const defaultPassword = "Admin@WorkPilot2026!";

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
    console.log(`User ${targetEmail} not found. Creating new ADMIN user with password: ${defaultPassword}...`);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const created = await db.execute(
      sql`INSERT INTO users (name, email, password, role, created_at, updated_at)
          VALUES ('WorkPilot Admin', ${targetEmail}, ${hashedPassword}, 'ADMIN', NOW(), NOW())
          RETURNING id, name, email, role`
    );
    console.log("✅ New ADMIN user created:", created[0]);
    console.log(`🔑 Login Credentials:
       Email:    ${targetEmail}
       Password: ${defaultPassword}`);
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
