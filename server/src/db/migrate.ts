import "../config/dotenv.config.js";
import path from "node:path";
import fs from "node:fs";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./index.js";
import { applyCustomMigrations } from "./apply-migrations.js";

const runMigration = async () => {
  console.log("⏳ Applying database migrations...");
  let hasError = false;
  try {
    // Prevent long migration lock contention
    await client.unsafe("SET statement_timeout = '60s'; SET lock_timeout = '10s';");

    const candidateFolders = [
      "./src/db/migrations",
      "./dist/db/migrations",
      path.resolve(process.cwd(), "src/db/migrations"),
      path.resolve(process.cwd(), "server/src/db/migrations"),
    ];
    const migrationsFolder = candidateFolders.find((f) => fs.existsSync(f)) || "./src/db/migrations";
    console.log(`📁 Using migrations folder: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log("✅ Drizzle journal migrations applied successfully!");

    console.log("⏳ Applying custom idempotent schema migrations (0005-0009)...");
    await applyCustomMigrations();
    console.log("✅ All database migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    hasError = true;
  } finally {
    await client.end();
    if (hasError) {
      process.exit(1);
    }
  }
};

runMigration();
