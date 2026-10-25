import "./src/config/dotenv.config.js";
import { applyCustomMigrations } from "./src/db/apply-migrations.js";
import { client } from "./src/db/index.js";

async function migrate() {
  console.log("ℹ️ manual-migrate.ts has been consolidated into the versioned migration pipeline (0009).");
  try {
    await applyCustomMigrations();
    console.log("✅ Custom migrations applied successfully.");
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
  process.exit(0);
}
migrate();
