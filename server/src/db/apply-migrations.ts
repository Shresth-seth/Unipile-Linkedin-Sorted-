import "../config/dotenv.config.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { client } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function applyCustomMigrations() {
  console.log("⏳ Applying custom schema migrations (IF NOT EXISTS)...");
  try {
    // Prevent long migration lock contention
    await client.unsafe("SET statement_timeout = '60s'; SET lock_timeout = '10s';");

    const migrationFiles = [
      "0005_daily_agent_and_webhooks.sql",
      "0006_message_jobs_and_daily_run_keys.sql",
      "0007_user_gemini_api_key.sql",
      "0008_saas_billing.sql",
      "0009_agent_new_connection_message.sql",
    ];

    for (const file of migrationFiles) {
      const candidatePaths = [
        path.join(__dirname, "migrations", file),
        path.resolve(process.cwd(), "src/db/migrations", file),
        path.resolve(process.cwd(), "dist/db/migrations", file),
        path.resolve(__dirname, "../../src/db/migrations", file),
      ];
      const migrationPath = candidatePaths.find((p) => fs.existsSync(p));
      if (migrationPath) {
        console.log(`⏳ Applying ${file} from ${migrationPath}...`);
        const sqlContent = fs.readFileSync(migrationPath, "utf-8");
        const statements = sqlContent
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          await client.unsafe(stmt);
        }
        console.log(`✅ ${file} applied successfully.`);
      }
    }
  } catch (error: any) {
    console.error("❌ Migration error:", error?.message || error);
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  applyCustomMigrations()
    .then(() => client.end())
    .catch(async () => {
      await client.end();
      process.exit(1);
    });
}
