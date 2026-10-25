import { defineConfig } from "drizzle-kit";
import "./src/config/dotenv.config.js";

const dbUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl || "postgresql://offline-blocked:5432/offline_blocked",
  },
});
